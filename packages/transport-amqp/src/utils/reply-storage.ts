import Errors = require('common-errors')
import { Cache } from './cache'
import { generateErrorMessage } from './error'

export interface Future<T = any> {
  promise: Promise<T>
  deduped: false
  resolve(result?: T | PromiseLike<T>): void // promise resolve action.
  reject(err?: Error | null): void // promise reject action.
}

export interface PushOptions {
  timeout: number // expected response time.
  routing: string // routing key for error message.
  simple?: boolean // whether return body - only response or include headers
  time: [number, number] // process.hrtime() results.
  replyOptions: Record<string, any>
  timer: NodeJS.Timeout | null
  future: Future | null
  cache?: string | null
}

const getFuture = <T = any>(): Future<T> => {
  const future: Future<T> = Object.create(null)
  const promise = new Promise<T>((resolve, reject) => {
    future.resolve = resolve
    future.reject = reject
  })
  future.promise = promise
  future.deduped = false
  return future
}

/**
 * In-memory reply storage
 */
export class ReplyStorage {
  private readonly storage: Map<string, { [K in keyof PushOptions]: NonNullable<PushOptions[K]> }>
  private readonly cache: Cache

  constructor(cache: Cache) {
    this.storage = new Map()
    this.cache = cache
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

    const { routing, timeout, future, cache } = rpcCall

    // clean-up
    storage.delete(correlationId)
    this.cache.cleanDedupe(cache)

    // reject with a timeout error
    future.reject(new Errors.TimeoutError(generateErrorMessage(routing, timeout)))
  }

  /**
   * Stores correlation ID in the memory storage
   * @param correlationId
   * @param opts
   */
  push<T = any>(correlationId: string, opts: PushOptions): Future<T> | { deduped: true, promise: Promise<any> } {
    if (typeof opts.cache === 'string') {
      const pendingFuture = this.cache.dedupe(opts.cache)
      if (pendingFuture) {
        return { promise: pendingFuture, deduped: true }
      }

      opts.future = getFuture<T>()
      this.cache.storeDedupe(opts.cache, opts.future.promise)
    } else {
      opts.future = getFuture<T>()
    }
    
    opts.timer = setTimeout(this.onTimeout, opts.timeout, correlationId)

    // @ts-expect-error ^ we know timer is defined
    this.storage.set(correlationId, opts)

    return opts.future
  }

  /**
   * Rejects stored promise with an error & cleans up
   * Timeout error
   * @param correlationId
   * @param error
   */
  reject(correlationId: string, error: Error): void {
    const { storage } = this
    const rpcCall = storage.get(correlationId)
    if (rpcCall === undefined) {
      return
    }

    const { timer, future, cache } = rpcCall

    // remove timer
    clearTimeout(timer)

    // remove reference
    storage.delete(correlationId)
    this.cache.cleanDedupe(cache)

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
    this.cache.cleanDedupe(future.cache)

    // return data
    return future
  }
}
