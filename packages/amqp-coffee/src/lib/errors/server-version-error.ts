import { MethodFrameConnectionStart } from '@microfleet/amqp-codec'

export class ServerVersionError extends Error {
  public readonly code = 'badServerVersion'
  public readonly name = 'ServerVersionError'

  constructor(args: MethodFrameConnectionStart['args']) {
    super(`ServerErrorMismatch: ${args.versionMajor}.${args.versionMinor}`)
  }
}
