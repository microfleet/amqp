/* eslint-disable max-classes-per-file */

import bson = require('bson')
import { MethodFrameBasicDeliver } from '@microfleet/amqp-codec'
import type { Consumer } from './consumer'
import { assert } from 'console'

export type IncomingMessage = MethodFrameBasicDeliver['args']

export interface MessageProperties {
  headers?: Record<string, any> // amqp headers
  appId?: string // sender diagnostics data
  replyTo?: string // amqp reply-to field
  correlationId?: string // amqp correlation-id
  contentType?: string // amqp message content-type
  contentEncoding?: string // amqp message content-encoding
  userId?: string
  type?: string
  messageId?: string
  timestamp?: Date
  priority?: number
  expiration?: string
}

export type parseFunction<T, R> = {
  (data: T): R
}

const safeParse = <R>(fn: parseFunction<Buffer, R>, data: Buffer, contentType: string): R | Buffer => {
  try {
    return fn(data)
  } catch (e) {
    process.emitWarning(`data parse to ${contentType} failed`, {
      code: 'E_AMQP_PARSE_FAILED',
      detail: data.slice(0, Math.min(50, data.length - 1)).toString() + '...', // print 50 chars at most
    })
    return data
  }
}

const JSONParse = (x: Buffer) => JSON.parse(x.toString())
const BSONParse = (x: Buffer) => bson.deserialize(x)
const StringParse = (x: Buffer) => x.toString('utf8')

const toJSON = (data: Buffer) => {
  return safeParse(JSONParse, data, 'application/json')
}

const toBSON = (data: Buffer) => {
  return safeParse(BSONParse, data, 'application/bson')
}

const toString = (data: Buffer) => {
  return safeParse(StringParse, data, 'string/utf8')
}

const emptyBuffer = Buffer.alloc(0)

export const kSub = Symbol.for('@microfleet/amqp-coffee:subscription')
export const kData = Symbol.for('@microfleet/amqp-coffee:data')
export const kUsed = Symbol.for('@microfleet/amqp-coffee:used')
export const kArbitrary = Symbol('@microfleet/amqp-coffee:arbitrary')
export class Message {
  public properties: MessageProperties
  public readonly raw: Buffer
  public readonly size: number
  public readonly deliveryTag?: number
  public readonly routingKey?: string
  public readonly exchange: string
  public readonly redelivered: boolean
  public readonly consumerTag: string
  public readonly [kSub]: Consumer
  
  // for extending messages if we need it
  private [kArbitrary]: Map<any, any> | null = null

  constructor(factory: MessageFactory, subscription: Consumer) {
    const { properties, args, size } = factory

    // message content
    this.raw = factory[kData] || emptyBuffer

    // msg properties
    this.properties = properties

    // base data
    this.size = size
    this.deliveryTag = args.deliveryTag
    this.routingKey = args.routingKey
    this.exchange = args.exchange
    this.redelivered = args.redelivered
    this.consumerTag = args.consumerTag

    // for ack/reject/retry handlers
    this[kSub] = subscription
  }

  get data() {
    const { contentType } = this.properties
    const { raw, size } = this

    // eslint-disable-next-line default-case
    switch (contentType) {
      case 'application/json': return toJSON(raw)
      case 'application/bson': return toBSON(raw)
      case 'string/utf8': return toString(raw)
      case 'application/undefined': return size === 0 ? undefined : raw
    }

    return raw
  }

  multiAck() {
    if (this.deliveryTag !== undefined) {
      this[kSub].multiAck(this.deliveryTag)
    }
  }

  ack() {
    if (this.deliveryTag !== undefined) {
      this[kSub].ack(this.deliveryTag)
    }
  }

  reject() {
    if (this.deliveryTag !== undefined) {
      this[kSub].reject(this.deliveryTag)
    }
  }

  retry() {
    if (this.deliveryTag !== undefined) {
      this[kSub].retry(this.deliveryTag)
    }
  }

  extendMessage(key: any, value: any): void {
    if (this[kArbitrary] === null) {
      this[kArbitrary] = new Map([[key, value]])
    } else {
      this[kArbitrary]?.set(key, value)
    }
  }

  readExtendedAttributes(): IterableIterator<[any, any]> | undefined
  readExtendedAttributes(key: any): undefined | any
  readExtendedAttributes(key?: any): IterableIterator<[any, any]> | undefined | any {
    if (!key) {
      return this[kArbitrary]?.entries()
    }

    return this[kArbitrary]?.get(key)
  }
}

export class MessageFactory {
  public weight = 0
  public size = 0
  public properties!: MessageProperties
  public [kUsed] = 0
  public [kData]: Buffer | null = null

  constructor(public args: IncomingMessage) {

  }

  setProperties(weight: number, size: number, properties = Object.create(null)) {
    this.weight = weight
    this.size = size
    this.properties = properties
  }

  evaluateMaxFrame(maxFrame: number) {
    // if we're only expecting one packet lets just copy the buffer when we get it
    // otherwise lets create a new incoming data buffer and pre alloc the space
    if (this.size > maxFrame) {
      this[kData] = Buffer.allocUnsafe(this.size)
    }
  }

  /**
   * Handles incoming data that is used to construct message further
   * down the road
   * @param {Buffer} chunk
   */
  handleChunk(chunk: Buffer): void {
    const { size } = this
    const { length } = chunk
    const currentBuf = this[kData]

    if (currentBuf === null && size === length) {
      this[kData] = chunk
      this[kUsed] = length
    } else if (currentBuf) {
      // if there are multiple packets just copy the data starting from the last used bit.
      const used = this[kUsed]
      chunk.copy(currentBuf, used)
      this[kUsed] = used + length
    } else {
      assert('invalid data handling logic')
    }
  }

  /**
   * Signals that message is ready to be parsed
   */
  ready(): boolean {
    return this[kUsed] >= this.size || this.size == 0
  }

  /**
   * Returns parsed message instance
   * @param {Consumer} subscription
   * @returns
   */
  create(subscription: Consumer): Message {
    return new Message(this, subscription)
  }
}
