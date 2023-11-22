// Publisher
import { methods, MethodFrame, ContentHeader } from '@microfleet/amqp-codec'
import { once } from 'events'

import { Channel } from './channel'
import * as defaults from './defaults'

import { BasicReturnError } from './errors/basic-return-error'
import { debug as _debug } from './config'
import type { Connection } from './connection'
import { InferOptions } from './channel'
import { MessageProperties} from './message'

const debug = _debug('amqp:Publisher')
const kEvents = Symbol('amqp:kEvents')
const { hasOwnProperty } = Object.prototype
const kBasicPublishDefaults = defaults.basicPublish

export type BasicPublishOptions = InferOptions<typeof methods.basicPublish>

export interface PublishOptions extends MessageProperties {
  exchange: string // exchange to publish to
  routingKey: string

  // sets `expiration` property on the message
  timeout?: number // optional ttl value for message in the publish/send
  reuse?: boolean

  // delivery modes
  confirm: boolean // require ack from server on publish
  mandatory: boolean // require queue to exist on publish
  immediate: boolean // require message to be immediately routedd
  deliveryMode: 1 | 2  // transient or persistant, default to 1
}

const transformData = (data: unknown, options: { contentType?: string }): Buffer => {
  // data must be a buffer
  if (typeof data === 'string') {
    options.contentType = 'string/utf8'
    return Buffer.from(data, 'utf8')
  } 

  if (typeof data === 'object' && !Buffer.isBuffer(data)) {
    if (options.contentType != null) {
      debug(1, () => `contentType specified but data isn't a buffer, ${JSON.stringify(options)}`)
      throw new Error('contentType specified but data isn\'t a buffer')
    }

    // default use JSON
    options.contentType = 'application/json'
    return Buffer.from(JSON.stringify(data), 'utf8')
  }

  if (data === undefined) {
    options.contentType = 'application/undefined'
    return Buffer.allocUnsafe(0)
  }

  if (!Buffer.isBuffer(data)) {
    throw new Error(`data is not of a supported type: ${typeof data}`)
  }

  return data
}

export const enum ConfirmState {
  noAck = 'noAck',
  opening = 'opening',
  open = 'open',
  closed = 'closed'
}

export class Publisher extends Channel {
  public confirmState: ConfirmState = ConfirmState.noAck
  public confirm: boolean
  private seq = 0

  private currentMethod: MethodFrame['method'] | null = null
  private currentArgs: MethodFrame['args'] | null = null
  private seqCallbacks = new Map() // publisher confirms
  private [kEvents] = new Map()

  constructor(connection: Connection, channel: number, confirm?: boolean) {
    super(connection, channel)

    debug(3, () => `Channel: ${channel} - ${confirm}`)

    this.confirm = confirm != null ? confirm : false
    if (this.confirm) {
      this.confirmMode()
    }
  }

  confirmMode(cb?: () => void): void {
    this.confirmState = ConfirmState.opening
    this.taskPush(methods.confirmSelect, { noWait: false }, methods.confirmSelectOk, () => {
      this.confirmState = ConfirmState.open
      this.confirm = true
      this.seq = 1
      cb?.()
      debug(1, () => 'confirm mode on')
      this.emit('confirm')
    })
  }

  _channelOpen(): void {
    // do nothing
  }

  _channelClosed(message = new Error('Channel closed, try again')): void {
    this.confirmState = ConfirmState.closed

    for (const cb of this.seqCallbacks.values()) {
      if (typeof cb === 'function') {
        cb(message)
      }
    }

    this.seqCallbacks = new Map()
  }

  _onChannelReconnect(cb: (err?: Error, result?: any) => void): void {
    if (this.confirm) {
      this.confirmMode()
    }

    cb()
  }

  _inoperableState(): boolean {
    return this.state !== 'open' || (this.confirm && this.confirmState !== 'open')
  }

  _recoverableState(): boolean {
    return this.state === 'opening'
      || this.state === 'closed'
      || (this.confirm && this.confirmState === 'opening')
  }

  async _wait(eventName: string) {
    if (this[kEvents].has(eventName)) {
      return this[kEvents].get(eventName)
    }

    const ev$ = once(this, eventName)
    this[kEvents].set(eventName, ev$)
    try {
      await ev$
    } finally {
      this[kEvents].delete(eventName)
    }
  }

  publish(exchange: string,
          routingKey: string,
          data: any,
          _options: PublishOptions,
          _cb?: (err?: Error | null) => void) {

    let cb = _cb
    let options = _options
    if (typeof _options === 'function') {
      cb = _options
      options = Object.create(null)
    }

    this.publishAsync(exchange, routingKey, data, options)
      .then(() => cb?.(), cb)
  }
  
