import { methods } from "@microfleet/amqp-codec"
import { InferOptions } from "../channel"

export type AMQP_CONNECTION_ERRORS = {
  replyText: string // 'connection-forced',
  replyCode: 320
} | {
  replyText: string // 'invalid-path',
  replyCode: 402
} | {
  replyText: string // 'frame-error',
  replyCode: 501
} | {
  replyText: string // 'command-invalid',
  replyCode: 503
} | {
  replyText: string // 'channel-error',
  replyCode: 504
} | {
  replyText: string // 'unexpected-frame',
  replyCode: 505
} | {
  replyText: string // 'resource-error',
  replyCode: 506
} | {
  replyText: string // 'not-allowed',
  replyCode: 530
} | {
  replyText: string // 'not-implemented',
  replyCode: 540
} | {
  replyText: string // 'internal-error',
  replyCode: 541
}

export type AMQP_CHANNEL_ERRORS = {
  replyText: string // 'content-too-large',
  replyCode: 311
} | {
  replyText: string // 'no-route',
  replyCode: 312
} | {
  replyText: string // 'no-consumers',
  replyCode: 313
} | {
  replyText: string // 'access-refused',
  replyCode: 403
} | {
  replyText: string // 'not-found',
  replyCode: 404
} | {
  replyText: string // 'resource-locked',
  replyCode: 405
} | {
  replyText: string // 'precondition-failed',
  replyCode: 406
}

export type ServerClosedArgs = InferOptions<typeof methods.channelClose>

export class ServerClosedError extends Error {
  public readonly code = 'AMQP_SERVER_CLOSED'
  public readonly name = 'AMQP_ServerClosed'
  public readonly msg = 'Server closed channel'
  public readonly reason: AMQP_CHANNEL_ERRORS | AMQP_CONNECTION_ERRORS

  constructor(error: ServerClosedArgs) {
    super('Server closed channel')
    // https://www.rabbitmq.com/amqp-0-9-1-reference.html#
    this.reason = {
      // @ts-expect-error - errors taken from spec
      replyCode: error.replyCode,
      replyText: error.replyText
    }
  }
}
