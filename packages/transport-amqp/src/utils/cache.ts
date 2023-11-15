import LRUCache from 'mnemonist/lru-map-with-delete'
import { latency } from './latency'
import stringify from 'safe-stable-stringify'
import { Future } from './reply-storage'

export const cacheKey = (exchange: string, route: string, headers: Record<string, any> | undefined | null, message: unknown) => {
  return `${exchange}~${route}~${headers ? stringify(headers) : '{}'}~${stringify(message)}`
}

export class Cache {
  private readonly enabled: boolean
  private readonly cache!: LRUCache<string, { maxAge: number, value: any }>
  private readonly dedupes = new Map<string, Future<any>>()

  /**
   * @param size
   */
  constructor(size: number) {
    this.enabled = !!size

    // if enabled - use it
    if (this.enabled) {
      this.cache = new LRUCache(size)
    }
  }

  /**
   * @param ttlOrMaxAge
   */
  isEnabled(ttlOrMaxAge: number | undefined): boolean {
    if (this.enabled === false || ttlOrMaxAge === undefined || ttlOrMaxAge < 0) {
      return false
    }

    return true
  }

  /**
   *
   * @param message
   * @param ttlOrMaxAge
   */
  get(cacheKey: string, ttlOrMaxAge: number): string | { maxAge: number, value: any } {
    if (ttlOrMaxAge === 0) {
      return cacheKey
    }

    const hashKey = cacheKey
    const response = this.cache.get(hashKey)

    if (response !== undefined) {
      if (latency(response.maxAge) < ttlOrMaxAge) {
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
  set(key: string | undefined | null, data: any): void {
    if (this.enabled === false) {
      process.emitWarning('tried to use disabled cache', {
        code: 'MF_AMQP_CACHE_0001',
        detail: 'enable cache to be able to use it',
      })
      return
    }

    // only use string keys
    if (typeof key !== 'string' || key === '') {
      return
    }

    this.cache.set(key, { maxAge: performance.now(), value: data })
  }

  dedupe<T = any>(key: string): void | Future<T> {
    return this.dedupes.get(key)
  }

  storeDedupe<T = any>(key: string, future: Future<T>): void {
    this.dedupes.set(key, future)
  }

  cleanDedupe(key?: string): void {
    if (key) this.dedupes.delete(key)
  }
}
