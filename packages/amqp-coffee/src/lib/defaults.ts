import readPkg = require('read-pkg')
import { MaxFrameSize } from '@microfleet/amqp-codec'
import os = require('os')
import type { QueueDeleteOptions, QueueOptions } from './queue'
import type { ConnectionOptions } from './connection'
import { ConsumeOptions, QosOptions } from './consumer'
import { ExchangeDeclareOptions, ExchangeDeleteOptions } from './exchange'
import { PublishOptions } from './publisher'

const clientVersion = readPkg.sync().version

export const defaults = {
  defaultExchangeName: '',
  amqp  : 5672,
  amqps : 5671,
}

export const connection: Omit<ConnectionOptions, 'hosti' | 'hosts'> = {
  host: "localhost",
  login: "guest",
  password: "guest",
  vhost: '/',
  port : 5672,
  ssl: false,
  sslPort: 5671,
  sslOptions: {},
  heartbeat: 10000, // in ms
  reconnect: true,
  reconnectDelayTime: 1000, // in ms
  hostRandom: false,
  connectTimeout: 30000, // in ms
  channelMax: 0, // unlimited
  frameMax: MaxFrameSize,
  noDelay: true, // disable Nagle's algorithm by default

  temporaryChannelTimeout: 2000, // in ms
  temporaryChannelTimeoutCheck: 1000, // in ms
  lazyConnect: false,

  clientProperties: {
    version: clientVersion,
    platform: os.hostname() + '-node-' + process.version,
    product: 'node-amqp-coffee',
  }
}

export const basicPublish: Partial<PublishOptions> = {
  mandatory:   false,
  immediate:   false,
  contentType: 'application/octet-stream',
}

export const basicConsume: Omit<ConsumeOptions, 'queue' | 'consumerTag'> = {
  /**
   * If the no­local field is set the server will not send messages to the
   * connection that published them.
   */
  noLocal: false,

  // If this field is set the server does not expect acknowledgements for
  // messages. That is, when a message is delivered to the client the server
  // assumes the delivery will succeed and immediately dequeues it. This
  // functionality may increase performance but at the cost of reliability.
  // Messages can get lost if a client dies before they are delivered to
  // the application.
  noAck: true,
  exclusive: false,
  noWait: false,
  arguments: {},
}

export const basicQos: Omit<QosOptions, 'prefetchCount'> = {
  prefetchSize: 0,
  
  // RabbitMQ has reinterpreted this field. The original specification said:
  // "By default the QoS settings apply to the current channel only. If
  // this field is set, they are applied to the entire connection." Instead,
  // RabbitMQ takes global=false to mean that the QoS settings should apply
  // per-consumer (for new consumers on the channel; existing ones being
  // unaffected) and global=true to mean that the QoS settings should apply
  // per-channel.

  // THIS IS CHANGED TO TRUE FOR RABBITMQ VERSION 3.3.0 AND UP IN CONSUMER
  global: false,
}


export const exchange: Omit<ExchangeDeclareOptions, 'exchange'> = {
  type: "direct",
  passive: false,
  durable: false,
  noWait: false,
  autoDelete: true,
  arguments: {},
  
  // If set, the exchange may not be used directly by publishers, but only
  // when bound to other exchanges.

  // Internal exchanges are used to construct wiring that is not visible to applications.
  internal: false,
}

export const exchangeDelete: Omit<ExchangeDeleteOptions, 'exchange'> = {
  ifUnused: false,
  noWait: false,
}

export const queueDelete: Omit<QueueDeleteOptions, 'queue'> = {
    // If set, the server will only delete the queue if it has no consumers. 
    // If the queue has consumers the server does does not delete it but raises a channel exception instead.
    ifUnused: false,

    // If set, the server will only delete the queue if it has no messages.
    ifEmpty: true,
    noWait: false,
}
  
export const queue: Omit<QueueOptions, 'queue'> = {
  autoDelete: true,
  noWait:    false,
  exclusive: false,
  durable:   false,
  passive:   false,
  arguments: {},
}