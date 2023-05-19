import { Logger } from 'pino'

// deps
import uuid = require('uuid')
import flatstr = require('flatstr')
import stringify from 'json-stringify-safe'
import { EventEmitter } from 'eventemitter3'
import { once } from 'events'
import os = require('os')
import is = require('is')
import assert = require('assert')
import hyperid = require('hyperid')
import {
  NotPermittedError,
  ArgumentError,
  HttpStatusError,
} from 'common-errors'
import { setTimeout } from 'timers/promises'
import { PartialDeep } from 'type-fest'
import sorted = require('sorted-array-functions')

// lodash fp
import merge = require('lodash/merge')
import uniq = require('lodash/uniq')
import readPkg = require('read-pkg')

// local deps
import { 
  Joi, 
  schema, 
  Configuration, 
  Publish as PublishOptions, 
  Queue as QueueOptions, 
  Exchange as ExchangeOptions,
} from './schema'
import { 
  Connection as AMQP, 
  Message, 
  Queue, 
  Consumer, 
  QueueBindOptions, 
  ExchangeBindOptions,
  MessageHandler,
  ServerClosedError,
  ConnectionState,
  QueueBindResponse
} from '@microfleet/amqp-coffee'
import { ReplyStorage } from './utils/reply-storage'
import { Backoff } from './utils/recovery'
import { Cache } from './utils/cache'
import { latency } from './utils/latency'
import * as loggerUtils from './loggers'
import { AmqpDLXError } from './utils/error'
import { wrapError, setQoS, ConsumeOpts } from './helpers'
import { kReplyHeaders } from './constants'
import { jsonSerializer, jsonDeserializer, serialize, deserialize } from './utils/serialization'
import { initRoutingFn, WrappedRouter, MessageConsumer } from './router'

// cache references
const pkg = readPkg.sync()
const kBoundRoutes = Symbol.for('@microfleet/transport-amqp::queue-routes')

export interface ReplyOptions {
  simpleResponse?: boolean
}

export interface ConsumedQueueOptions extends Omit<Partial<QueueOptions>, 'queue'> {
  router?: WrappedRouter,
  queue: string,
  autoDeserialize?: boolean
}

declare module '@microfleet/amqp-coffee' {
  interface Queue {
    [kBoundRoutes]?: string[]
  }
}

/**
 * @param routes
 */
const toUniqueStringArray = <T extends string>(routes: T | T[]): T[] => (
  Array.isArray(routes) ? uniq(routes) : [routes]
)

const adaptResponse = (response: any, replyOptions: PublishOptions): any => {
  return replyOptions.simpleResponse === false ? response : response.data
}

const buildResponse = (messageBody: { data: any },  message: Message): { data: any, headers: Record<string, any> } => {
  const { headers = Object.create(null) } = message.properties

  return {
    headers,
    data: messageBody.data,
  }
}

const error406 = (err: any) => err.replyCode === 406
const ignoreErr406 = (log: Logger, ...args: any[]) => (err: Error) => {
  if (error406(err)) {
    log.warn({ err, meta: args }, 'couldnt declare queue or exchange')
    return
  }

  throw err
}

const noop = () => { /* do nothing */ }
const getEmitFn = (ctx: EventEmitter, event: string | boolean | symbol, base: string) => {
  if (!event) {
    return noop
  }

  if (typeof event === 'string' || typeof event === 'symbol') {
    return (message: Message) => ctx.emit(event, message)
  }

  return (message: Message) => ctx.emit(base, message)
}

/**
 * @class AMQPTransport
 */
export class AMQPTransport extends EventEmitter {
  private readonly cache: Cache
  private readonly replyStorage: ReplyStorage
  private readonly recovery: Backoff
  private readonly _appID: Record<string, any>
  private readonly _appIDString: string
  
  // publish options
  private readonly _extraQueueOptions: Partial<QueueOptions>
  private readonly _defaultOpts: Partial<PublishOptions>
  private readonly _defaultOptsKeys: (keyof PublishOptions)[]
  private readonly _amqp: AMQP

  // utilities
  public readonly log: Logger
  public readonly config: Configuration

  private _replyTo: false | string | null = null
  private _consumers = new Set<Consumer>()
  private _boundEmit = this.emit.bind(this)
  private getCorrelationId: hyperid.Instance

