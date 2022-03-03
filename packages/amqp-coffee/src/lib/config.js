const DEBUG = require('debug')
const DEBUG_LEVEL = process.env.AMQP

const debuggers = {}
const debug = (name) => {
  if (DEBUG_LEVEL == null) {
    return () => {
      // do nothing
    }
  } else {
    return (level, message) => {
      if (message == null && level) {
        message = level
        level   = 1
      }

      if (level <= DEBUG_LEVEL) {
        if (!debuggers[name]) {
          debuggers[name] = DEBUG(name)
        }

        if (typeof message === 'function') {
          message = message()
        }

        debuggers[name](message)
      } else {
        return () => {
          // do nothing
        }
      }
    }
  }
}

module.exports = { debug }
