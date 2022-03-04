export class ServerClosedError extends Error {
  public readonly code = 'AMQP_SERVER_CLOSED';
  public readonly name = 'AMQP_ServerClosed';
  public readonly msg = 'Server closed channel';

  constructor(public readonly error: Record<string, any>) {
    super('Server closed channel')
  }
}
