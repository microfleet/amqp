import HLRU from 'hashlru'
import hash from 'object-hash'
import { latency } from './latency'

export class Cache {
  public readonly enabled: boolean
  private readonly cache!: ReturnType<typeof HLRU>

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
   * @param {any} message
   * @param maxAge
   * @returns
   */
  get(message: any, maxAge: number | undefined) {
    if (this.enabled === false) {
      return null
    }

    if (typeof maxAge !== 'number' || maxAge <= 0) {
      return null
    }

    const hashKey = hash(message)
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
   * @param {string} key
   * @param {any} data
   * @returns
   */
  set(key: string, data: any) {
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
}
