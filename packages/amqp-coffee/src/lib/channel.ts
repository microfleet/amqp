// Channel

import async = require('async')
import { EventEmitter, once } from 'events'
import { debug as _debug } from './config'
import { methods,
  classMethodsTable,
  MethodsTableMethod,
  MethodFrame, MethodFrameOk, FieldsToRecord, ContentHeader,
  isClassMethodId
} from '@microfleet/amqp-codec'
import { Connection, ConnectionState } from './connection'
import { ServerClosedError, ConnectionResetError } from './errors'
import { promisify } from 'util'
import { performance } from 'node:perf_hooks'
import fastq from 'fastq'
import type { queueAsPromised } from "fastq"

const noopErr = (err: Error) => debug(4, ['openAsync', err])
const debug = _debug('amqp:Channel')

export const enum TaskType {
  method = 'method',
  publish = 'publish'
}

export const enum ChannelState {
  closed = 'closed',
  opening = 'opening',
  open = 'open',
}

type ReservedKeys<T> = {
  [K in keyof T]: K extends string & `reserved${string}` ? K : never
}[keyof T]

type OmitReservedKeys<T> = Omit<T, ReservedKeys<T>>

export type Methods = MethodFrame['method']
export type MethodsOk = MethodFrameOk['method']
export type InferOptions<T extends Methods> = OmitReservedKeys<FieldsToRecord<T['fields']>>
export type preflightReq = () => boolean
export type AMQPResponse<T extends Methods, R = InferOptions<T>> = (err?: Error | null, res?: R) => void

export type BaseTask<
  Extension,
  T extends Methods,
  U extends MethodsOk,
  Data
> = {
  method: T,
  data?: Data,
  okMethod?: U,
  preflight?: preflightReq,
  cb?: AMQPResponse<U>
} & Extension

export type Task<
  T extends Methods = Methods,
  U extends MethodsOk = MethodsOk,
  Data = any
> = BaseTask<{
  type: TaskType.method,
  args: InferOptions<T>
}, T, U, Data> | BaseTask<{
  type: TaskType.publish,
  options: InferOptions<T>
}, T, U, Data>

const kChannelCloseOkName = methods.channelCloseOk.name
const kChannelCloseName = methods.channelClose.name
const kChannelOpenOkName = methods.channelOpenOk.name

export interface Channel {
  on(event: 'open', listener: () => void): this;
  on(event: 'error', listener: (err: Error | ServerClosedError) => void): this;
}
export abstract class Channel extends EventEmitter {
  public state = ChannelState.closed

  private waitingCallbacks = new Map() // channel operations
  private transactional = false
  private queue: queueAsPromised<Task> = fastq.promise(this, this._taskWorker, 1)
  private lastChannelAccess = 0
  private channelTracker: NodeJS.Timeout | null = null
  private openAsync: () => Promise<void>

  constructor(public connection: Connection, public channel: number) {
    super({ captureRejections: true })
    this.taskPush = this.taskPush.bind(this)
    this.openAsync = promisify(this.open)
    queueMicrotask(() => this.open())
  }

  temporaryChannel() {
    this.transactional = true // THIS IS NOT AMQP TRANSACTIONS
    this.lastChannelAccess = performance.now()

    if (process.env.AMQP_TEST != null) {
      this.connection.connectionOptions.temporaryChannelTimeout = 200
      this.connection.connectionOptions.temporaryChannelTimeoutCheck = 100
    }

    if (this.channelTracker == null) {
      const { temporaryChannelTimeout, temporaryChannelTimeoutCheck } = this.connection.connectionOptions
      this.channelTracker = setInterval(() => {
        if (this.lastChannelAccess < (performance.now() - temporaryChannelTimeout)) {
          debug(4, () => [this.channel, 'Closing channel due to inactivity'])
          this.close(true)
        }
      }, temporaryChannelTimeoutCheck)
    }
  }

  open(cb?: (err?: Error | null, result?: any) => void) {
    if (this.state === ChannelState.closed) {
      debug(1, () => ['opening channel', this.channel])

      this.state = ChannelState.opening

      if (cb) this.waitForMethod(methods.channelOpenOk, cb)

      const { connection } = this
      const { channelManager } = connection

      // channelManager assigns this after constructor
      // so open must always be called in the next tick
      if (channelManager.isChannelClosed(this.channel)) {
        channelManager.channelReassign(this)
      }

      connection._sendMethod(this.channel, methods.channelOpen, {})

      if (this.transactional) this.temporaryChannel()
    } else if (cb) {
      debug(1, () => ['state isnt closed', this.channel])
      cb(new Error("state isn't closed. not opening channel"))
    }
  }