  constructor(opts: PartialDeep<Configuration> = { version: 'n/a' }) {
    super()

    // prepare configuration
    const config: Configuration = this.config = Joi.attempt(opts, schema, {
      allowUnknown: true,
    })

    this.config = config
    this.getCorrelationId = hyperid({ urlSafe: true })

    // prepares logger
    this.log = loggerUtils.prepareLogger(config)
    this.log.debug({ config }, 'used configuration')

    // init cache or pass-through operations
    this.cache = new Cache(config.cache)

    /**
     * @readonly
     * reply storage, where we'd save correlation ids
     * and callbacks to be called once we are done
     */
    this.replyStorage = new ReplyStorage(this.cache)

    /**
     * delay settings for reconnect
     * @readonly
     */
    this.recovery = new Backoff(config.recovery)


    this._onClose = this._onClose.bind(this)
    this._onConnect = this._onConnect.bind(this)

    // Form app id string for debugging
    this._appID = {
      name: this.config.name,
      host: os.hostname(),
      pid: process.pid,
      utils_version: pkg.version,
      version: opts.version || 'n/a',
    }

    // Cached serialized value
    this._appIDString = flatstr(stringify(this._appID))
    this._defaultOpts = Object.setPrototypeOf({ ...config.defaultOpts, appId: this._appIDString }, null)
    this._defaultOptsKeys = Object.keys(this._defaultOpts) as (keyof PublishOptions)[]
    this._extraQueueOptions = Object.create(null)

    // DLX config
    if (config.dlx.enabled === true) {
      // there is a quirk - we must make sure that no routing key matches queue name
      // to avoid useless redistributions of the message
      this._extraQueueOptions.arguments = { 'x-dead-letter-exchange': config.dlx.params.exchange }
    }

    this._amqp = new AMQP({ ...config.connection, lazyConnect: true })

    // only on initial connect, then it will be maintained
    this._amqp.once('ready', this._onConnect)
  }

  /**
   * Pass-through underlaying amqp connection state
   */
  get state(): ConnectionState {
    return this._amqp.state
  }

  /**
   * Connects to AMQP, if config.router is specified earlier,
   * automatically invokes .consume function
   */
  async connect(): Promise<void> {
    await this._amqp.connect()
  }

  /**
   * Noop function with empty correlation id and reply to data
   * @param error
   * @param messageBody
   * @param [raw]
   */
  noop(error: Error | null, messageBody: any, raw: Message) {
    if (this.log.isLevelEnabled('debug')) {
      const msg = stringify({ error, messageBody }, jsonSerializer)
      this.log.debug({ msg }, 'when replying to message response could not be delivered')
    }

    this.emit('after', raw)
  }

  async close() {
    const amqp = this._amqp
    switch (amqp.state) {
      case 'opening':
      case 'open':
      case 'reconnecting': {
        await this.closeAllConsumers()
      }
    }

    await amqp.close()
  }

  /**
   * Create queue with specified settings in current connection
   * also emit new event on message in queue
   */
  async createQueue(opts: string | Omit<ConsumedQueueOptions, 'router'>): Promise<{ queue: Queue }>
  async createQueue(opts: Omit<ConsumedQueueOptions, 'router'> & { router: WrappedRouter, queue: string }): Promise<{ queue: Queue, consumer: Consumer }>
  async createQueue(opts: string | ConsumedQueueOptions): Promise<{ queue: Queue, consumer?: Consumer }> {
    const { _amqp: amqp, log } = this

    // prepare params
    const ctx: {
      queue: Queue,
      consumer?: Consumer
    } = Object.create(null)

    const { autoDeserialize = true, ...userParams } = typeof opts === 'string' ? { queue: opts } : opts
    const requestedName = userParams.queue
    const params: Partial<ConsumedQueueOptions> = merge({ autoDelete: !requestedName, durable: !!requestedName }, userParams)

    log.debug({ params }, 'initializing queue')

    const queue = await amqp.queue(params)
    await queue.declare().catch(ignoreErr406(log, params))

    // copy queue options
    const queueName = queue.queueOptions.queue

    log.info({ queue: queueName }, 'queue created')

    ctx.queue = queue

    if (!params.router) {
      return ctx
    }

    log.info({ queue: queueName }, 'consumer is being created')

    // setup consumer
    const messageHandler = this.prepareConsumer(params.router, true, false, autoDeserialize)

    ctx.consumer = await amqp.consume(queueName, setQoS(params), messageHandler)

    return ctx
  }

