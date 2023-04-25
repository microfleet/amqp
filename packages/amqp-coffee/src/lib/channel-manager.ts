// ###

// Channel Manager

// we track and manage all the channels on a connection.
// we will dynamically add and remove publish channels... maybe
// we track confirm channels and non confirm channels separately.

// ###

const publisherPoolSize = 1

import { Publisher } from './publisher'
import { Consumer } from './consumer'
import { TemporaryChannel } from './temporary-channel'
import { Channel } from './channel'
import { debug as _debug } from './config'
import type { Connection } from './connection'

const debug = _debug('amqp:ChannelManager')

export type TemporaryChannelCb = {
  (err: Error | null, channel?: TemporaryChannel): void
}

export class ChannelManager {
  public readonly channels: Connection['channels']
  public channelCount = 0

  private publisherConfirmChannels: Map<number, Publisher> = new Map()
  private publisherChannels: Map<number, Publisher> = new Map()

  private tempChannel: TemporaryChannel | null = null
  private tempChannel$P: Promise<TemporaryChannel> | null = null

  constructor(private connection: Connection) {
    this.channels = this.connection.channels
  }

  nextChannelNumber(): number {
    this.channelCount += 1
    return this.channelCount
  }

  publisherChannel(confirm = false): Publisher {
    const pool = confirm
      ? this.publisherConfirmChannels
      : this.publisherChannels

    if (pool.size < publisherPoolSize) {
      const channel = this.nextChannelNumber()
      debug(1, `created new publisher id=${channel}`)
      const p = new Publisher(this.connection, channel, confirm)
      this.channels.set(channel, p)
      pool.set(channel, p)
      return p
    }

    const i = Math.floor(Math.random() * pool.size)
    const channel = Array.from(pool.keys())[i]
    debug(1, `reusing channel: ${channel}`)
    return pool.get(channel) as Publisher
  }

  async temporaryChannelAsync(): Promise<TemporaryChannel> {
    if (this.tempChannel !== null) {
      return this.tempChannel
    }

    if (this.tempChannel$P !== null) {
      return this.tempChannel$P
    }

    this.tempChannel$P = new Promise((resolve, reject) => {
      const channel = this.nextChannelNumber()
      const tempChannel = new TemporaryChannel(this.connection, channel, (err) => {
        if (err) {
          return reject(err)
        }

        this.tempChannel = tempChannel
        resolve(tempChannel)
      })
      this.channels.set(channel, tempChannel)
    })

    try {
      return this.tempChannel$P
    } finally {
      this.tempChannel$P = null
    }
  }

  temporaryChannel(cb?: TemporaryChannelCb): TemporaryChannel {
    if (this.tempChannel != null) {
      debug('returning temp channel')
      cb?.(null, this.tempChannel)
    }

    const channel = this.nextChannelNumber()
    this.tempChannel = new TemporaryChannel(this.connection, channel, cb)
    this.channels.set(channel, this.tempChannel)
    return this.tempChannel
  }

  consumerChannel(): Consumer {
    const channel = this.nextChannelNumber()
    const s = new Consumer(this.connection, channel)
    this.channels.set(channel, s)
    return s
  }

  channelReassign(channel: Channel) {
    this.channels.delete(channel.channel)
    const newChannelNumber = this.nextChannelNumber()
    channel.channel = newChannelNumber
    this.channels.set(newChannelNumber, channel)
  }

  channelClosed(channelNumber: number) {
    this.publisherChannels.delete(channelNumber)
    this.publisherConfirmChannels.delete(channelNumber)
    this.channels.delete(channelNumber)
  }

  isChannelClosed(channelNumber: number) {
    return !this.channels.has(channelNumber)
  }
}
