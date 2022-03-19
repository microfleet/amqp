import HLRU from 'hashlru'
import { latency } from './latency'
import stringify from 'safe-stable-stringify'

export class Cache {
  public readonly enabled: boolean
  
  private readonly cache!: ReturnType<typeof HLRU>
  private readonly dedupes = new Map<string, Promise<any>>()

  /**
   * @param size
   */
  constructor(size: number) {
    this.enabled = !!size

    // if enabled - use it
    if (this.enabled) {
      this.cache = HLRU(size)
    }
  }

  /**
   *
   * @param message
   * @param maxAge
   */
  get(message: any, maxAge: number | undefined): null | string | { maxAge: number, value: any } {
    if (this.enabled === false) {
      return null
    }

    if (typeof maxAge !== 'number' || maxAge <= 0) {
      return null
    }

    const hashKey = typeof message === 'string' ? message : stringify(message)
    const response = this.cache.get(hashKey)

    if (response !== undefined) {
      if (latency(response.maxAge) < maxAge) {
        return response
      }

      this.cache.remove(hashKey)
    }

    return hashKey
  }

  /**
   *
   * @param key
   * @param data
   */
  set(key: string | undefined | null, data: any): null | void {
    if (this.enabled === false) {
      process.emitWarning('tried to use disabled cache', {
        code: 'MF_AMQP_CACHE_0001',
        detail: 'enable cache to be able to use it',
      })
      return null
    }

    // only use string keys
    if (typeof key !== 'string') {
      return null
    }

    return this.cache.set(key, { maxAge: process.hrtime(), value: data })
  }

  dedupe(key: string): void | Promise<any> {
    return this.dedupes.get(key)
  }

  storeDedupe(key: string, future: Promise<any>): void {
    this.dedupes.set(key, future)
  }

  cleanDedupe(key?: string): void {
    if (key) this.dedupes.delete(key)
  }
}
