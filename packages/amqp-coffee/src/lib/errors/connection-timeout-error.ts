export class ConnectionTimeoutError extends Error {
  public readonly code = 'T'
  public readonly name = 'AMQP_ConnectionTimeoutError'
  
  constructor(public readonly host: string, public readonly port: number) {
    super('Connection Timeout')
  }
}
