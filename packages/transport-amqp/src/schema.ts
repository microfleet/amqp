import baseJoi from 'joi'
import { Logger } from 'pino'
import { ConnectionOptions, ExchangeOptions, PublishOptions, QueueOptions } from '@microfleet/amqp-coffee'
import { Backoff, Settings as BackoffSettings } from './utils/recovery'

export const Joi = baseJoi.extend((joi) => ({
  type: 'coercedArray',
  base: joi.alternatives().try(
    joi.array().items(joi.string()).unique(),
    joi.string()
  ),
  validate(value) {
    if (typeof value === 'string') {
      return { value: [value] }
    }

    return { value }
  },
}))

const exchangeTypes = Joi.string()
  .valid('direct', 'topic', 'headers', 'fanout', 'x-random', 'x-modulus-hash', 'x-consistent-hash')

export interface Exchange extends ExchangeOptions {
  type: 'topic' | 'direct' | 'fanout' | 'headers' | 'x-random' | 'x-modulus-hash' | 'x-consistent-hash'
}

export interface QueueArguments {
  'x-expires'?: number // 'delete queue after it\'s been unused for X seconds'
  'x-max-priority'?: number  // 'setup priority queues where messages will be delivery based on priority level'
  'x-message-ttl'?: number // time after which message expires frfom queue
  'x-max-length-bytes'?: number // 
  'x-overflow'?: 'reject-publish' | 'reject-publish-dlx' | 'drop-head' 
  'x-max-length'?: number // maximum number of message to hold
  'x-dead-letter-exchange'?: string // dlx
}

export interface Queue extends QueueOptions {
  arguments: QueueArguments,
}

export interface Publish extends Partial<PublishOptions> {
  // extended options
  gzip?: boolean // whether to encode using gzip
  skipSerialize?: boolean // whether it was already serialized earlier
  simpleResponse?: boolean
  reuse?: boolean
  cache?: number // set to a value larger than 0 to cache the response
}

export interface Configuration {
  name: string
  log?: Logger
  private: boolean
  cache: number
  timeout: number
  debug: boolean
  listen: string[]
  version: string
  neck?: number
  multiAckEvery?: number
  multiAckAfter?: number
  privateQueueNeck?: number
  noAck: boolean
  connection: ConnectionOptions
  recovery: BackoffSettings
  exchange: string
  exchangeArgs: Exchange
  bindPersistantQueueToHeadersExchange: boolean
  headersExchange: Exchange & { exchange: string }
  queue: string
  defaultQueueOpts: Exclude<QueueOptions, 'queue'>
  privateQueueOpts: Exclude<QueueOptions, 'queue'>
  dlx: {
    enabled: boolean
    params: Exchange & { exchange: string }
  }
  defaultOpts: Pick<
    Publish, 
    'deliveryMode' | 'confirm' | 'mandatory' | 
    'immediate' | 'contentType' | 'contentEncoding' | 
    'headers' | 'simpleResponse'
  >
}

