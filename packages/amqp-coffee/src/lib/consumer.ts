/* eslint-disable @typescript-eslint/no-non-null-assertion */
// we dont want to take perf hit for non-null assertion where we know that object exists ^
// Consumer
import os = require('os')
import { defaults as applyDefaults } from 'lodash'
import { strict as assert } from 'assert'
import { methods, MaxEmptyFrameSize, ContentHeader, MethodFrame } from '@microfleet/amqp-codec'

import defaults = require('./defaults')
import { Connection, ConnectionState } from './connection'
import { MessageFactory, Message } from './message'
import { debug as _debug } from './config'
import { Channel, InferOptions, ChannelState } from './channel'
import { ServerCancelError, ServerClosedError, ConnectionResetError, ServerClosedArgs } from './errors'
import { Queue } from './queue'

const debug = _debug('amqp:Consumer')

export type BasicCancelResponse = InferOptions<typeof methods.basicCancelOk>
export type BasicQosResponse = InferOptions<typeof methods.basicQosOk>
export type BasicConsumeResponse = InferOptions<typeof methods.basicConsumeOk>

export const enum CONSUMER_STATES  {
  CONSUMER_STATE_OPEN = 'open',
  CONSUMER_STATE_OPENING = 'opening',
  CONSUMER_STATE_CLOSED = 'closed',
  CONSUMER_STATE_USER_CLOSED = 'user_closed',
  CONSUMER_STATE_CHANNEL_CLOSED = 'channel_closed',
  CONSUMER_STATE_CONNECTION_CLOSED = 'connection_closed',
}

export const CONSUMER_STATES_CLOSED = [
  CONSUMER_STATES.CONSUMER_STATE_CLOSED, 
  CONSUMER_STATES.CONSUMER_STATE_USER_CLOSED, 
  CONSUMER_STATES.CONSUMER_STATE_CONNECTION_CLOSED, 
  CONSUMER_STATES.CONSUMER_STATE_CHANNEL_CLOSED
]

export type ConsumeOptions = InferOptions<typeof methods.basicConsume>
export type QosOptions = InferOptions<typeof methods.basicQos>

export type MessageHandler = {
  (message: Message): void
}

export type ConsumeHandlerOpts = Partial<ConsumeOptions & QosOptions>

export type ConsumeHandler = {
  options?: ConsumeHandlerOpts
  messageHandler: MessageHandler
  cb?: (err?: Error | null) => void
}

export interface Consumer {
  on(event: 'open', listener: () => void): this;
  on(event: 'close', listener: () => void): this;
  on(event: 'cancel', listener: (err: ServerCancelError) => void): this;
  on(event: 'error', listener: (err: Error | ServerCancelError | ServerClosedError) => void): this;
  on(event: 'consuming', listener: () => void): this;
  on(event: 'warning', listener: (err: Error) => void): this;
}

export class Consumer extends Channel {
  public consumerState = CONSUMER_STATES.CONSUMER_STATE_CLOSED
  public consumeOptions: ConsumeOptions | null = null
  public consumerTag = ''

  public outstandingDeliveryTags = new Set<number>()
  private messageHandler: MessageHandler | null = null
  private incomingMessage: MessageFactory | null = null
  private qos = false
  private qosOptions: QosOptions | null = null

  constructor(connection: Connection, channel: number) {
    super(connection, channel)
    debug(2, () => `channel open for consumer ${channel}`)

    this._basicConsumePreflight = this._basicConsumePreflight.bind(this)
    this._consumerStateOpenPreflight = this._consumerStateOpenPreflight.bind(this)
    this._onConsumeError = this._onConsumeError.bind(this)

    this.consumerTag = this.generateConsumerTag()
  }

  public async ready(): Promise<void> {
    if (this.state !== ChannelState.open) {
      await this.waitForMethodAsync(methods.channelOpenOk)
    }
  }

  public generateConsumerTag(options: ConsumeHandlerOpts = {}): string {
    return options.consumerTag || `${os.hostname()}-${process.pid}-${Date.now()}`
  }

  public async consume(queueName: string, messageHandler: MessageHandler, options: ConsumeHandlerOpts = {}): Promise<BasicConsumeResponse> {
    debug(2, () => `Consuming ${queueName} on channel ${this.channel}`)
    this.consumerState = CONSUMER_STATES.CONSUMER_STATE_OPENING

    let qosOptions: QosOptions | null = null
    if (options.prefetchCount != null && options.prefetchCount > 0) {
      // this should be a qos channel and we should expect ack's on messages
      this.qos = true

      const providedOptions = { 
        prefetchCount: options.prefetchCount, 
        global: options.global != null
          ? options.global
          : defaults.basicQos.global
      }

      qosOptions = applyDefaults(providedOptions, defaults.basicQos)
      options.noAck = options.noAck || false
    } else {
      this.qos = false
      options.noAck = true
    }

    // cleanup
    delete options.prefetchCount
    delete options.prefetchSize
    delete options.global

    // do not mutate original opts
    const consumeOptions: ConsumeOptions = applyDefaults(
      { queue: queueName, consumerTag: this.consumerTag }, 
      options, 
      defaults.basicConsume
    )

    this.messageHandler = messageHandler
    this.consumeOptions = consumeOptions
    this.qosOptions = qosOptions

    // select correct version
    this._onMessageCreated = this.qosEnabled()
      ? this._onMessageCreatedWithQos
      : this._onMessageCreatedNoQos

    return this._consume()
  }

