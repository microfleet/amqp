import type { Logger, Level } from 'pino'

import { PinoLogger } from './pino-logger'
import { NoopLogger } from './noop-logger'

export const levels: Level[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal']

/**
 * @param obj
 */
export const isCompatible = (obj: unknown): obj is Logger => {
  return obj !== null
    && typeof obj === 'object'
    && levels.every((level) => typeof (obj as Record<string, unknown>)[level] === 'function')
}

export const prepareLogger = (config: { debug: boolean, log?: unknown, name: string }): Logger => {
  // bunyan logger
  if (config.debug && !config.log) {
    try {
      return PinoLogger(config.name)
    } catch (e: any) {
      process.emitWarning('failed to init pinoLogger', {
        detail: e.message
      })
      return NoopLogger(levels)
    }
  } else if (isCompatible(config.log)) {
    return config.log
  }

  return NoopLogger(levels)
}
