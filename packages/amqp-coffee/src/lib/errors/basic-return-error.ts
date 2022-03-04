/**
 * This file contains custom error implementation to fix string based errors
 */

export class BasicReturnError extends Error {
  public readonly code = 'ERR_AMQP_BASIC_RETURN';
  public readonly name = 'AMQP_BasicReturnError';
  public readonly replyCode: number
  public readonly exchange: string
  public readonly routingKey: string
  public readonly replyText: string

  constructor(err: any) {
    super(err.replyText)
    
    // assign properties
    this.replyCode = err.replyCode
    this.exchange = err.exchange
    this.routingKey = err.routingKey

    // preserve back-compatibility
    this.replyText = err.replyText
  }
}
