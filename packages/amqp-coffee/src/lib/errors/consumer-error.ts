export class ConsumeError extends Error {
  public readonly code = 'AMQP_CONSUME_ERR';
  public readonly name = 'AMQP_ConsumeError';

  constructor(public readonly err: Record<string, any>, public readonly channel: number) {
    super('failed to consume')
  }
}
