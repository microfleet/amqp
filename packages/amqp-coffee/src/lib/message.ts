/* eslint-disable max-classes-per-file */

import bson = require('bson')
import { strict as assert } from 'node:assert'
import {  Transform } from 'node:stream'
import { createBrotliDecompress, createGunzip } from 'node:zlib'
import BufferListStream from 'bl'
import { MethodFrameBasicDeliver } from '@microfleet/amqp-codec'
import type { Consumer } from './consumer'

export type IncomingMessage = MethodFrameBasicDeliver['args']



// <!--  MIME typing -->
// <field name = "content-type"    domain = "shortstr"   label = "MIME content type" />
// <!--  MIME typing -->
// <field name = "content-encoding" domain = "shortstr"  label = "MIME content encoding" />
// <!--  For applications, and for header exchange routing -->
// <field name = "headers"         domain = "table"      label = "message header field table" />
// <!--  For queues that implement persistence -->
// <field name = "delivery-mode"   domain = "octet"      label = "non-persistent (1) or persistent (2)" />
// <!--  For queues that implement priorities -->
// <field name = "priority"        domain = "octet"      label = "message priority, 0 to 9" />
// <!--  For application use, no formal behaviour -->
// <field name = "correlation-id"  domain = "shortstr"   label = "application correlation identifier" />
// <!--  For application use, no formal behaviour but may hold the
//       name of a private response queue, when used in request messages -->
// <field name = "reply-to"        domain = "shortstr"   label = "address to reply to" />
// <!--  For implementation use, no formal behaviour -->
// <field name = "expiration"      domain = "shortstr"   label = "message expiration specification" />
// <!--  For application use, no formal behaviour -->
// <field name = "message-id"      domain = "shortstr"   label = "application message identifier" />
// <!--  For application use, no formal behaviour -->
// <field name = "timestamp"       domain = "timestamp"  label = "message timestamp" />
// <!--  For application use, no formal behaviour -->
// <field name = "type"            domain = "shortstr"   label = "message type name" />
// <!--  For application use, no formal behaviour -->
// <field name = "user-id"         domain = "shortstr"   label = "creating user id" />
// <!--  For application use, no formal behaviour -->
// <field name = "app-id"          domain = "shortstr"   label = "creating application id" />
// <!--  Deprecated, was old cluster-id property -->
// <field name = "reserved"        domain = "shortstr"   label = "reserved, must be empty" />
export interface MessageProperties {
  deliveryMode: 1 | 2
  confirm: boolean
  mandatory: boolean
  immediate: boolean
  headers: Record<string, any> // amqp headers
  appId?: string // sender diagnostics data
  replyTo?: string // amqp reply-to field
  correlationId?: string // amqp correlation-id
  contentType?: string // amqp message content-type
  contentEncoding?: string // amqp message content-encoding
  userId?: string
  // message type, optional use
  type?: string
  // message id, optional use
  messageId?: string
  // timestamp, optional use
  timestamp?: Date | null
  priority?: number
  expiration?: string
  exchange: string
  routingKey: string
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
      detail: data.subarray(0, Math.min(50, data.length - 1)).toString() + '...', // print 50 chars at most
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
export const kDecoder = Symbol.for('@microfleet/amqp-coffee:decoder')
export const kError = Symbol.for('@microfleet/amqp-coffee:error')
export const kFinished = Symbol.for('@microfleet/amqp-coffee:finished')
export const kArbitrary = Symbol('@microfleet/amqp-coffee:arbitrary')

export class Message {
  public properties: MessageProperties
  public readonly raw: Buffer | Error
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
    this.raw = factory[kData] || factory[kError] || emptyBuffer

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

    if (raw instanceof Error) {
      return raw
    }

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

function prepareBufferStream(factory: MessageFactory, decoder: Transform): void {
  factory[kDecoder] = decoder
  factory[kFinished] = new Promise<void>((resolve) => {
    decoder.pipe(new BufferListStream((err: Error | null, data: Buffer) => {
      if (err) {
        factory[kError] = err
        resolve()
        return
      }

      factory[kData] = data
      resolve()
    }))
  })
}

export class MessageFactory {
  public weight = 0
  public size = 0
  public properties!: MessageProperties
  public [kUsed] = 0
  public [kData]: Buffer | null = null
  public [kDecoder]: Transform | null = null
  public [kError]: Error | null = null
  public [kFinished]: Promise<void> | null = null

  constructor(public args: IncomingMessage) {

  }

  setProperties(weight: number, size: number, properties = Object.create(null)) {
    this.weight = weight
    this.size = size
    this.properties = properties
    const { contentEncoding } = this.properties
    
    if (size > 0) {
      // we'll perform streaming decompression and set encoding to plain for further processing
      // based on contentType
      if (contentEncoding === 'gzip') {
        prepareBufferStream(this, createGunzip())
        this.properties.contentEncoding = 'plain'
      } else if (contentEncoding === 'br') {
        prepareBufferStream(this, createBrotliDecompress())
        this.properties.contentEncoding = 'plain'
      }
    }
  }

  evaluateMaxFrame(maxFrame: number) {
    // if we're only expecting one packet lets just copy the buffer when we get it
    // otherwise lets create a new incoming data buffer and pre alloc the space
    if (this.size > maxFrame && this[kDecoder] === null) {
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
    const decoder = this[kDecoder]
    const used = this[kUsed]

    // update used size
    this[kUsed] = used + length

    if (decoder !== null) {
      decoder[this[kUsed] >= size ? 'end' : 'write'](chunk)
    } else if (currentBuf === null && size === length) {
      this[kData] = chunk
    } else if (currentBuf) {
      // if there are multiple packets just copy the data starting from the last used bit.
      chunk.copy(currentBuf, used)
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

  cleanup() {
    this[kData] = null
    this[kError] = null
    this[kFinished] = null
    this[kDecoder]?.destroy()
  }

  /**
   * Returns parsed message instance
   * @param {Consumer} subscription
   * @returns
   */
  create(subscription: Consumer): void {
    if (this[kData] === null && this[kDecoder] !== null) {
      this[kFinished]!.then(() => this.create(subscription))
      return
    }

    subscription._onMessageCreated(new Message(this, subscription))
  }
}
