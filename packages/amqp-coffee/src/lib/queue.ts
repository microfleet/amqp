// Queues
import applyDefaults = require('lodash/defaults')
import { methods } from '@microfleet/amqp-codec'
import { AMQPResponse, Channel, InferOptions } from './channel'

import { debug as _debug } from './config'
import * as defaults from './defaults'
import { strict as assert } from 'assert'

const debug = _debug('amqp:Queue')

export interface QueueOptions extends QueueDeclareOptions {  
  // optional
  name?: string
}

export type QueueUnbindOptions = InferOptions<typeof methods.queueUnbind>
export type QueueUnbindArgs = QueueUnbindOptions['arguments']
export type QueueUnbindCb = AMQPResponse<typeof methods.queueUnbindOk>

export type QueueBindOptions = InferOptions<typeof methods.queueBind>
export type QueueBindCb = AMQPResponse<typeof methods.queueBindOk>
export type QueueBindArgs = QueueBindOptions['arguments']

export type QueueDeclareOptions = InferOptions<typeof methods.queueDeclare>
export type QueueDeclareCb = AMQPResponse<typeof methods.queueDeclareOk>
export type QueueDeclareArgs = QueueDeclareOptions['arguments']

export type QueueMessageCountCb = AMQPResponse<typeof methods.queueDeclareOk, number>
export type QueueConsumerCountCb = AMQPResponse<typeof methods.queueDeclareOk, number>

export type QueueDeleteOptions = InferOptions<typeof methods.queueDelete>
export type QueueDeleteCb = AMQPResponse<typeof methods.queueDeleteOk>

export class Queue {
  public readonly queueOptions: QueueDeclareOptions
  private taskPush: Channel['taskPush']

  constructor(channel: Channel, args: QueueOptions, cb?: (err: Error | null, queue?: Queue) => void) {
    debug(3, () => ['New queue', JSON.stringify(args)])

    if (args.queue == null && args.name != null) {
      args.queue = args.name
      delete args.name
    }

    if (args.queue == null) {
      throw new Error('args.queue is required')
    }

    this.queueOptions = applyDefaults(args, defaults.queue)
    this.taskPush = channel.taskPush

    if (cb) {
      setImmediate(cb, null, this)
    }
  }

  declare(args: QueueDeclareCb): Queue
  declare(args: Partial<QueueDeclareOptions>, cb?: QueueDeclareCb): Queue
  declare(args: QueueDeclareCb | Partial<QueueDeclareOptions> = {}, cb?: QueueDeclareCb): Queue {  
    let declareOptions: QueueDeclareOptions
    let queueNameSpecified = false

    if (typeof args === 'function') {
      cb = args
      args = {}
      declareOptions = { ...this.queueOptions }
    } else {
      queueNameSpecified = !!args.queue
      declareOptions = applyDefaults(args, this.queueOptions)
    }

    this.taskPush(methods.queueDeclare, declareOptions, methods.queueDeclareOk, (err, res) => {
      if (!queueNameSpecified && !err && res?.queue != null) {
        this.queueOptions.queue = res.queue
      }

      cb?.(err, res)
    })

    return this
  }

  bind(exchange: string, routingKey: string, opts?: string, _cb?: QueueBindCb): Queue
  bind(exchange: string, routingKey: string, opts?: QueueBindOptions, _cb?: QueueBindCb): Queue
  bind(exchange: string, routingKey: string, opts?: QueueBindCb): Queue
  bind(exchange: string, routingKey: string, opts?: string | QueueBindOptions | QueueBindCb, _cb?: QueueBindCb): Queue {
    let queueName: string
    let args: QueueBindArgs
    let cb: QueueBindCb | undefined = _cb

    if (typeof opts === 'function') {
      cb = opts
      queueName = this.queueOptions.queue
      args = {}
    } else if (typeof opts === 'string') {
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

    this.taskPush(methods.queueBind, queueBindOptions, methods.queueBindOk, cb)

    return this
  }

  unbind(exchange: string, routingKey: string, _queueName: QueueUnbindCb): Queue
  unbind(exchange: string, routingKey: string, _queueName: string, _cb?: QueueUnbindCb): Queue
  unbind(exchange: string, routingKey: string, _queueName: string | QueueUnbindCb, _cb?: QueueUnbindCb): Queue {
    let cb: QueueUnbindCb | undefined = _cb
    let queueName: string

    if (typeof _queueName !== 'string') {
      cb = _queueName
      queueName = this.queueOptions.queue
    } else {
      queueName = _queueName
    }

    const queueUnbindOptions: QueueUnbindOptions = {
      queue: queueName,
      exchange,
      routingKey,
      arguments: {},
    }

    this.taskPush(methods.queueUnbind, queueUnbindOptions, methods.queueUnbindOk, cb)

    return this
  }

  messageCount(args: QueueMessageCountCb): Queue
  messageCount(args: Partial<QueueDeclareOptions>, _cb: QueueMessageCountCb): Queue
  messageCount(args: QueueMessageCountCb | Partial<QueueDeclareOptions>, _cb?: QueueMessageCountCb): Queue {
    let cb: QueueMessageCountCb
    if (typeof args === 'function') {
      cb = args
      args = {}
    } else {
      assert(_cb)
      cb = _cb
    }

    const declareOptions = applyDefaults(args, this.queueOptions)

    return this.declare(declareOptions, (err, res) => {
      if (err) {
        cb(err)
        return
      }

      if (res?.messageCount != null) {
        cb(null, res.messageCount)
      } else {
        cb(new Error('messageCount not returned'))
      }
    })
  }

  consumerCount(args: QueueConsumerCountCb): Queue
  consumerCount(args: Partial<QueueDeclareOptions>, _cb: QueueConsumerCountCb): Queue
  consumerCount(args: QueueConsumerCountCb | Partial<QueueDeclareOptions> = {}, _cb?: QueueConsumerCountCb): Queue {
    let cb: QueueConsumerCountCb
    if (typeof args === 'function') {
      cb = args
      args = {}
    } else {
      assert(_cb)
      cb = _cb
    }

    const declareOptions = applyDefaults(args, this.queueOptions)

    return this.declare(declareOptions, (err, res) => {
      if (err) {
        cb(err)
        return
      }

      if (res?.consumerCount != null) {
        cb(null, res.consumerCount)
      } else {
        cb(new Error('consumerCount not returned'))
      }
    })
  }

  delete(args: QueueDeleteCb): Queue
  delete(args: Partial<QueueDeleteOptions>, cb?: QueueDeleteCb): Queue
  delete(args: Partial<QueueDeleteOptions> | QueueDeleteCb = {}, cb?: QueueDeleteCb): Queue {
    if (typeof args === 'function') {
      cb = args
      args = {}
    }

    const queueDeleteArgs = applyDefaults(args, defaults.queueDelete, { queue: this.queueOptions.queue })
    this.taskPush(methods.queueDelete, queueDeleteArgs, methods.queueDeleteOk, cb)

    return this
  }
}