  private async recover() {
    debug(4, () => ['publish channel in inoperable state'])
    if (!this._recoverableState()) {
      debug(4, () => ['state irrecoverable'])
      throw new Error(`Channel ${this.channel} is closed and will not re-open? ${this.state} ${this.confirm} ${this.confirmState}`)
    }

    debug(4, () => ['state recoverable, wait for:', this.confirm ? 'confirm' : 'open'])
    if (this.confirm && (this.confirmState === ConfirmState.closed || this.confirmState === ConfirmState.noAck)) {
      this.confirmMode()
    }
    await this._wait(this.confirm ? 'confirm' : 'open')
  }

  async publishMessageAsync(_data: unknown, options: PublishOptions) {
    if (this._inoperableState()) {
      await this.recover()
    }

    // perform data transformation, ie obj -> buffer
    const data = transformData(_data, options)

    // Apply default options after we deal with potentially converting the data
    for (const key in kBasicPublishDefaults) {
      if (!hasOwnProperty.call(options, key)) {
        // @ts-expect-error -- invalid error
        options[key] = kBasicPublishDefaults[key]
      }
    }

    // increment this as the final step before publishing, to make sure we're in sync with the server
    let thisSequenceNumber: number | null = null
    if (this.confirm) {
      thisSequenceNumber = this.seq++

      // This is to tie back this message as failed if it failed in confirm mode with a mandatory or immediate publish
      if (options.mandatory || options.immediate) {
        options.headers['x-seq'] = thisSequenceNumber
      }
    }

    debug(4, () => ['queue publish', JSON.stringify(options)])
    this.queuePublish(methods.basicPublish, data, options)

    if (thisSequenceNumber !== null) {
      await this._waitForSeq(thisSequenceNumber)
    }
  }

  async publishAsync(exchange: string, routingKey: string, _data: any, _options: Partial<PublishOptions> = Object.create(null)) {
    const options = _options.reuse !== true ? { ..._options } : _options

    if (this._inoperableState()) {
      await this.recover()
    }

    // perform data transformation, ie obj -> buffer
    const data = transformData(_data, options)

    // Apply default options after we deal with potentially converting the data
    for (const key in kBasicPublishDefaults) {
      if (!hasOwnProperty.call(options, key)) {
        // @ts-expect-error -- invalid error
        options[key] = kBasicPublishDefaults[key]
      }
    }

    options.exchange ||= exchange
    options.routingKey ||= routingKey

    // increment this as the final step before publishing, to make sure we're in sync with the server
    let thisSequenceNumber: number | null = null
    if (this.confirm) {
      thisSequenceNumber = this.seq++

      // This is to tie back this message as failed if it failed in confirm mode with a mandatory or immediate publish
      if (options.mandatory || options.immediate) {
        if (options.headers) {
          options.headers['x-seq'] = thisSequenceNumber
        } else {
          options.headers = { 'x-seq': thisSequenceNumber }
        }
      }
    }

    debug(4, () => ['queue publish', JSON.stringify(options)])
    this.queuePublish(methods.basicPublish, data, options)

    if (thisSequenceNumber !== null) {
      await this._waitForSeq(thisSequenceNumber)
    }
  }

  _onMethod(channel: number, frame: MethodFrame) {
    this.currentMethod = frame.method
    this.currentArgs = frame.args

    debug(1, () => 'onMethod')
    if (frame.name === methods.basicAck.name && this.confirm) {
      const args = frame.args
      this._gotSeq(args.deliveryTag, args.multiple)
    }
  }

  _onContentHeader(channel: number, frame: ContentHeader) {
    debug(1, () => 'content header')
    if (this.currentMethod === methods.basicReturn && typeof frame.properties.headers?.['x-seq'] === 'number') {
      this._gotSeq(frame.properties.headers['x-seq'], false, new BasicReturnError(this.currentArgs))
    }
  }

  _onContent(channel: number, data: any) {
    // Content is not needed on a basicReturn
  }

  async _waitForSeq(seq: number) {
    return new Promise<void>((resolve, reject) => {
      this.seqCallbacks.set(seq, (err?: Error | null) => {
        err ? reject(err) : resolve()
      })
    })
  }

  _gotSeq(seq: number, multi: boolean, err: Error | null = null) {
    if (multi) {
      for (const key of this.seqCallbacks.keys()) {
        if (key <= seq) {
          this.seqCallbacks.get(key)(err)
          this.seqCallbacks.delete(key)
        }
      }
    } else {
      if (this.seqCallbacks.has(seq)) {
        this.seqCallbacks.get(seq)(err)
      } else {
        debug(3, () => `got a seq for ${seq} but that callback either doesn't exist or was already called or was returned`)
      }

      this.seqCallbacks.delete(seq)
    }
  }
}
