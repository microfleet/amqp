/**
 * @typedef IncomingMessage
 * @property {string} consumerTag
 * @property {number} deliveryTag
 * @property {boolean} redelivered
 * @property {exchange} string
 * @property {string} routingKey
 */

const bson = require('bson')

const safeParse = (fn, data, contentType) => {
  try {
    return fn(data)
  } catch (e) {
    process.emitWarning(`data parse to ${contentType} failed`, {
      code: 'E_AMQP_PARSE_FAILED',
      originalDdata: data,
    })
    return data
  }
}

const JSONParse = (x) => JSON.parse(x)
const BSONParse = (x) => bson.deserialize(x)
const StringParse = (x) => x.toString('utf8')

const toJSON = (data) => {
  return safeParse(JSONParse, data, 'application/json')
}

const toBSON = (data) => {
  return safeParse(BSONParse, data, 'application/bson')
}

const toString = (data) => {
  return safeParse(StringParse, data, 'string/utf8')
}

const emptyBuffer = Buffer.alloc(0)

const kSub = Symbol.for('@microfleet/amqp-coffee:subscription')
const kData = Symbol.for('@microfleet/amqp-coffee:data')
const kUsed = Symbol.for('@microfleet/amqp-coffee:used')

class MessageFactory {
  /**
   * @param {IncomingMessage} args
   */
  constructor(args) {
    this.weight = 0
    this.size = 0
    this.args = args
    this.properties = null

    this[kUsed] = 0
    this[kData] = null
  }

  setProperties(weight, size, properties = Object.create(null)) {
    this.weight = weight
    this.size = size
    this.properties = properties
  }

  evaluateMaxFrame(maxFrame) {
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
  handleChunk(chunk) {
    const { size } = this
    const { length } = chunk

    if (this[kData] === null && size === length) {
      this[kData] = chunk
      this[kUsed] = length
    } else {
      // if there are multiple packets just copy the data starting from the last used bit.
      const used = this[kUsed]
      chunk.copy(this[kData], used)
      this[kUsed] = used + length
    }
  }

  /**
   * Signals that message is ready to be parsed
   * @returns {boolean}
   */
  ready() {
    return this[kUsed] >= this.size || this.size == 0
  }

  /**
   * Returns parsed message instance
   * @param {Consumer} subscription 
   * @returns 
   */
  create(subscription) {
    return new Message(this, subscription)
  }
}

class Message {
  constructor(factory, subscription) {
    const { properties, args, size } = factory

    // message content
    this.raw = size === 0
      ? emptyBuffer
      : factory[kData]

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

    switch (contentType) {
      case 'application/json': return toJSON(raw)
      case 'application/bson': return toBSON(raw)
      case 'string/utf8': return toString(raw)
      case 'application/undefined': return size === 0 ? undefined : raw
    }

    return raw
  }

  ack() {
    return this[kSub].ack(this.deliveryTag)
  }

  reject() {
    return this[kSub].reject(this.deliveryTag)
  }

  retry() {
    return this[kSub].retry(this.deliveryTag)
  }
}

module.exports = { MessageFactory, Message }
