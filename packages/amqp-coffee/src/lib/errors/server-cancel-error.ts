import { MethodFrameBasicCancel } from '@microfleet/amqp-codec'

export class ServerCancelError extends Error {
  public readonly code = 'basicCancel';
  public readonly name = 'AMQP_ServerCancel';

  constructor(public readonly args: MethodFrameBasicCancel['args']) {
    super('Server initiated basicCancel')
  }
}