  reset(cb?: (err?: Error | null) => void) {
    debug(1, () => [this.channel, 'channel reset called'])

    if (this.state !== ChannelState.open) {
      debug(1, () => ['channel state', this.channel, this.state])
      this._callOutstandingCallbacks(new ConnectionResetError())
    }

    // if our state is closed and either we aren't a transactional channel (queue, exchange declare etc..)
    // or we're within our acceptable time window for this queue
    if (this.state === ChannelState.closed
        && (
          !this.transactional
          || this.listeners('open').length > 0
          || (
            this.transactional
            && this.lastChannelAccess > (performance.now() - this.connection.connectionOptions.temporaryChannelTimeout)
          ))
    ) {
      debug(1, () => 'State is closed... reconnecting')

      async.series([
        (next) => this.open(next),
        (next) => this._onChannelReconnect(next),
      ], (err) => cb?.(err))
    } else {
      cb?.()
    }
  }

  async crash(): Promise<void> {
    if (process.env.AMQP_TEST == null) {
      return
    }

    // this will crash a channel forcing a channelOpen from the server
    // this is really only for testing
    debug('Trying to crash channel')
    this.connection._sendMethod(this.channel, methods.queuePurge, { queue: 'idontexist' })
    await this.waitForMethodAsync(methods.channelClose)
  }

  close(auto?: boolean | (() => void)) {
    if (auto == null || !auto) {
      debug(1, () => 'User requested channel close')
    }

    if (this.channelTracker) {
      clearInterval(this.channelTracker)
      this.channelTracker = null
    }

    if (this.state === ChannelState.open) {
      this.state = ChannelState.closed
      this.connection._sendMethod(this.channel, methods.channelClose, {
        replyText: 'Goodbye',
        replyCode: 200,
        classId: 0,
        methodId: 0,
      })
    }
  }

  async waitForMethodAsync(method: MethodsTableMethod): Promise<any> {
    return new Promise((resolve, reject) => {
      this.waitForMethod(method, (err, res) => {
        if (err) return reject(err)
        resolve(res)
      })
    })
  }

  waitForMethod(method: MethodsTableMethod, cb?: (err?: Error, res?: any) => void) {
    const { waitingCallbacks } = this

    if (!waitingCallbacks.has(method.name)) {
      waitingCallbacks.set(method.name, [cb])
    } else {
      waitingCallbacks.get(method.name).push(cb)
    }
  }

  callbackForMethod(method: MethodsTableMethod) {
    const { waitingCallbacks } = this

    if (method == null || !waitingCallbacks.has(method.name)) {
      return () => true
    }

    const methodCallback = waitingCallbacks.get(method.name)
    const cb = methodCallback.shift()
    if (methodCallback.length === 0) {
      waitingCallbacks.delete(method.name)
    }

    return cb
  }

  // Functions to overwrite
  abstract _channelOpen(): void
  abstract _channelClosed(err?: Error | null): void
  abstract _onChannelReconnect(cb: (err?: Error | null, result?: any) => void): void
  abstract _onMethod(channel: number, frame: MethodFrame): void
  abstract _onContent(channel: number, data: Buffer): void
  abstract _onContentHeader(channel: number, frame: ContentHeader): void

  // TASK QUEUEING ---------------------------------------------------------
  // same as queueSendMethod
  taskPush<
    T extends Methods,
    U extends MethodsOk,
  >(method: T, args: InferOptions<T>, okMethod?: U, cb?: AMQPResponse<U>) {
    this.queue.push({ type: TaskType.method, method, args, okMethod, cb })
  }

  async taskPushAsync<
    T extends Methods,
    U extends MethodsOk,
    >(method: T, args: InferOptions<T>, okMethod?: U, preflight?: preflightReq): Promise<InferOptions<U>> {
    return new Promise((resolve, reject) => {
      this.taskPushPreflight(method, args, okMethod, preflight, (err, res) => {
        if (err) {
          return reject(err)
        }

        // because its only undeifned when err is defined
        resolve(res!)
      })
    })
  }


  taskPushPreflight<
    T extends Methods,
    U extends MethodsOk,
  >(method: T, args: InferOptions<T>, okMethod?: U, preflight?: preflightReq, cb?: AMQPResponse<U>) {
    this.queue.push({ type: TaskType.method, method, args, okMethod, preflight, cb })
  }

  taskQueuePushRaw<
    T extends Methods,
    U extends MethodsOk
  >(task: Task<T, U>, cb?: AMQPResponse<U>) {
    if (cb != null && task != null) {
      task.cb = cb
    }

    this.queue.push(task)
  }