export const schema = Joi
  .object({
    name: Joi.string()
      .description('name of the service when advertising to AMQP')
      .default('amqp'),

    private: Joi.boolean()
      .description('when true - initializes private queue right away')
      .default(false),

    cache: Joi.number().min(0)
      .description('size of LRU cache for responses, 0 to disable it')
      .default(100),

    timeout: Joi.number()
      .description('default *AndWait timeout')
      .default(10000),

    debug: Joi.boolean()
      .description('enables debug messages')
      .default(process.env.NODE_ENV !== 'production'),

    listen: Joi.coercedArray()
      .description('attach default queue to these routes on default exchange'),

    version: Joi.string()
      .description('advertise end-client service version')
      .default('n/a'),

    neck: Joi.number().min(0)
      .description('if defined - queues will enter QoS mode with required ack & prefetch size of neck'),

    multiAckEvery: Joi.number().min(1)
      .description('ack messages that often, only used with neck > 0'),
    
    multiAckAfter: Joi.number().min(100)
      .description('ack messages at least that often in milliseconds'),

    privateQueueNeck: Joi.number().min(0)
      .default(0)
      .description('if defined - queues will enter QoS mode with required ack & prefetch size of neck'),

    noAck: Joi.boolean()
      .description('allow setting auto-ack when neck is defined'),

    connection: Joi
      .object({
        host: Joi.alternatives()
          .try(
            Joi.string(),
            Joi.array().min(1).items(Joi.string()),
            Joi.array().min(1).items(Joi.object({
              host: Joi.string().required(),
              port: Joi.number().required(),
            }))
          )
          .description('rabbitmq host')
          .default('localhost'),

        port: Joi.number()
          .description('rabbitmq port')
          .default(5672),

        heartbeat: Joi.number()
          .description('heartbeat check')
          .default(10000),

        login: Joi.string()
          .description('rabbitmq login')
          .default('guest'),

        password: Joi.string()
          .description('rabbitmq password')
          .default('guest'),

        vhost: Joi.string()
          .description('rabbitmq virtual host')
          .default('/'),

        temporaryChannelTimeout: Joi.number()
          .description('temporary channel close time with no activity')
          .default(6000),

        reconnect: Joi.boolean()
          .description('enable auto-reconnect')
          .default(true),

        reconnectDelayTime: Joi.number()
          .description('reconnect delay time')
          .default(500),

        hostRandom: Joi.boolean()
          .description('select host to connect to randomly')
          .default(false),

        ssl: Joi.boolean()
          .description('whether to use SSL')
          .default(false),

        sslOptions: Joi.object()
          .description('ssl options'),

        noDelay: Joi.boolean()
          .description('disable Nagle\'s algorithm')
          .default(true),

        clientProperties: Joi
          .object({
            capabilities: Joi.object({
              consumer_cancel_notify: Joi.boolean()
                .description('whether to react to cancel events')
                .default(true),
            }).default(),
          })
          .description('options for advertising client properties')
          .default(),
      })
      .description('options for setting up connection to RabbitMQ')
      .default(),

    recovery: Backoff.schema
      .description('recovery settings')
      .default(),

    exchange: Joi.string()
      .allow('')
      .description('default exchange for communication')
      .default('node-services'),

    exchangeArgs: Joi
      .object({
        autoDelete: Joi.boolean()
          .description('do not autoDelete exchanges')
          .default(false),

        noWait: Joi.boolean()
          .description('whether not to wait for declare response')
          .default(false),

        internal: Joi.boolean()
          .description('whether to set internal bit')
          .default(false),

        type: exchangeTypes
          .description('type of the exchange')
          .default('topic'),

        durable: Joi.boolean()
          .description('whether to preserve exchange on rabbitmq restart')
          .default(true),
      })
      .default(),

    bindPersistantQueueToHeadersExchange: Joi.boolean()
      .description('whether to bind queues created by .createConsumedQueue to headersExchange')
      .default(false),

    headersExchange: Joi
      .object({
        exchange: Joi.string()
          .description('default headers exchange to use, should be different from DLX headers exchange')
          .default('amq.match'),

        autoDelete: Joi.boolean()
          .description('do not autoDelete exchanges')
          .default(false),

        noWait: Joi.boolean()
          .description('whether not to wait for declare response')
          .default(false),

        internal: Joi.boolean()
          .description('whether to set internal bit')
          .default(false),

        type: Joi.string()
          .valid('headers')
          .description('type of the exchange')
          .default('headers'),

        durable: Joi.boolean()
          .description('whether to preserve exchange on rabbitmq restart')
          .default(true),
      })
      .description('this exchange is used to support delayed retry with QoS exchanges')
      .default(),

    queue: Joi.string()
      .description('default queue to connect to for consumption'),

    defaultQueueOpts: Joi
      .object({
        autoDelete: Joi.boolean(),

        exclusive: Joi.boolean(),

        noWait: Joi.boolean(),

        passive: Joi.boolean(),

        durable: Joi.boolean()
          .description('survive restarts & use disk storage')
          .default(true),

        arguments: Joi
          .object({
            'x-expires': Joi.number().min(0)
              .description('delete queue after it\'s been unused for X seconds'),

            'x-max-priority': Joi.number().min(2).max(255)
              .description('setup priority queues where messages will be delivery based on priority level'),
          })
          .default(),
      })
      .description('default options for creating consumer queues')
      .default(),

    privateQueueOpts: Joi
      .object({
        autoDelete: Joi.boolean(),

        exclusive: Joi.boolean(),

        noWait: Joi.boolean(),

        passive: Joi.boolean(),

        durable: Joi.boolean()
          .description('survive restarts & use disk storage')
          .default(true),

        arguments: Joi
          .object({
            'x-expires': Joi.number().min(0)
              .description('delete the private queue after it\'s been unused for 3 minutes')
              .default(1800000),

            'x-max-priority': Joi.number().min(2).max(255)
              .description('setup priority queues where messages will be delivery based on priority level'),
          })
          .default(),
      })
      .description('default options for private RPC queues')
      .default(),

    dlx: Joi
      .object({
        enabled: Joi.boolean()
          .description('enabled DLX by default for fast-reply when messages are dropped')
          .default(true),

        params: Joi
          .object({
            exchange: Joi.string()
              .description('dead letters are redirected here')
              .default('amq.headers'),

            type: exchangeTypes
              .description('must be headers for proper built-in matching')
              .default('headers'),

            autoDelete: Joi.boolean()
              .description('DLX persistance')
              .default(false),
          })
          .default(),
      })
      .description('default for dead-letter-exchange')
      .default(),

    defaultOpts: Joi
      .object({
        deliveryMode: Joi.number().valid(1, 2)
          .description('1 - transient, 2 - saved on disk')
          .default(1),

        confirm: Joi.boolean()
          .description('whether to wait for commit confirmation')
          .default(false),

        mandatory: Joi.boolean()
          .description('when true and message cant be routed to a queue - exception returned, otherwise its dropped')
          .default(false),

        immediate: Joi.boolean()
          .description('not implemented by rabbitmq')
          .default(false),

        contentType: Joi.string()
          .default('application/json')
          .description('default content-type for messages'),

        contentEncoding: Joi.string()
          .default('plain')
          .description('default content-encoding'),

        headers: Joi.object()
          .default(),

        simpleResponse: Joi.boolean()
          .description('whether to return only response data or include headers etc.')
          .default(true),
      })
      .description('default options when publishing messages')
      .default(),
  })
  .assert(
    '.dlx.params.exchange',
    Joi.any().invalid(Joi.ref('headersExchange.exchange')),
    'must use different headers exchanges'
  )
