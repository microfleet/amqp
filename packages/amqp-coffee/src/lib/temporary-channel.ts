// Temporary Channel
import { ContentHeader, MethodFrame } from '@microfleet/amqp-codec'
import { Channel } from './channel'
import { debug as _debug } from './config'
import type { Connection } from './connection'

const debug = _debug('amqp:TempChannel')

import { TemporaryChannelCb } from './channel-manager'

// This is just a skeleton of a simple channel object to pass around
export class TemporaryChannel extends Channel {
  private cb?: TemporaryChannelCb | null
  
  constructor(connection: Connection, channel: number, cb?: TemporaryChannelCb) {
    super(connection, channel)
    this.temporaryChannel()
    this.cb = cb
  }

  _channelOpen() {
    debug('temp channel open')
    this.cb?.(null, this)
    this.cb = null
  }

  _onChannelReconnect(cb: (err?: Error, result?: any) => void): void {
    debug(1, () => [this.channel, 'temp channel reconnected'])
    cb()
  }

  _channelClosed(err?: Error): void {
    debug(1, () => [this.channel, 'temp channel closed'])
    // do nothing
  }

  _onMethod(channel: number, frame: MethodFrame): void {
    // do nothing
  }

  _onContent(channel: number, data: Buffer): void {
    // do nothing
  }

  _onContentHeader(channel: number, frame: ContentHeader): void {
    // do nothing
  }
}
