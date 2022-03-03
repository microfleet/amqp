// Temporary Channel
const Channel = require('./channel');
const debug = require('./config').debug('amqp:TempChannel');

// This is just a skeleton of a simple channel object to pass around

class TemporaryChannel extends Channel {
  constructor(connection, channel, cb) {
    super(connection, channel);
    this.cb = cb;
    this.temporaryChannel();
  }

  _channelOpen() {
    debug('temp channel open');
    this.cb?.(null, this);
    this.cb = null;
  }

  _channelClosed() {
    // do nothing
  }

  _onMethod() {
    // do nothing
  }
}

module.exports = TemporaryChannel;