  setupMultiAck(consumer: Consumer, { neck, multiAckAfter, multiAckEvery, preEvent = 'pre', postEvent }: ConsumeOpts): void {
    assert(neck, 'neck not truthy')
    assert(multiAckAfter || multiAckEvery, 'both multiAckAfter & multiAckEvery undefined')
    assert(postEvent, 'post event not provided')
    if (multiAckEvery && multiAckEvery > 0) {
      assert(multiAckEvery <= neck, 'multiAckEvery must be less than prefetchCount/neck')
    }

    const consumerTag = consumer.consumerTag
    let interval: NodeJS.Timer | null = null
    let sortedList: number[] = []
    let latestConfirm = 0
    let smallestUnconfirmedDeliveryTag = Number.MAX_SAFE_INTEGER

    this.log.warn({ multiAckAfter, multiAckEvery, preEvent, postEvent, consumerTag }, 'setting up multi-ack')
    
    const comparator = (val: number, idx: number, it: number[]) => {
      const next = it[idx + 1]
      if (next === undefined) return true
      if (next === val + 1) return false
      return true
    }

    const confirmAfter = multiAckAfter
      ? () => {
        if (latestConfirm >= Date.now() - multiAckAfter || 
            sortedList.length === 0 ||
            sortedList[0] !== smallestUnconfirmedDeliveryTag) {
          this.log.trace({ sortedList, latestConfirm, multiAckAfter, smallestUnconfirmedDeliveryTag }, 'skipping confirmAfter')
          return
        }

        const largestUninterruptedTagIndex = sortedList.findIndex(comparator)
        const tag = sortedList[largestUninterruptedTagIndex]
        const before = sortedList.length
        sortedList = sortedList.slice(largestUninterruptedTagIndex + 1)
        const after = sortedList.length

        this.log.warn({ remove: before - after, tag, before, after, sortedList, multiAckAfter, state: consumer.state, consuming: consumer.consumerState }, 'confirmed elements')
        
        consumer.multiAck(tag)
        smallestUnconfirmedDeliveryTag = tag + 1
        latestConfirm = Date.now()
      }
    : noop

    const confirm = multiAckEvery
      ? (tag: number, cut: number) => {
        if (interval) interval.refresh()

        const before = sortedList.length
        sortedList = sortedList.slice(cut)
        const after = sortedList.length

        this.log.warn({ remove: before - after, tag, sortedList, multiAckEvery, state: consumer.state, consuming: consumer.consumerState }, 'confirmed elements')

        consumer.multiAck(tag)
        smallestUnconfirmedDeliveryTag = tag + 1
        latestConfirm = Date.now()
      }
      : noop

    // it's ok if messages come earlier as we have stable consume tag & cleanup on close
    consumer.on('consuming', () => {
      if (multiAckAfter) {
        interval = setInterval(confirmAfter, multiAckAfter).unref()
      }

      this.log.warn({ consumerTag }, 'consuming')
    })

    consumer.on('close', () => {
      if (interval) {
        clearInterval(interval)
        interval = null
      }

      sortedList = []
      latestConfirm = 0
      smallestUnconfirmedDeliveryTag = Number.MAX_SAFE_INTEGER

      this.log.error({ consumerTag }, 'consumer closed')
    })

    this.on(preEvent, (m: Message) => {
      this.log.trace({ consumerTag, deliveryTag: m.deliveryTag, same: m.consumerTag === consumerTag }, 'pre-message')
      
      const { deliveryTag } = m
      if (!deliveryTag || m.consumerTag !== consumerTag) {
        return
      }

      if (deliveryTag < smallestUnconfirmedDeliveryTag) {
        smallestUnconfirmedDeliveryTag = deliveryTag
      }
    })

    const evaluateConfirmAndInvoke = (sliceSize: number, base: number): null | [number, number] => {
      if (sortedList.length < sliceSize) {
        this.log.trace({ sliceSize, sortedList }, 'slice too large')
        return null
      }

      const firstTag = sortedList[0]
      const lastTag = sortedList[sliceSize - 1]
      const coveredRange = lastTag - firstTag === sliceSize - 1
      if (!coveredRange) {
        this.log.trace({ firstTag, lastTag, coveredRange, sliceSize, sortedList }, 'covered range skip')
        return null
      }

      return evaluateConfirmAndInvoke(sliceSize + base, base) || [lastTag, sliceSize]
    }

    this.on(postEvent, (m: Message) => {
      this.log.trace({ consumerTag, deliveryTag: m.deliveryTag, same: m.consumerTag === consumerTag }, 'post-message')

      const { deliveryTag } = m
      if (!deliveryTag || m.consumerTag !== consumerTag) {
        return
      }

      // must be added after its processed
      sorted.add(sortedList, deliveryTag)

      if (!multiAckEvery) {
        return
      }

      // in case we have multiple batches to be processed
      if (sortedList[0] === smallestUnconfirmedDeliveryTag) {
        this.log.trace({ sortedList, smallestUnconfirmedDeliveryTag, multiAckEvery }, 'evaluating')
        const s = evaluateConfirmAndInvoke(multiAckEvery, multiAckEvery)
        if (s) {
          confirm(s[0], s[1])
        }
      } else {
        this.log.trace({ sortedList, latestConfirm, multiAckEvery, smallestUnconfirmedDeliveryTag }, 'skipping confirm')
      }
    })
  }

  async consume(queueName: string, params: ConsumeOpts, router: MessageHandler): Promise<Consumer> {
    const consumer = await this._amqp.consumer()
    
    // setup multiAck handler if they are defined
    // we need to do it either every X seconds or every Y messages
    if (params.neck && (params.multiAckEvery || params.multiAckAfter)) {
      this.setupMultiAck(consumer, params)
    }

    await consumer.consume(queueName, router, setQoS(params))
    return consumer
  }

