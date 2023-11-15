import Errors = require('common-errors')
import { Cache } from './cache'
import { generateErrorMessage } from './error'
import reusify from 'reusify'

export interface Future<T = any> {
  promise: PromiseLike<T>
  deduped: boolean
  dupes: Future<T>[]
  resolve(result?: T | PromiseLike<T>): void // promise resolve action.
  reject(err?: Error | null): void // promise reject action.
  cloneDeduped(): Future<T>
  release(): void
}

export interface PushOptions {
  timeout: number // expected response time.
  routing: string // routing key for error message.
  simple: boolean // whether return body - only response or include headers
  time: number // performance.now()
  timer: NodeJS.Timeout | null
  future: Future | null
  cache: string | null

  release(): void
  reject(err: Error): void
  resolve(value?: any): void
}

function PushOptions(this: any) {
  this.timeout = -1 // expected response time.
  this.routing = '' // routing key for error message.
  this.simple = false // whether return body - only response or include headers
  this.time = 0 // performance.now()
  this.timer = null
  this.future = null
  this.cache = ''

  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const that = this

  this.release = function (): void {
    that.cache = ''
    pushOptionsFactory.release(that)
  }

  this.resolve = function (value?: any) {
    that.future.resolve(value)
    that.future.release()
    that.future = null
    this.timer = null
    that.cache = ''
    pushOptionsFactory.release(that)
  }

  this.reject = function (err: Error) {
    that.future.reject(err)
    that.future.release()
    that.future = null
    this.timer = null
    that.cache = ''
    pushOptionsFactory.release(that)
  }
}

function Future<T>(this: any) {
  this.resolve = null
  this.reject = null
  this.promise = null
  this.deduped = false
  this.dupes = []

  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const that = this
  
  this.release = function (): void {
    that.resolve = null
    that.reject = null
    that.promise = null

    if (that.dupes.length > 0) {
      that.dupes.forEach(futureFactory.release)
      that.dupes = []
    }

    futureFactory.release(that)
  }

  this.cloneDeduped = function (): Future<T> {
    const clone = futureFactory.get()

    clone.promise = that.promise
    clone.resolve = that.resolve
    clone.reject = that.reject
    clone.deduped = true
    clone.dupes = []

    that.dupes.push(clone)

    return clone
  }
}

const futureFactory = reusify<Future>(Future)

export const pushOptionsFactory = reusify<PushOptions>(PushOptions)

const getFuture = <T = any>(): Future<T> => {
  const future: Future<T> = futureFactory.get()

  future.promise = new Promise<T>((resolve, reject) => {
    future.resolve = resolve
    future.reject = reject
  })

  future.deduped = false
  future.dupes = []

  return future
}

/**
 * In-memory reply storage
 */
export class ReplyStorage {
  private readonly storage: Map<string, PushOptions>
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

    const { routing, timeout, cache } = rpcCall

    // clean-up
    storage.delete(correlationId)
    if (cache !== null) {
      this.cache.cleanDedupe(cache)
    }

    // reject with a timeout error
    rpcCall.reject(new Errors.TimeoutError(generateErrorMessage(routing, timeout)))
  }

  /**
   * Stores correlation ID in the memory storage
   * @param correlationId
   * @param opts
   */
  push<T = any>(correlationId: string, rpcCall: PushOptions): Future<T> {
    const { cache } = rpcCall
    if (typeof cache === 'string' && cache !== '') {
      const pendingFuture = this.cache.dedupe(cache)
      if (pendingFuture) {
        rpcCall.release()
        return pendingFuture.cloneDeduped()
      }

      rpcCall.future = getFuture<T>()
      this.cache.storeDedupe(cache, rpcCall.future)
    } else {
      rpcCall.future = getFuture<T>()
    }
    
    rpcCall.timer = setTimeout(this.onTimeout, rpcCall.timeout, correlationId)

    this.storage.set(correlationId, rpcCall)

    return rpcCall.future
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

    const { timer, cache } = rpcCall

    // remove timer
    if (timer !== null) {
      clearTimeout(timer)
      rpcCall.timer = null
    }

    // remove reference
    storage.delete(correlationId)
    if (cache !== null) {
      this.cache.cleanDedupe(cache)
    }

    // now resolve promise and return an error
    rpcCall.reject(error)
  }

  pop(correlationId: string | undefined): PushOptions | undefined {
    if (correlationId === undefined) {
      return undefined
    }

    const rpcCall = this.storage.get(correlationId)

    // if undefind - early return
    if (rpcCall === undefined) {
      return undefined
    }

    // cleanup timeout
    if (rpcCall.timer !== null) {
      clearTimeout(rpcCall.timer)
      rpcCall.timer = null
    }

    // remove reference to it
    this.storage.delete(correlationId)
    if (rpcCall.cache !== null) {
      this.cache.cleanDedupe(rpcCall.cache)
    }

    // return data
    return rpcCall
  }
}
