// ###

// Channel Manager

// we track and manage all the channels on a connection.
// we will dynamically add and remove publish channels... maybe
// we track confirm channels and non confirm channels separately.

// ###

const publisherPoolSize = 1;

const debug = require('./config').debug('amqp:ChannelManager');
const Publisher = require('./publisher');
const Consumer = require('./consumer');
const TemporaryChannel = require('./temporary-channel');

class ChannelManager {
  constructor(connection) {
    this.connection = connection;
    this.channels = this.connection.channels;

    this.publisherConfirmChannels = [];
    this.publisherChannels = [];

    this.tempChannel = null;
    this.queue = null;
    this.exchange = null;

    this.channelCount = this.connection.channelCount;
  }

  nextChannelNumber() {
    this.channelCount += 1;
    return this.channelCount;
  }

  publisherChannel(confirm, cb) {
    if (typeof confirm === 'function') {
      cb = confirm;
      confirm = false;
    }

    const pool = confirm
      ? this.publisherConfirmChannels
      : this.publisherChannels;

    if (pool.length < publisherPoolSize) {
      const channel = this.nextChannelNumber();
      const p = new Publisher(this.connection, channel, confirm);
      this.channels.set(channel, p);
      pool.push(p);
      return cb(null, p.channel);
    }

    const i = Math.floor(Math.random() * pool.length);
    return cb(null, pool[i].channel);
  }

  temporaryChannel(cb) {
    if (this.tempChannel != null) {
      debug('returning temp channel');
      cb?.(null, this.tempChannel);
      return this.tempChannel;
    }

    const channel = this.nextChannelNumber();

    this.tempChannel = new TemporaryChannel(this.connection, channel, (err, res) => {
      cb?.(err, res);
    });

    this.channels.set(channel, this.tempChannel);
    return this.tempChannel;
  }

  consumerChannel(cb) {
    const channel = this.nextChannelNumber();
    const s = new Consumer(this.connection, channel);
    this.channels.set(channel, s);
    return cb(null, channel);
  }

  channelReassign(channel) {
    this.channels.delete(channel.channel);
    const newChannelNumber = this.nextChannelNumber();
    channel.channel = newChannelNumber;
    this.channels.set(newChannelNumber, channel);
  }

  channelClosed(channelNumber) {
    this.channels.delete(channelNumber);
  }

  isChannelClosed(channelNumber) {
    return !this.channels.has(channelNumber);
  }
}

module.exports = ChannelManager;