  queueSendMethod<
    T extends Methods,
    U extends MethodsOk,
  >(method: T, args: InferOptions<T>, okMethod: U, cb?: AMQPResponse<U>) {
    this.queue.push({ type: TaskType.method, method, args, okMethod, cb })
  }

  queuePublish<T extends Methods>(method: T, data: any, options: Partial<InferOptions<T>>): void {
    this.queue.push({ type: TaskType.publish, method, data, options })
  }

  async _taskWorker(task: Task): Promise<void> {
    const { transactional, state, connection, channel } = this
    const { channelManager } = connection

    if (transactional) {
      this.lastChannelAccess = performance.now()
    }

    const { type, method, okMethod, cb, data, preflight } = task

    // if preflight is false do not proceed
    if (preflight != null && !preflight()) {
      cb?.(new Error('preflight check failed'))
      return
    }

    if (state === ChannelState.closed && connection.state === ConnectionState.open) {
      debug(4, () => ['openAsync called on channel number:', channel])
      // reassign channel number
      channelManager.channelReassign(this)
      await this.openAsync().catch(noopErr)
      debug(4, () => ['openAsync done: channel number', this.channel])
      this.queue.unshift(task)
      return
    }

    if (state !== ChannelState.open) {
      // if our connection is closed that ok, but if its destroyed it will not reopen
      if (connection.state === ConnectionState.destroyed) {
        cb?.(new Error('Connection is destroyed'))
        return
      }

      if (state !== ChannelState.opening && channelManager.isChannelClosed(channel)) {
        debug(4, () => ['channel', channel, 'in state', state, 'marked as closed'])
        channelManager.channelReassign(this)
      }

      await once(this, 'open')
      this.queue.unshift(task)
      return
    }

    const p$ = okMethod != null
      ? this.waitForMethodAsync(okMethod)
      : null

    if (type === TaskType.method) {
      connection._sendMethod(channel, method, task.args)
    } else if (type === TaskType.publish) {
      connection.connection.cork()
      this.connection._sendMethod(channel, method, task.options)
      this.connection._sendBody(channel, data, task.options)
      process.nextTick(() => connection.connection.uncork())
    } else {
      throw new Error(`a task was queue with an unknown type of ${type}`)
    }

    if (p$ === null) {
      cb?.(null)
      return
    }

    try {
      const res = await p$
      cb?.(null, res)
    } catch (err: any) {
      cb?.(err)
    }
  }

  _callOutstandingCallbacks(message = new Error('Channel Unavaliable')) {
    const outStandingCallbacks = this.waitingCallbacks
    this.waitingCallbacks = new Map()

    for (const cbs of outStandingCallbacks.values()) {
      for (const cb of cbs) {
        cb(message)
      }
    }
  }

  // incomming channel messages for us
  _onChannelMethod<T extends MethodFrame>(channel: number, frame: T) {
    if (this.transactional) {
      this.lastChannelAccess = performance.now()
    }

    if (channel !== this.channel) {
      debug(1, () => ['channel was sent to the wrong channel object', channel, this.channel])
      return
    }

    this.callbackForMethod(frame.method)(null, frame.args)

    const { name } = frame
    const { connection } = this

    if (name === kChannelCloseOkName) {
      connection.channelManager.channelClosed(this.channel)
      this.state = ChannelState.closed

      this._channelClosed(new Error('Channel closed'))
      this._callOutstandingCallbacks(new Error('Channel closed'))

    } else if (name === kChannelCloseName) {
      // channel by closed from server
      const { args } = frame

      connection._sendMethod(this.channel, methods.channelCloseOk, {})

      this.state = ChannelState.closed
      connection.channelManager.channelClosed(this.channel)

      const idx = `${args.classId}_${args.methodId}`
      if (isClassMethodId(idx)) {
        const closingMethod = classMethodsTable[idx].name
        const closingMethodSignature = `${closingMethod}Ok` as MethodsOk['name']
        const closingMethodOk = methods[closingMethodSignature]
        this.callbackForMethod(closingMethodOk)(args) // this would be the error
      }

      this._channelClosed(new ServerClosedError(args))
      this._callOutstandingCallbacks(new Error(`Channel closed by server ${JSON.stringify(args)}`))

    } else if (name === kChannelOpenOkName) {
      this.state = ChannelState.open
      this._channelOpen()
      this.emit('open')

    } else {
      this._onMethod(channel, frame)
    }
  }

  _connectionClosed() {
    // if the connection closes, make sure we reflect that because that channel is also closed
    if (this.state !== ChannelState.closed) {
      this.state = ChannelState.closed
      this._channelClosed()
      if (this.channelTracker != null) {
        clearInterval(this.channelTracker)
        this.channelTracker = null
      }
    }
  }
}