  /**
   * Create unnamed private queue (used for reply events)
   */
  private async createPrivateQueue(attempt = 0, queue?: Queue, consumer?: Consumer): Promise<{ queue: Queue, consumer: Consumer }> {
    const replyTo = this._replyTo
    const queueOpts: Omit<ConsumeOpts, 'queue'> & { queue: string } = {
      ...this.config.privateQueueOpts,
      neck: this.config.privateQueueNeck, // mirror this
      queue: replyTo || `microfleet.${uuid.v4()}`, // reuse same private queue name if it was specified before
    }

    // step 1 -- setup queue
    if (!queue) {
      try {
        // reset current state
        this._replyTo = false

        const createdQueue = await this.createQueue(queueOpts)
        const queueName = createdQueue.queue.queueOptions.queue

        // declare _replyTo queueName
        this._replyTo = queueName

        // bind temporary queue to headers exchange for DLX messages
        // NOTE: if this fails we might have a problem where expired messages
        // are not delivered & private queue is never ready
        const dlxConfig = this.config.dlx
        if (dlxConfig.enabled === true) {
          await this.bindHeadersExchange(createdQueue.queue, this._replyTo, dlxConfig.params, 'reply-to')
        }

        queue = createdQueue.queue
      } catch (err) {
        this.log.error({ err }, 'private queue creation failed - restarting')
        await this.recovery.wait('private', attempt)
        return this.createPrivateQueue(attempt + 1, queue, consumer)
      }
    }

    // step 2 - setup consumer
    try {
      if (consumer) {
        consumer.updateQueue(queue)
        await consumer.resume()
        return { queue, consumer }
      }

      let messagePreEvent: boolean | symbol = false
      let messagePostEvent: boolean | symbol = false
      if (typeof queueOpts.neck === 'number' && queueOpts.neck > 0) {
        const ackEvery = Math.ceil(queueOpts.neck / 2)
        messagePreEvent = Symbol('consume:event:pre')
        messagePostEvent = Symbol('consume:event:post')
        queueOpts.multiAckEvery = ackEvery
        queueOpts.multiAckAfter = 1e3
        queueOpts.preEvent = messagePreEvent
        queueOpts.postEvent = messagePostEvent
      }

      const router = this.prepareConsumer(this._privateMessageRouter, messagePreEvent, messagePostEvent)
      const createdConsumer = await this.consume(queue.queueOptions.queue, queueOpts, router)

      createdConsumer.on('cancel', async (err) => {
        this.log.warn({ err }, 'consumer queue cancelled')
        await createdConsumer.close()
        await this.createPrivateQueue(0, undefined, createdConsumer)
      })

      createdConsumer.on('error', async (err: Error | ServerClosedError) => {
        if (!(err instanceof ServerClosedError)) {
          this.log.error({ err }, 'event rejection')
          return
        }

        switch (err.reason.replyCode) {
          // same as cancel, recreate queue, resume consuming
          case 404:
            this.log.warn({ err }, 'recreating private queue')
            await createdConsumer.close()
            await this.createPrivateQueue(0, undefined, createdConsumer)
            return

          // resource locked - retry after
          case 405:
            this.log.warn({ err }, 'queue locked, waiting for 1 sec trying to consume')
            await setTimeout(1000)
            await this.createPrivateQueue(0, queue, createdConsumer)
            return
          
          default:
            this.log.error({ err }, 'fatal consume error')
            this.emit('error', err, consumer)
        }
      })

      consumer = createdConsumer
    } catch (err) {
      this.log.warn({ err }, 'create consumer error')
      await this.recovery.wait('private', attempt)
      return this.createPrivateQueue(attempt + 1, queue, consumer)
    }

    this.log.debug({ queue: this._replyTo }, 'private-queue-ready')
    setImmediate(this._boundEmit, 'private-queue-ready')

    return { queue, consumer }
  }

  /**
   *
   * @param routes
   * @param queue
   * @param oldQueue
   * @returns
   */
  async bindQueueToExchangeOnRoutes(routes: string[], queue: Queue, oldQueue?: Queue) {

    const previousRoutes = oldQueue?.[kBoundRoutes] ?? []
    if (routes.length === 0 && previousRoutes.length === 0) {
      queue[kBoundRoutes] = []
      return
    }

    // retrieved some of the routes
    this.log.debug({ routes, previousRoutes }, 'retrieved routes')

    const rebindRoutes = uniq([...previousRoutes, ...routes])
    queue[kBoundRoutes] = rebindRoutes

    const work = [
      this.bindExchange(queue, rebindRoutes, this.config.exchangeArgs),
    ]

    // bind same queue to headers exchange
    if (this.config.bindPersistantQueueToHeadersExchange === true) {
      work.push(this.bindHeadersExchange(queue, rebindRoutes, this.config.headersExchange))
    }

    await Promise.all(work)
  }

