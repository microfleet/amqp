import { AMQPTransport } from "./"
import { Message, MessageProperties } from "@microfleet/amqp-coffee"

export interface ResponseHandler {
  (error: Error | null, data: any): Promise<void>
}

export type ExtendedMessageProperties = MessageProperties 
  & Pick<Message, 'deliveryTag' | 'routingKey' | 'redelivered' | 'exchange'>

export type MessageConsumerLegacy = 
  (data: any, properties: ExtendedMessageProperties, raw: Message, responseHandler: ResponseHandler) => Promise<void> | void

export type MessageConsumerModern = 
  (data: any, raw: Message) => Promise<any>

export type MessageConsumer = MessageConsumerLegacy | MessageConsumerModern

export interface WrappedRouter {
  (this: AMQPTransport, messageBody: any, message: Message): Promise<void>
}

/**
 * Response Handler Function. Sends Reply or Noop log.
 */
async function responseHandler(this: AMQPTransport, raw: Message, error: Error | null, data?: any): Promise<void> {
  const { properties } = raw
  return !properties.replyTo || !properties.correlationId
    ? this.noop(error, data, raw)
    : this.reply({ error, data }, raw)
}

export const isLegacyMessageConsumer = (messageHandler: MessageConsumer): messageHandler is MessageConsumerLegacy => {
  return messageHandler.length === 4
}

/**
 * Routing function HOC with reply RPC enhancer
 * @param  messageHandler
 * @param  transport
 */
export const initRoutingFn = (messageHandler: MessageConsumer): WrappedRouter => {

  if (isLegacyMessageConsumer(messageHandler)) {
    return async function legacyRouter(this: AMQPTransport, messageBody: any, message: Message): Promise<void> {
      // legacy router - extend properties
      const { properties } = message
      
      const extendedProperties: ExtendedMessageProperties = {
        ...properties,
        deliveryTag: message.deliveryTag,
        routingKey: message.routingKey,
        exchange: message.exchange,
        redelivered: message.redelivered,
      }

      try {
        await messageHandler(messageBody, extendedProperties, message, responseHandler.bind(this, message))
      } catch (err: any) {
        // in case its an async function or has sync errors
        responseHandler.call(this, message, err)
      }
    }
  }

  return async function modernRouter(this: AMQPTransport, messageBody: any, message: Message): Promise<void> {
    const { properties } = message
    const noReply = !properties.replyTo || !properties.correlationId

    try {
      const response = await messageHandler(messageBody, message)
      return noReply ? this.noop(null, response, message) : this.reply({ data: response }, message)
    } catch (error: any) {
      return noReply ? this.noop(error, null, message) : this.reply({ error }, message)
    }
  }
}