  updateQueue(name: string | Queue): void {
    if (!CONSUMER_STATES_CLOSED.includes(this.consumerState)) {
      throw new Error('cant update queue unless consumer is closed')
    }

    if (!this.consumeOptions) {
      throw new Error('ensure .consume() was previously called')
    }

    // can't reuse consumer tags
    this.consumeOptions.queue = typeof name === 'string' ? name : name.queueOptions.queue
  }

  async close(): Promise<void> {
    await this.cancel()
    this.consumerState = CONSUMER_STATES.CONSUMER_STATE_USER_CLOSED
    super.close()
  }

  async cancel(): Promise<BasicCancelResponse> {
    debug(1, () => [this.channel, 'scheduling cancel', this.consumerState])

    if (CONSUMER_STATES_CLOSED.includes(this.consumerState)) {
      return { consumerTag: this.consumerTag }
    }

    return this.taskPushAsync(
      methods.basicCancel, 
      { consumerTag: this.consumerTag, noWait: false }, 
      methods.basicCancelOk, 
      this._consumerStateOpenPreflight, 
    )
  }

  async pause(): Promise<BasicCancelResponse> {
    if (CONSUMER_STATES_CLOSED.includes(this.consumerState)) {
      return { consumerTag: this.consumerTag }
    }
    
    const res = await this.cancel()

    // should pause be a different state?
    this.consumerState = CONSUMER_STATES.CONSUMER_STATE_USER_CLOSED

    return res
  }

  async resume(): Promise<BasicConsumeResponse> {
    if (!CONSUMER_STATES_CLOSED.includes(this.consumerState)) {
      return { consumerTag: this.consumerTag }
    }

    return this._consume()
  }

  async flow(active: boolean): Promise<BasicConsumeResponse | BasicCancelResponse> {
    return active
      ? this.resume()
      : this.pause()
  }

  async setQos(prefetchCount?: number): Promise<BasicQosResponse> {
    let qosOptions: QosOptions
    assert(this.qosOptions, '`this.qosOptions` options not defined')

    if (typeof prefetchCount !== 'number') {
      qosOptions = { ...this.qosOptions }
    } else {
      // if our prefetch count has changed and we're rabbit version > 3.3.*
      // Rabbitmq 3.3.0 changes the behavior of qos.  we default to gloabl true in this case.
      let global = false
      if (prefetchCount !== this.qosOptions.prefetchCount &&
         this.connection.serverProperties?.product === 'RabbitMQ' &&
         (this.connection.serverProperties?.capabilities?.per_consumer_qos === true ||
         this.connection.serverProperties?.version === "3.3.0" )) {

        global = true
      }

      qosOptions = applyDefaults({ prefetchCount, global }, this.qosOptions)
    }

    debug(1, ['defaults', this.qosOptions, 'setQos', qosOptions])
    return this.taskPushAsync(methods.basicQos, qosOptions, methods.basicQosOk)
  }

  // Private
  private async _consume(): Promise<BasicConsumeResponse> {
    debug(1, () => [this.channel, "_consume called"])
    const{ consumeOptions } = this
    assert(consumeOptions)

    if (this.qos) {
      await this.setQos()
    }

    const res = await this.taskPushAsync(
      methods.basicConsume, 
      consumeOptions, 
      methods.basicConsumeOk, 
      this._basicConsumePreflight
    )
      
    this.consumerState = CONSUMER_STATES.CONSUMER_STATE_OPEN
    this.emit('consuming')

    return res
  }

  _basicConsumePreflight(): boolean {
    return this.consumerState !== CONSUMER_STATES.CONSUMER_STATE_OPEN
  }

  _consumerStateOpenPreflight() {
    return this.consumerState === CONSUMER_STATES.CONSUMER_STATE_OPEN
  }

  _onConsumeError(err: ConnectionResetError | ServerClosedArgs) {
    debug(1, () => [this.channel, 'onConsumeError', err])
    if (err instanceof ConnectionResetError) {
      this.emit('warning', err)
    } else {
      this.emit('error', new ServerClosedError(err))
    }
  }

  _channelOpen() {
    debug(1, () => [this.channel, 'consumer channel opened'])
    if (this.consumeOptions != null && this.consumerState === CONSUMER_STATES.CONSUMER_STATE_CONNECTION_CLOSED) {
      this._consume().catch(this._onConsumeError)
    }
  }

