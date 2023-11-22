import reusify from 'reusify'
import { MessageProperties } from '@microfleet/amqp-coffee'
import { Publish as PublishSettings, DefaultPublishOptions } from '../schema'

export type NormalizedPublishProperties = {
  // base options that will be re-integrated into messageProperties
  gzip: boolean
  skipSerialize: boolean
  simpleResponse: boolean
  cache: number
  cacheError: boolean | ((err: Error) => boolean)
  timeout: number

  // messageProperties
  messageProperties: MessageProperties

  release(): void
  setDefaultOpts(opts: DefaultPublishOptions): void
  setOptions(defaultExchange: string, routingKey: string, options: PublishSettings | undefined): void
}

export const publishOptionsFactory = reusify<NormalizedPublishProperties>(PublishOptionsFactoryObject)

const { hasOwnProperty } = Object.prototype

export class MessagePropertiesFactory implements MessageProperties {
  public confirm
  public mandatory
  public immediate
  public deliveryMode
  public headers
  public appId
  public contentType
  public contentEncoding

  public exchange = ''
  public correlationId = ''
  public priority = 0
  public routingKey = ''
  public readonly reuse = true

  constructor(opts: DefaultPublishOptions) {
    // delivery props
    this.confirm = opts.confirm
    this.mandatory = opts.mandatory
    this.immediate = opts.immediate
    this.deliveryMode = opts.deliveryMode

    // copy default props
    this.appId = opts.appId
    this.contentType = opts.contentType
    this.contentEncoding = opts.contentEncoding
    this.headers = { ...opts.headers }
    this.priority = opts.priority
  }

  // optional props
  // public exchange?: string
  // public replyTo?: string
  // public expiration?: string
  // public messageId?: MessageProperties['messageId']
  // public type?: MessageProperties['type']
  // public userId?: MessageProperties['userId']
}

export const kMessagePropertyKeys = [
  'confirm',  'mandatory',  'immediate',  'deliveryMode',  
  'headers',  'appId',  'replyTo',  'correlationId',  'contentType',  
  'contentEncoding',  'timestamp',  'priority',  'expiration',  
  'exchange',  'routingKey',  'messageId',  'type',  'userId'
] as const

export const kMessagePropertyFinder: Record<keyof typeof kMessagePropertyKeys, true> = Object.setPrototypeOf(Object.fromEntries(kMessagePropertyKeys.map(key => [key, true])), null)

export function PublishOptionsFactoryObject(this: NormalizedPublishProperties) {
  this.gzip = false
  this.skipSerialize = false
  this.simpleResponse = true
  this.cache = -1
  this.cacheError = false
  this.timeout = -1

  // delivery modes
  // + message properties
  // @ts-expect-error - to make sure hidden class map is correct
  this.messageProperties = null

  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const that = this

  this.release = function release() {
    // delivery modes
    // + message properties
    // @ts-expect-error - to make sure hidden class map is correct
    that.messageProperties = null
    
    // reset certain props to default
    that.cacheError = false // no defaults for that, reset each time
    
    publishOptionsFactory.release(that)
  }

  this.setOptions = function setOptions(defaultExchange: string, routingKey: string, options: PublishSettings | undefined) {
    const { messageProperties } = that

    // done
    if (!options) {
      if (!messageProperties.exchange) {
        messageProperties.exchange = defaultExchange
      }
      if (!messageProperties.routingKey) {
        messageProperties.routingKey = routingKey
      }
      return
    }

    // iterate over keys in options
    for (const key in options) {
      // verify that this key is own in options & is allowed on the property list
      if (hasOwnProperty.call(options, key)) {
        if (hasOwnProperty.call(kMessagePropertyFinder, key)) {
          // @ts-expect-error - infer doesn't work properly
          messageProperties[key] = options[key]
        } else if (hasOwnProperty.call(that, key)) {
          // @ts-expect-error - infer doesn't work properly
          that[key] = options[key]
        }
      }
    }

    messageProperties.exchange = options.exchange || defaultExchange
    messageProperties.routingKey = options.routingKey || routingKey

    // extra logic for timeout
    if (that.timeout > 0 && !messageProperties.expiration) {
      const timeout = that.timeout
      messageProperties.headers.timeout = timeout
      messageProperties.expiration = Math.ceil(timeout * 0.9).toString()
    }

    if (that.gzip === true) {
      messageProperties.contentEncoding = 'gzip'
    }
  }

  this.setDefaultOpts = function setDefaultOpts(opts: DefaultPublishOptions) {
    // specify default options that are not part of message propertis
    that.cache = opts.cache
    that.gzip = opts.gzip
    that.simpleResponse = opts.simpleResponse
    that.timeout = opts.timeout
    that.skipSerialize = opts.skipSerialize
  
    // assign property now
    that.messageProperties = new MessagePropertiesFactory(opts)
  }
}
