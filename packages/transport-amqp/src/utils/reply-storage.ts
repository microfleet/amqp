import Errors = require('common-errors');
import { generateErrorMessage } from './error'

export interface Future<T = any> {
  promise: Promise<T>
  resolve(result?: T | PromiseLike<T>): void // promise resolve action.
  reject(err?: Error | null): void // promise reject action.
}

export interface PushOptions {
  timeout: number // expected response time.
  routing: string // routing key for error message.
  simple?: boolean // whether return body - only response or include headers
  time: [number, number] // process.hrtime() results.
  replyOptions: Record<string, any>
  timer: NodeJS.Timer | null
  future: Future | null
  cache?: any
}

const getFuture = <T = any>(): Future<T> => {
  const future: Future<T> = Object.create(null)
  const promise = new Promise<T>((resolve, reject) => {
    future.resolve = resolve
    future.reject = reject
  })
  future.promise = promise
  return future
}

/**
 * In-memory reply storage
 */
export class ReplyStorage {
  private storage: Map<string, { [K in keyof PushOptions]: NonNullable<PushOptions[K]> }>

  constructor(Type = Map) {
    this.storage = new Type()
    this.onTimeout = this.onTimeout.bind(this)
  }

  /**
   * Invoked on Timeout Error
   * @param correlationId
   */
  onTimeout(correlationId: string): void {
    const { storage } = this
    const rpcCall = storage.get(correlationId)

    if (rpcCall === undefined) {
      return
    }

    const { routing, timeout, future } = rpcCall

    // clean-up
    storage.delete(correlationId)

    // reject with a timeout error
    future.reject(new Errors.TimeoutError(generateErrorMessage(routing, timeout)))
  }

  /**
   * Stores correlation ID in the memory storage
   * @param  {string} correlationId
   * @param  {Object} opts
   */
  push<T = any>(correlationId: string, opts: Omit<PushOptions, 'timer' | 'future'>): Future<T> {
    const future = getFuture<T>()
    const timer = setTimeout(this.onTimeout, opts.timeout, correlationId)
    this.storage.set(correlationId, { ...opts, timer, future })
    return future
  }

  /**
   * Rejects stored promise with an error & cleans up
   * Timeout error
   * @param  {string} correlationId
   * @param  {Error} error
   */
  reject(correlationId: string, error: Error): void {
    const { storage } = this
    const rpcCall = storage.get(correlationId)
    if (rpcCall === undefined) {
      return
    }

    const { timer, future } = rpcCall

    // remove timer
    clearTimeout(timer)

    // remove reference
    storage.delete(correlationId)

    // now resolve promise and return an error
    future.reject(error)
  }

  pop(correlationId: string | undefined): PushOptions | undefined {
    if (correlationId === undefined) {
      return undefined
    }

    const future = this.storage.get(correlationId)

    // if undefind - early return
    if (future === undefined) {
      return undefined
    }

    // cleanup timeout
    clearTimeout(future.timer)

    // remove reference to it
    this.storage.delete(correlationId)

    // return data
    return future
  }
}