  _channelClosed(reason = new Error('unknown channel close reason')) {
    debug(1, () => [this.channel, "_channelClosed", reason.message])

    this.outstandingDeliveryTags = new Set()
    this.incomingMessage?.cleanup()

    if (this.connection.state === ConnectionState.open 
        && this.consumerState === CONSUMER_STATES.CONSUMER_STATE_OPEN) {
      debug(1, () => [this.channel, "consumerState < Channel Closed"])
      this.consumerState = CONSUMER_STATES.CONSUMER_STATE_CHANNEL_CLOSED
      this._consume().catch(this._onConsumeError)
    } else {
      debug(1, () => [this.channel, "consumerState < CONSUMER_STATE_CONNECTION_CLOSED"])
      this.consumerState = CONSUMER_STATES.CONSUMER_STATE_CONNECTION_CLOSED
    }

    this.emit('close')
  }

  // QOS RELATED Callbacks
  multiAck(deliveryTag: number) {
    if (!this.qosEnabled()) {
      return
    }

    const { outstandingDeliveryTags } = this
    for (const key of outstandingDeliveryTags.values()) {
      if (key <= deliveryTag) {
        outstandingDeliveryTags.delete(key)
      }
    }

    if (this.state === ChannelState.open) {
      const basicAckOptions = { deliveryTag, multiple: true }
      this.connection._sendMethod(this.channel, methods.basicAck, basicAckOptions)
    }
  }

  qosEnabled(): boolean {
    return this.qos && this.consumeOptions!.noAck !== true
  }

  deliveryOutstanding(deliveryTag: number): boolean {
    return this.outstandingDeliveryTags.has(deliveryTag)
  }

  clearTag(deliveryTag: number) {
    this.outstandingDeliveryTags.delete(deliveryTag)
  }

  processTag(deliveryTag: number) {
    if (!this.qosEnabled() || !this.deliveryOutstanding(deliveryTag)) {
      return false
    }

    this.clearTag(deliveryTag)

    return this.state === ChannelState.open
  }

  ack(deliveryTag: number) {
    if (!this.processTag(deliveryTag)) {
      return
    }
    
    const basicAckOptions = { deliveryTag, multiple: false }
    this.connection._sendMethod(this.channel, methods.basicAck, basicAckOptions)  
  }

  reject(deliveryTag: number) {
    if (!this.processTag(deliveryTag)) {
      return
    }

    const basicAckOptions = { deliveryTag, requeue: false }
    this.connection._sendMethod(this.channel, methods.basicReject, basicAckOptions)
  }

  retry(deliveryTag: number) {
    if (!this.processTag(deliveryTag)) {
      return
    }

    const basicAckOptions = { deliveryTag, requeue: true }
    this.connection._sendMethod(this.channel, methods.basicReject, basicAckOptions)
  }

  // CONTENT HANDLING
  _onMethod(channel: number, frame: MethodFrame) {
    debug(3, () => `onMethod ${frame.method.name}, ${JSON.stringify(frame.args)}`)
    switch (frame.name) {
      case methods.basicDeliver.name:
        this.incomingMessage = new MessageFactory(frame.args)
        break

      case methods.basicCancel.name: {
        debug(1, () => "basicCancel")
        this.consumerState = CONSUMER_STATES.CONSUMER_STATE_CLOSED
        const cancelError = new ServerCancelError(frame.args)

        if (this.listenerCount('cancel') > 0) {
          this.emit('cancel', cancelError)
        } else {
          this.emit('error', cancelError)
        }
        break
      }
    }
  }

  _onContentHeader(channel: number, { size, weight, properties }: ContentHeader) {
    this.incomingMessage!.setProperties(weight, size, properties)
    this.incomingMessage!.evaluateMaxFrame(this.connection.frameMax - MaxEmptyFrameSize)

    if (size == 0) {
      this._onContent(channel, null)
    }
  }

  _onContent(channel: number, chunk: Buffer | null) {
    const { incomingMessage } = this

    if (chunk !== null) {
      debug(4, () => 'handling chunk')
      incomingMessage!.handleChunk(chunk)
    }

    if (incomingMessage!.ready()) {
      incomingMessage!.create(this)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _onMessageCreated(message: Message): void {
    throw new Error('must be overwritten')
  }

  _onMessageCreatedNoQos(message: Message) {
    debug(4, () => ['message ready', message.deliveryTag, message.properties])

    this.messageHandler!(message)
  }

  _onMessageCreatedWithQos(message: Message) {
    debug(4, () => ['message ready', message.deliveryTag, message.properties])

    const { deliveryTag } = message
    if (deliveryTag !== undefined) {
      this.outstandingDeliveryTags.add(deliveryTag)
      debug(4, () => ['outstanding tags', this.outstandingDeliveryTags.size])
    }

    this.messageHandler!(message)
  }

  _onChannelReconnect(cb: (err?: Error | null, result?: any) => void): void {
    cb()
    // do nothing
  }
}
