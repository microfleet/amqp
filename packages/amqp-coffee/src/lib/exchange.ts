// Exchange
import { methods } from '@microfleet/amqp-codec'
import { strict as assert } from 'assert'
import applyDefaults = require('lodash/defaults')
import type { AMQPResponse, Channel, InferOptions } from './channel'
import * as defaults from './defaults'

export type ExchangeDeclareOptions = InferOptions<typeof methods.exchangeDeclare>
export type ExchangeDeclareCb = AMQPResponse<typeof methods.exchangeDeclareOk>

export type ExchangeDeleteOptions = InferOptions<typeof methods.exchangeDelete>
export type ExchangeDeleteCb = AMQPResponse<typeof methods.exchangeDeleteOk>

export type ExchangeBindOptions = InferOptions<typeof methods.exchangeBind>
export type ExchangeBindCb = AMQPResponse<typeof methods.exchangeBindOk>

export type ExchangeUnbindOptions = InferOptions<typeof methods.exchangeUnbind>
export type ExchangeUnbindCb = AMQPResponse<typeof methods.exchangeUnbindOk>

export class Exchange {
  private readonly exchangeOptions: ExchangeDeclareOptions
  private taskPush: Channel['taskPush']

  constructor(
    channel: Channel, 
    args: Partial<ExchangeDeclareOptions> & { name?: string }, 
    cb?: (err: Error | null, res?: Exchange) => void
  ) {
    let { exchange } = args
    if (exchange == null && args.name != null) {
      exchange = args.name
      delete args.name
    }

    assert(exchange, 'args.exchange is requried')

    this.exchangeOptions = applyDefaults({ exchange }, args, defaults.exchange)
    this.taskPush = channel.taskPush

    cb?.(null, this)
  }

  declare(args?: ExchangeDeclareCb): Exchange
  declare(args: Partial<ExchangeDeclareOptions>, cb?: ExchangeDeclareCb): Exchange
  declare(args?: Partial<ExchangeDeclareOptions> | ExchangeDeclareCb, cb?: ExchangeDeclareCb): Exchange {
    let declareOptions: ExchangeDeclareOptions
    if (args == null && cb == null) {
      declareOptions = this.exchangeOptions
    } else if (typeof args === 'function') {
      cb = args
      args = {}
      declareOptions = this.exchangeOptions
    } else {
      declareOptions = applyDefaults(args, this.exchangeOptions)
    }

    this.taskPush(methods.exchangeDeclare, declareOptions, methods.exchangeDeclareOk, cb)
    return this
  }

  delete(args: ExchangeDeleteCb): Exchange
  delete(args: Partial<ExchangeDeleteOptions> | ExchangeDeleteCb, cb?: ExchangeDeleteCb): Exchange {
    if (typeof args === 'function') {
      cb = args
      args = {}
    }

    const exchangeDeleteOptions = applyDefaults(
      {},
      args,
      defaults.exchangeDelete,
      { exchange: this.exchangeOptions.exchange }
    )

    this.taskPush(methods.exchangeDelete, exchangeDeleteOptions, methods.exchangeDeleteOk, cb)

    return this
  }

  bind(destExchange: string, routingKey: string, sourceExchange?: ExchangeBindCb): Exchange
  bind(destExchange: string, routingKey: string, sourceExchange?: string | ExchangeBindCb, cb?: ExchangeBindCb): Exchange {
    const sourceExchangeName = typeof sourceExchange === 'string'
      ? sourceExchange
      : this.exchangeOptions.exchange

    if (typeof sourceExchange === 'function') {
      cb = sourceExchange
    }

    const exchangeBindOptions: ExchangeBindOptions = {
      destination: destExchange,
      source: sourceExchangeName,
      routingKey,
      arguments: {},
      noWait: false
    }

    this.taskPush(methods.exchangeBind, exchangeBindOptions, methods.exchangeBindOk, cb)
    return this
  }

  unbind(destExchange: string, routingKey: string, sourceExchange?: ExchangeUnbindCb): Exchange
  unbind(destExchange: string, routingKey: string, sourceExchange?: string | ExchangeUnbindCb, cb?: ExchangeUnbindCb): Exchange {
    let sourceExchangeName: string
    if (typeof sourceExchange === 'string') {
      sourceExchangeName = sourceExchange
    } else {
      cb = sourceExchange
      sourceExchangeName = this.exchangeOptions.exchange
    }

    const exchangeUnbindOptions: ExchangeUnbindOptions = {
      destination: destExchange,
      source: sourceExchangeName,
      routingKey,
      arguments: {},
      noWait: false,
    }

    this.taskPush(methods.exchangeUnbind, exchangeUnbindOptions, methods.exchangeUnbindOk, cb)
    return this
  }
}