  /**
   * @param messageHandler
   * @param listen
   * @param options
   */
  async createConsumedQueue(messageHandler: MessageConsumer, listen: string[] = [], { autoDeserialize, ...options }: ConsumeOpts = {}) {
    if (is.fn(messageHandler) === false || Array.isArray(listen) === false) {
      throw new ArgumentError('messageHandler and listen must be present')
    }

    const { config } = this
    const router = initRoutingFn(messageHandler)
    const baseOpts = {
      neck: config.neck,
      noAck: config.noAck,
      multiAckAfter: config.multiAckAfter,
      multiAckEvery: config.multiAckEvery,
      queue: config.queue || '',
    }

    const queueOptions = merge(
      baseOpts,
      config.defaultQueueOpts,
      this._extraQueueOptions,
      options
    )

    if (config.bindPersistantQueueToHeadersExchange === true) {
      for (const route of listen.values()) {
        assert.ok(
          /^[^*#]+$/.test(route),
          'with bindPersistantQueueToHeadersExchange: true routes must not have patterns'
        )
      }
    }

    // step 1. create queue
    let queueName = queueOptions.queue
    let queue: Queue
    const createQueue = async (attempt = 0): Promise<Queue> => {
      let createdQueue
      try {
        createdQueue = await this.createQueue({ ...queueOptions })
        await this.bindQueueToExchangeOnRoutes(listen, createdQueue.queue, queue)
      } catch (err: any) {
        this.log.warn({ err, attempt }, 'failed to create queue')

        // we wont be able to create that queue, so just fail
        switch (err.replyCode) {
          case 403: throw err
        }

        // retry otherwise
        await this.recovery.wait('consumed', attempt + 1)
        return createQueue(attempt + 1)
      }

      queueName = createdQueue.queue.queueOptions.queue

      return createdQueue.queue
    }

    queue = await createQueue()
    this.log.info({ queueName }, 'queue declared')

    
    // define auto-ack schema
    const postEvent = Symbol('consumed:post')
    const preparedConsumerHandled = this.prepareConsumer(router, true, postEvent, autoDeserialize)

    // unique event for this consumer
    queueOptions.postEvent = postEvent
    queueOptions.preEvent = 'pre'

    // step 2 - create consumer
    const createConsumer = async (attempt = 0): Promise<Consumer> => {
      try {
        return await this.consume(queueName, queueOptions, preparedConsumerHandled)
      } catch (err) {
        this.log.warn({ err, attempt }, 'failed to consume')
        await this.recovery.wait('consumed', attempt + 1)
        return createConsumer(attempt + 1)
      }
    }

    const consumer = await createConsumer()
    this._consumers.add(consumer)

    consumer.on('warning', (err) => {
      this.log.warn({ err }, 'consumer auto warning')
    })

    consumer.on('error', async (err) => {
      if (!(err instanceof ServerClosedError)) {
        this.log.fatal({ err }, 'unexpected consumer error')
        this.emit('error', err)
        return
      }

      this.log.warn({ err, channel: consumer.channel }, 'consumer error')

      switch (err.reason.replyCode) {
        case 404: {
          await consumer.close()
          queue = await createQueue()
          consumer.updateQueue(queue)
          await consumer.resume()
          break
        }

        // resource locked - retry after
        case 405: {
          const reconnect = async (err: Error, attempt = 0): Promise<void> => {
            this.log.warn({ err, attempt }, 'queue locked, waiting before reconnect')
            await this.recovery.wait('consumed', attempt)
            try {
              await consumer.resume()
            } catch (error: any) {
              if (attempt === 30) {
                this.log.error({ err, attempt }, 'unable to resume consumer, failing')
                this.emit('error', err)
                return
              }
              return reconnect(error, attempt + 1)
            }
          }
          
          await reconnect(err)
          return
        }

        default:
          this.log.error({ err }, 'fatal consume error')
          this.emit('error', err, consumer)
      }
    })

    consumer.on('cancel', async (err) => {
      this.log.warn({ err }, 'consumer cancel')
      await consumer.pause()
      queue = await createQueue()
      consumer.updateQueue(queue)
      await consumer.resume()
    })

    consumer.on('consuming', () => {
      this.log.info({ queueName, consumerTag: consumer.consumerTag }, 'consumed-queue-reconnected')
      this.emit('consumed-queue-reconnected', consumer, queue)
    })

    return { queue, consumer }
  }

  /**
   * Stops current running consumers
   */
  async closeAllConsumers() {
    const work = []
    for (const consumer of this._consumers.values()) {
      work.push(this.closeConsumer(consumer))
    }
    await Promise.all(work)
  }

  /**
   * Utility function to close consumer and forget about it
   * @param {Consumer} consumer
   */
  async closeConsumer(consumer: Consumer) {
    this.log.warn('closing consumer', consumer.consumerTag)
    this._boundEmit('consumer-close', consumer)
    this._consumers.delete(consumer)

    await Promise.race([
      consumer.cancel(),
      setTimeout(5000)
    ])

    this.log.info({ consumerTag: consumer.consumerTag, queue: consumer.consumeOptions?.queue }, 'closed consumer')
  }

  /**
   * Declares exchange and reports 406 error.
   * @param params Exchange params.
   */
  async declareExchange(params: Partial<ExchangeOptions>) {
    const exchange = await this._amqp.exchange(params)
    const log = this.log.child({ loc: 'declareExchange' })
    await exchange.declare().catch(ignoreErr406(log, params))
    return exchange
  }

  /**
   * Binds exchange to queue via route. For Headers exchange
   * automatically populates arguments with routing-key: <route>.
   * @param  exchange - Exchange to bind to.
   * @param  queue - Declared queue object.
   * @param  route - Routing key.
   * @param  [headerName=false] - if exchange has `headers` type.
   */
  async bindRoute(exchange: string, queue: Queue, route: string, headerName: string | boolean = false): Promise<QueueBindResponse> {
    const queueName = queue.queueOptions.queue
    const options: Partial<QueueBindOptions> = {}
    let routingKey

    if (headerName === false) {
      routingKey = route
    } else {
      options.arguments = {
        'x-match': 'any',
        [headerName === true ? 'routing-key' : headerName]: route,
      }
      routingKey = ''
    }

    const response = await queue.bind(exchange, routingKey, options)
    const routes = queue[kBoundRoutes]

    if (Array.isArray(routes)) {
      // reconnect might push an extra route
      if (!routes.includes(route)) {
        routes.push(route)
      }

      this.log.trace({ routes, queueName }, '[queue routes]')
    } else {
      queue[kBoundRoutes] = [route]
    }

    this.log.debug({ queueName, exchange, routingKey, options }, 'bound queue to exchange')

    return response
  }

  /**
   * Bind specified queue to exchange
   *
   * @param queue     - queue instance created by .createQueue
   * @param _routes   - messages sent to this route will be delivered to queue
   * @param [opts={}] - exchange parameters:
   *                 https://github.com/dropbox/amqp-coffee#connectionexchangeexchangeargscallback
   */
  async bindExchange(queue: Queue, _routes: string | string[], opts: Partial<ExchangeBindOptions> = {}) {
    // make sure we have an expanded array of routes
    const routes = toUniqueStringArray(_routes)

    // default params
    const params = merge({
      exchange: this.config.exchange,
      type: this.config.exchangeArgs.type,
      durable: true,
      autoDelete: false,
    }, opts)

    const { exchange } = params
    assert(exchange, 'exchange name must be specified')
    this.log.debug('bind routes->exchange', routes, exchange)

    await this.declareExchange(params)
    await Promise.all(routes.map((route) => (
      this.bindRoute(exchange, queue, route)
    )))
  }

  /**
   * Binds multiple routing keys to headers exchange.
   * @param  queue
   * @param  _routes
   * @param  opts
   * @param  [headerName=true] - if exchange has `headers` type
   */
  async bindHeadersExchange(queue: Queue, _routes: string | string[], opts: ExchangeOptions, headerName: string | boolean = true) {
    // make sure we have an expanded array of routes
    const routes = toUniqueStringArray(_routes)
    // default params
    const params = merge({ durable: true, autoDelete: false }, opts)
    const { exchange } = params

    // headers exchange
    // do sanity check
    assert.equal(params.type, 'headers')
    assert.ok(exchange, 'exchange must be set')

    this.log.debug({ routes, exchange }, 'bind routes->exchange/headers')

    await this.declareExchange(params)
    await Promise.all(routes.map(async (route) => {
      assert.ok(/^[^*#]+$/.test(route))
      await this.bindRoute(exchange, queue, route, headerName)
    }))
  }

  /**
   * Unbind specified queue from exchange
   *
   * @param queue   - queue instance created by .createQueue
   * @param _routes - messages sent to this route will be delivered to queue
   */
  async unbindExchange(queue: Queue, _routes: string | string[]): Promise<void> {
    const { exchange } = this.config
    const routes = toUniqueStringArray(_routes)
    const queueName = queue.queueOptions.queue
    
    await Promise.all(routes.map(async (route) => {
      await queue.unbind(exchange, route)
      const boundRoutes = queue[kBoundRoutes]
      if (!boundRoutes) {
        return
      }

      const idx = boundRoutes.indexOf(route)
      if (idx >= 0) {
        boundRoutes.splice(idx, 1)
      }

      this.log.info({ queueName, exchange, route }, 'unbound routing key from queue')
    }))
  }

  /**
   * Low-level publishing method
   * @param  exchange
   * @param  queueOrRoute
   * @param  _message
   * @param  options
   */
  async sendToServer(exchange: string, queueOrRoute: string, _message: any, options: PublishOptions): Promise<void> {
    const publishOptions = this.publishOptions(options)

    const message = options.skipSerialize === true
      ? _message
      : await serialize(_message, publishOptions)

    await this._amqp.publish(exchange, queueOrRoute, message, publishOptions)

    // emit original message
    this.emit('publish', queueOrRoute, _message)
  }

  /**
   * Send message to specified route
   *
   * @param route - Destination route
   * @param message - Message to send - will be coerced to string via stringify
   * @param [options={}] - Additional options
   */
  publish(route: string, message: any, options: PublishOptions = {}): Promise<void> {
    // prepare exchange
    const exchange = typeof options.exchange === 'string'
      ? options.exchange
      : this.config.exchange

    return this.sendToServer(
      exchange,
      route,
      message,
      options
    )
  }

  /**
   * Send message to specified queue directly
   *
   * @param queue - Destination queue
   * @param message - Message to send
   * @param [options={}] - Additional options
   */
  send(queue: string, message: any, options: PublishOptions = {}): Promise<void> {
    // prepare exchange
    const exchange = typeof options.exchange === 'string'
      ? options.exchange
      : ''

    return this.sendToServer(
      exchange,
      queue,
      message,
      options
    )
  }

  /**
   * Sends a message and then awaits for response
   *
   * @param route - Destination route
   * @param message - Message to send - will be coerced to string via stringify
   * @param [options={}] - Additional options
   */
  async publishAndWait<T = any>(route: string, message: any, options: PublishOptions = {}): Promise<T> {
    return this.createMessageHandler(
      route,
      message,
      options,
      this.publish,
    )
  }

  /**
   * Send message to specified queue directly and wait for answer
   *
   * @param queue - Destination queue
   * @param message - Message to send
   * @param [options={}] - Additional options
   */
  async sendAndWait<T = any>(queue: string, message: any, options: PublishOptions = {}): Promise<T> {
    return this.createMessageHandler(
      queue,
      message,
      options,
      this.send
    )
  }

  /**
   * Specifies default publishing options
   * @param options
   */
  private publishOptions(options: PublishOptions = {}): Omit<PublishOptions, 'skipSerialize'> {
    // remove unused opts
    const opts = options.reuse ? options : { ...options }
    const { _defaultOpts } = this

    // force contentEncoding
    if (options.gzip === true) {
      opts.contentEncoding = 'gzip'
    }

    for (const key of this._defaultOptsKeys) {
      if (opts[key] === undefined) {
        // @ts-expect-error these are keys of the prop
        opts[key] = _defaultOpts[key]
      } else if (key === 'headers') {
        opts[key] = { ..._defaultOpts[key], ...opts.headers }
      }
    }

    if (opts.headers === undefined) {
      opts.headers = { timeout: opts.timeout || this.config.timeout }
    } else if (opts.headers.timeout === undefined) {
      opts.headers.timeout = opts.timeout || this.config.timeout
    }

    return opts
  }

  _replyOptions(options: PublishOptions = {}): ReplyOptions {
    return {
      simpleResponse: options.simpleResponse === undefined
        ? this._defaultOpts.simpleResponse
        : options.simpleResponse,
    }
  }

  /**
   * Reply to sender queue based on headers
   *
   * @param message - message content to send
   * @param raw - raw message
   */
  async reply(message: any, raw: Message): Promise<void> {
    const { properties: { replyTo, correlationId } } = raw

    if (!replyTo || !correlationId) {
      const error = new HttpStatusError(400, 'replyTo or correlationId not found in properties')
      this.emit('after', raw)
      throw error
    }

    const options: PublishOptions = {
      correlationId,
      reuse: true,
      headers: raw.readExtendedAttributes(kReplyHeaders) || Object.create(null)
    }

    try {
      return await this.send(replyTo, message, options)
    } finally {
      this.emit('after', raw)
    }
  }

  /**
   * Creates local listener for when a private queue is up
   * @returns {Promise<void>}
   */
  async awaitPrivateQueue(): Promise<void> {
    await once(this, 'private-queue-ready')
  }

  /**
   * Creates response message handler and sets timeout on the response
   * 
   * @param queue
   * @param message
   * @param options
   */
  async createMessageHandler<
    T, 
    Z extends (queue: string, message: any, options: PublishOptions) => Promise<void>
  >(route: string, message: any, options: PublishOptions, publishMessage: Z): Promise<T> {
    assert(typeof options === 'object' && options !== null, 'options must be an object')

    const replyTo = options.replyTo || this._replyTo
    const time = process.hrtime()
    const replyOptions = this._replyOptions(options)

    // ensure that reply queue exists before sending request
    if (typeof replyTo !== 'string') {
      if (replyTo === false) {
        await this.awaitPrivateQueue()
      } else {
        await this.createPrivateQueue()
      }

      return this.createMessageHandler(route, message, options, publishMessage)
    }

    // work with cache if options.cache is set and is number
    // otherwise cachedResponse is always null
    const cachedResponse = this.cache.get({
      route,
      message,
      headers: options.headers,
      exchange: options.exchange,
      routingKey: options.routingKey,
    }, options.cache)

    if (cachedResponse !== null && typeof cachedResponse === 'object') {
      return adaptResponse(cachedResponse.value, replyOptions)
    }

    const { replyStorage } = this

    // generate response id
    const correlationId = options.correlationId || this.getCorrelationId()

    // timeout before RPC times out
    const timeout = options.timeout || this.config.timeout

    // slightly longer timeout, if message was not consumed in time, it will return with expiration
    const future = replyStorage.push(correlationId, {
      timer: null,
      future: null,
      timeout,
      time,
      routing: route,
      replyOptions,
      cache: cachedResponse,
    })

    if (future.deduped) {
      return future.promise
    }

    // debugging
    if (this.log.isLevelEnabled('trace')) {
      this.log.trace('message pushed into reply queue in %s', latency(time))
    }

    // add custom header for routing over amq.headers exchange
    if (!options.headers) {
      options.headers = { 'reply-to': replyTo }
    } else {
      options.headers['reply-to'] = replyTo 
    }

    // this is to ensure that queue is not overflown and work will not
    // be completed later on
    publishMessage.call(this, route, message, {
      ...options,
      replyTo,
      correlationId,
      expiration: Math.ceil(timeout * 0.9).toString(),
    })
    .catch((err: Error) => {
      this.log.error({ err }, 'error sending message')
      replyStorage.reject(correlationId, err)
    })

    return future.promise
  }

  /**
   *
   */
  private prepareConsumer(
    this: AMQPTransport, 
    _router: WrappedRouter, 
    emitPre: boolean | string | symbol = false,
    emitPost: boolean | string | symbol = false,
    autoDeserialize = true
  ) {
    // use bind as it is now fast
    const router = _router.bind(this)
    const log = this.log.child({ loc: 'prepareConsumer' })

    const emitPreFn = getEmitFn(this, emitPre, 'pre')
    const emitPostFn = getEmitFn(this, emitPost, 'post')

    const preParseMessage = async (incoming: Message) => {
      // extract message data
      const { properties } = incoming
      const { contentType, contentEncoding } = properties

      // message will be skipped and error will be logged
      if (incoming.raw instanceof Error) {
        throw incoming.raw
      }

      // parsed input data
      const messageBody = autoDeserialize 
        ? await deserialize(incoming.raw, contentType, contentEncoding)
        : incoming.raw

      return messageBody
    }

    return async function consumeMessage(incoming: Message): Promise<void> {
      emitPreFn(incoming)

      try {
        const messageBody = await preParseMessage(incoming)
        await router(messageBody, incoming)
      } catch (err) {
        log.error({ err }, 'failed to process consumed message')
      }

      emitPostFn(incoming)
    }
  }

  /**
   * Distributes messages from a private queue
   * @param messageBody
   * @param raw
   */
  private async _privateMessageRouter(messageBody: any, raw: Message): Promise<void> {
    const { correlationId, replyTo, headers = {} } = raw.properties
    const { 'x-death': xDeath } = headers

    // retrieve promised message
    const rpcCall = this.replyStorage.pop(correlationId)

    // case 1 - for some reason there is no saved reference, example - crashed process
    if (rpcCall === undefined || rpcCall.future === null) {
      this.log.error('no recipient for the message %j and id %s', messageBody.error || messageBody.data || messageBody, correlationId)

      let error
      if (xDeath) {
        error = new AmqpDLXError(xDeath, messageBody)
        this.log.warn({ err: error }, 'message was not processed')
      }

      // otherwise we just run messages in circles
      if (replyTo && replyTo !== this._replyTo) {
        // if error is undefined - generate this
        if (error === undefined) {
          error = new NotPermittedError(`no recipients found for correlationId "${correlationId}"`)
        }

        // reply with the error
        return this.reply({ error }, raw)
      }

      // we are done
      return
    }

    this.log.trace('response returned in %s', latency(rpcCall.time))

    // if message was dead-lettered - reject with an error
    if (xDeath) {
      return rpcCall.future.reject(new AmqpDLXError(xDeath, messageBody))
    }

    if (messageBody.error) {
      const error = wrapError(messageBody.error)

      Object.defineProperty(error, kReplyHeaders, {
        value: headers,
        enumerable: false,
      })

      return rpcCall.future.reject(error)
    }

    const response = buildResponse(messageBody, raw)

    // has noop in case .cache isnt a string
    this.cache.set(rpcCall.cache, response)

    return rpcCall.future.resolve(adaptResponse(response, rpcCall.replyOptions))
  }

  /**
   * 'ready' event from amqp-coffee lib, perform queue recreation here
   */
  async _onConnect(): Promise<void> {
    const { serverProperties } = this._amqp
    const { cluster_name: clusterName, version } = serverProperties || {}

    // emit connect event through log
    this.log.info('connected to %s v%s', clusterName, version)

    // https://github.com/dropbox/amqp-coffee#reconnect-flow
    // recreate unnamed private queue
    if ((this._replyTo || this.config.private) && this._replyTo !== false) {
      await this.createPrivateQueue()
    }

    // re-emit ready
    this.emit('ready')
  }

  /**
   * Pass in close event
   */
  _onClose(err: Error) {
    // emit connect event through log
    this.log.warn({ err }, 'connection is closed')
    // re-emit close event
    this.emit('close', err)
  }
}

// expose internal libraries
export {
  ReplyStorage,
  Backoff,
  Cache,
  jsonDeserializer,
  jsonSerializer
}