// Exchange
import { methods } from '@microfleet/amqp-codec'
import { strict as assert } from 'assert'
import applyDefaults = require('lodash/defaults')
import type { Channel, InferOptions } from './channel'
import * as defaults from './defaults'

export type ExchangeDeclareOptions = InferOptions<typeof methods.exchangeDeclare>
export type ExchangeDeclareResponse = InferOptions<typeof methods.exchangeDeclareOk>

export type ExchangeDeleteOptions = InferOptions<typeof methods.exchangeDelete>
export type ExchangeDeleteResponse = InferOptions<typeof methods.exchangeDeleteOk>

export type ExchangeBindOptions = InferOptions<typeof methods.exchangeBind>
export type ExchangeBindResponse = InferOptions<typeof methods.exchangeBindOk>

export type ExchangeUnbindOptions = InferOptions<typeof methods.exchangeUnbind>
export type ExchangeUnbindResponse = InferOptions<typeof methods.exchangeUnbindOk>

export class Exchange {
  public readonly exchangeOptions: ExchangeDeclareOptions
  public channel: Channel

  constructor(
    channel: Channel, 
    args: Partial<ExchangeDeclareOptions> & { name?: string }
  ) {
    let { exchange } = args
    if (exchange == null && args.name != null) {
      exchange = args.name
      delete args.name
    }

    assert(exchange, 'args.exchange is requried')

    this.exchangeOptions = applyDefaults({ exchange }, args, defaults.exchange)
    this.channel = channel
  }

  public async declare(args: Partial<ExchangeDeclareOptions> = {}): Promise<ExchangeDeclareResponse> {
    const declareOptions = applyDefaults(args, this.exchangeOptions)
    return this.channel
      .taskPushAsync(methods.exchangeDeclare, declareOptions, methods.exchangeDeclareOk)
  }

  public async delete(args: Partial<ExchangeDeleteOptions> = {}): Promise<ExchangeDeleteResponse> {
    const exchangeDeleteOptions = applyDefaults(
      {},
      args,
      defaults.exchangeDelete,
      { exchange: this.exchangeOptions.exchange }
    )

    return this.channel
      .taskPushAsync(methods.exchangeDelete, exchangeDeleteOptions, methods.exchangeDeleteOk)
  }

  public async bind(destExchange: string, routingKey: string, sourceExchange?: string): Promise<ExchangeBindResponse> {
    const sourceExchangeName = typeof sourceExchange === 'string'
      ? sourceExchange
      : this.exchangeOptions.exchange

    const exchangeBindOptions: ExchangeBindOptions = {
      destination: destExchange,
      source: sourceExchangeName,
      routingKey,
      arguments: {},
      noWait: false
    }

    return this.channel
      .taskPushAsync(methods.exchangeBind, exchangeBindOptions, methods.exchangeBindOk)
  }

  public async unbind(destExchange: string, routingKey: string, sourceExchange?: string): Promise<ExchangeUnbindResponse> {
    const sourceExchangeName = typeof sourceExchange === 'string'
      ? sourceExchange
      : this.exchangeOptions.exchange

    const exchangeUnbindOptions: ExchangeUnbindOptions = {
      destination: destExchange,
      source: sourceExchangeName,
      routingKey,
      arguments: {},
      noWait: false,
    }

    return this.channel.taskPushAsync(methods.exchangeUnbind, exchangeUnbindOptions, methods.exchangeUnbindOk)
  }
}
