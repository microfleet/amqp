import DEBUG = require('debug')

const DEBUG_LEVEL = process.env.AMQP
const debuggers = Object.create(null)

export const debug = (name: string) => {
  if (DEBUG_LEVEL == null) {
    return () => {
      // do nothing
    }
  }

  return (level: any, message?: any): void => {
    if (message == null && level) {
      message = level
      level = 1
    }

    if (level <= DEBUG_LEVEL) {
      if (!debuggers[name]) {
        debuggers[name] = DEBUG(name)
      }

      if (typeof message === 'function') {
        message = message()
      }

      debuggers[name](message)
    }
  }
}

