// quick noop-logger implementation
import type { Logger, Level } from 'pino'

export const NoopLogger = (levels: Level[]): Logger => {
  const logger = Object.create(null)
  const noop = () => { /* noop */ }
  const assignLevels = (prev: Partial<Logger>, level: Level) => {
    prev[level] = noop
    return prev
  }

  // return itself
  logger.child = () => logger
  levels.reduce(assignLevels, logger)

  return logger
}
