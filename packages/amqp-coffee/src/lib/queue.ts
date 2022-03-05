// Queues
import applyDefaults = require('lodash/defaults')
import { methods } from '@microfleet/amqp-codec'
import { AMQPResponse, Channel, InferOptions } from './channel'

import { debug as _debug } from './config'
import * as defaults from './defaults'

const debug = _debug('amqp:Queue')

export interface QueueOptions extends QueueDeclareOptions {  
  // optional
  name?: string
}

export type QueueUnbindOptions = InferOptions<typeof methods.queueUnbind>
export type QueueUnbindArgs = QueueUnbindOptions['arguments']
export type QueueUnbindResponse = InferOptions<typeof methods.queueUnbindOk>

export type QueueBindOptions = InferOptions<typeof methods.queueBind>
export type QueueBindResponse = InferOptions<typeof methods.queueBindOk>
export type QueueBindArgs = QueueBindOptions['arguments']

export type QueueDeclareOptions = InferOptions<typeof methods.queueDeclare>
export type QueueDeclareResponse = InferOptions<typeof methods.queueDeclareOk>

export type QueueMessageCountCb = AMQPResponse<typeof methods.queueDeclareOk, number>
export type QueueConsumerCountCb = AMQPResponse<typeof methods.queueDeclareOk, number>

export type QueueDeleteOptions = InferOptions<typeof methods.queueDelete>
export type QueueDeleteResponse = InferOptions<typeof methods.queueDeleteOk>

export class Queue {
  public readonly queueOptions: QueueDeclareOptions
  public readonly channel: Channel

  constructor(channel: Channel, args: Partial<QueueOptions>) {
    debug(3, () => ['New queue', JSON.stringify(args)])

    if (args.queue == null && args.name != null) {
      args.queue = args.name
      delete args.name
    }

    const { queue } = args
    if (queue == null) {
      throw new Error('args.queue is required')
    }

    this.queueOptions = applyDefaults({ queue }, args, defaults.queue)
    this.channel = channel
  }

  async declare(args: Partial<QueueDeclareOptions> = {}): Promise<QueueDeclareResponse> {  
    const queueNameSpecified = !!args.queue
    const declareOptions: QueueDeclareOptions = applyDefaults(args, this.queueOptions)
    const res = await this.channel.taskPushAsync(methods.queueDeclare, declareOptions, methods.queueDeclareOk)

    if (!queueNameSpecified) {
      this.queueOptions.queue = res.queue
    }

    return res
  }

  async bind(exchange: string, routingKey: string, opts?: string | Partial<QueueBindOptions>): Promise<QueueBindResponse> {
    let queueName: string
    let args: QueueBindArgs

    if (typeof opts === 'string') {
      queueName = opts
      args = {}
      // cb is either undefined or present, both are good opts
    } else if (opts !== null && typeof opts === 'object') {
      // neither string or function means its either
      args = opts.arguments || {}
      queueName = opts.queue || this.queueOptions.queue
    } else {
      args = {}
      queueName = this.queueOptions.queue
    }

    const queueBindOptions: QueueBindOptions = {
      queue: queueName,
      exchange,
      routingKey,
      arguments: args,
      noWait: false
    }

    return this.channel.taskPushAsync(methods.queueBind, queueBindOptions, methods.queueBindOk)
  }

  unbind(exchange: string, routingKey: string, _queueName?: string): Promise<QueueUnbindResponse> {
    const queueName = _queueName ?? this.queueOptions.queue
    const queueUnbindOptions: QueueUnbindOptions = {
      queue: queueName,
      exchange,
      routingKey,
      arguments: {},
    }

    return this.channel.taskPushAsync(methods.queueUnbind, queueUnbindOptions, methods.queueUnbindOk)
  }

  async messageCount(args: Partial<QueueDeclareOptions> = {}): Promise<number> {
    const declareOptions = applyDefaults(args, this.queueOptions)
    const { messageCount } = await this.declare(declareOptions)
    return messageCount
  }

  async consumerCount(args: Partial<QueueDeclareOptions> = {}): Promise<number> {
    const declareOptions = applyDefaults(args, this.queueOptions)
    const { consumerCount } = await this.declare(declareOptions)
    return consumerCount
  }

  async delete(args: Partial<QueueDeleteOptions> = {}): Promise<QueueDeleteResponse> {
    const queueDeleteArgs = applyDefaults(args, defaults.queueDelete, { queue: this.queueOptions.queue })
    return this.channel.taskPushAsync(methods.queueDelete, queueDeleteArgs, methods.queueDeleteOk)
  }
}
