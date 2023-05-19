import { ConsumeHandlerOpts } from '@microfleet/amqp-coffee'
import { MSError, SerializedError } from './utils/serialization'
import { PartialDeep } from 'type-fest'
import { Configuration } from './schema'
import { MessageConsumer } from './router'
import { AMQPTransport } from './'

export type ConsumeOpts = ConsumeHandlerOpts & { 
  neck?: number, 
  noAck?: boolean
  multiAckEvery?: number
  multiAckAfter?: number
  preEvent?: string | symbol
  postEvent?: string | symbol
  autoDeserialize?: boolean
}

/**
 * Wraps response error
 * @param originalError
 */
export function wrapError(originalError: Error | SerializedError): InstanceType<typeof MSError> | Error {
  if (originalError instanceof Error) {
    return originalError
  }

  // this only happens in case of .toJSON on error object
  return MSError.from(originalError)
}

/**
 * Set queue opts
 * @param opts
 */
export const setQoS = function setQoS({ 
  neck, 
  /* eslint-disable @typescript-eslint/no-unused-vars */
  multiAckAfter,
  multiAckEvery, 
  preEvent, 
  postEvent, 
  /* eslint-enable @typescript-eslint/no-unused-vars */
  ...opts
}: ConsumeOpts): ConsumeHandlerOpts {
  let prefetchCount: number
  let noAck: boolean

  if (typeof neck === 'undefined' || neck === 0) {
    noAck = true
    prefetchCount = 0
  } else {
    noAck = opts.noAck == null ? false : opts.noAck
    prefetchCount = neck
  }

  opts.prefetchCount = prefetchCount
  opts.noAck = noAck

  return opts
}

/**
 * Creates AMQPTransport instance
 * @param  _config
 * @param  _messageHandler
 */
export const create = (
  _config: PartialDeep<Configuration> | MessageConsumer,
  _messageHandler?: MessageConsumer
): [AMQPTransport, MessageConsumer?] => {
  let config: PartialDeep<Configuration> = {}
  let messageHandler: MessageConsumer | undefined

  if (typeof _config === 'function' && typeof _messageHandler === 'undefined') {
    messageHandler = _config
    config = {}
  } else if (typeof _config !== 'function') {
    messageHandler = _messageHandler
    config = _config
  }

  // init AMQP connection
  const amqp = new AMQPTransport(config)

  // connect & resolve AMQP connector & message handler if it exists
  return [amqp, messageHandler]
}

/**
 * Allows one to consume messages with a given router and predefined callback handler
 * @param  config
 * @param  [_messageHandler]
 * @param  [_opts={}]
 */
export const connect = async (
  config: PartialDeep<Configuration>,
  _messageHandler?: MessageConsumer,
  _opts: Partial<ConsumeOpts> = {}
) => {
  const [amqp, messageHandler] = create(config, _messageHandler)

  await amqp.connect()

  // do not init queues
  if (typeof messageHandler === 'function' && amqp.config.listen) {
    await amqp.createConsumedQueue(messageHandler, amqp.config.listen, _opts)
  }

  return amqp
}

/**
 * Same as AMQPTransport.connect, except that it creates a queue
 * per each of the routes we want to listen to
 * @param  config
 * @param  [_messageHandler]
 * @param  [opts={}]
 */
export const multiConnect = async (
  config: PartialDeep<Configuration>,
  _messageHandler?: MessageConsumer,
  opts: Partial<ConsumeOpts>[] = []
) => {
  const [amqp, messageHandler] = create(config, _messageHandler)

  // do not init queues
  if (typeof messageHandler !== 'function' || !amqp.config.listen) {
    return amqp
  }

  await amqp.connect()

  const connected: Promise<any>[] = []
  for (const [idx, route] of amqp.config.listen.entries()) {
    const queueOpts = opts[idx] || Object.create(null)
    const queueName = config.queue
      ? `${config.queue}-${route.replace(/[#*]/g, '.')}`
      : config.queue

    const consumedQueueOpts = { ...queueOpts }
    if (consumedQueueOpts.queue == null) {
      consumedQueueOpts.queue = queueName
    }

    connected.push(amqp.createConsumedQueue(messageHandler, [route], consumedQueueOpts))
  }

  await Promise.all(connected)

  return amqp
}