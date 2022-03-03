// Temporary Channel
const Channel = require('./Channel')

// This is just a skeleton of a simple channel object to pass around

class TemporaryChannel extends Channel {
  constructor(connection, channel, cb) {
    super(connection, channel)
    this.cb = cb
    this.temporaryChannel()
  }

  _channelOpen() {
    this.cb?.(null, this)
    this.cb = null
  }

  _channelClosed() {
    // do nothing
  }

  _onMethod() {
    // do nothing
  }
}

module.exports = TemporaryChannel
