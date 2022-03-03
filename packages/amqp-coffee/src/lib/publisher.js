// Publisher
const { methods } = require('@microfleet/amqp-codec');
const { once } = require('events');

const debug = require('./config').debug('amqp:Publisher');
const Channel = require('./channel');
const defaults = require('./defaults');

const { BasicReturnError } = require('./errors');

const kEvents = Symbol('amqp:kEvents');
const { hasOwnProperty } = Object.prototype;

const transformData = (data, options) => {
  // data must be a buffer
  if (typeof data === 'string') {
    options.contentType = 'string/utf8';
    return Buffer.from(data, 'utf8');
  } if (typeof data === 'object' && !Buffer.isBuffer(data)) {
    if (options.contentType != null) {
      debug(1, () => `contentType specified but data isn't a buffer, ${JSON.stringify(options)}`);
      throw new Error('contentType specified but data isn\'t a buffer');
    }

    // default use JSON
    options.contentType = 'application/json';
    return Buffer.from(JSON.stringify(data), 'utf8');
  } if (data === undefined) {
    options.contentType = 'application/undefined';
    return Buffer.allocUnsafe(0);
  }

  return data;
};

class Publisher extends Channel {
  constructor(connection, channel, confirm) {
    super(connection, channel);

    debug(3, () => `Channel: ${channel} - ${confirm}`);

    this.seqCallbacks = new Map(); // publisher confirms
    this.confirm = confirm != null ? confirm : false;
    this.currentMethod = null;
    this.currentArgs = null;
    this[kEvents] = new Map();

    if (this.confirm) {
      this.confirmMode();
    }
  }

  confirmMode(cb) {
    this.confirmState = 'opening';
    debug(1, () => 'confirm mode waiting');
    this.taskPush(methods.confirmSelect, { noWait: false }, methods.confirmSelectOk, () => {
      this.confirmState = 'open';
      this.confirm = true;
      this.seq = 1;
      cb?.();
      debug(1, () => 'confirm mode on');
      this.emit('confirm');
    });
  }

  _channelClosed(message = new Error('Channel closed, try again')) {
    this.confirmState = 'closed';

    for (const cb of this.seqCallbacks.values()) {
      if (typeof cb === 'function') {
        cb(message);
      }
    }

    this.seqCallbacks = new Map();

    if (this.confirm) {
      this.confirmMode();
    }
  }

  _inoperableState() {
    return this.state !== 'open' || (this.confirm && this.confirmState !== 'open');
  }

  _recoverableState() {
    return this.state === 'opening'
      || this.state === 'closed'
      || (this.confirm && this.confirmState === 'opening');
  }

  async _wait(eventName) {
    if (this[kEvents].has(eventName)) {
      await this[kEvents].get(eventName);
    } else {
      const ev$ = once(this, eventName);
      this[kEvents].set(eventName, ev$);
      try {
        await ev$;
      } finally {
        this[kEvents].delete(eventName);
      }
    }
  }

  publish(exchange, routingKey, data, _options, _cb) {
    let cb = _cb;
    let options = _options;
    if (typeof _options === 'function') {
      cb = _options;
      options = Object.create(null);
    }

    this.publishAsync(exchange, routingKey, data, options)
      .then(() => cb?.(), cb);
  }

  async publishAsync(exchange, routingKey, _data, _options) {
    const options = _options
      ? { ..._options }
      : Object.create(null);

    if (this._inoperableState()) {
      if (this._recoverableState()) {
        await this._wait(this.confirm ? 'confirm' : 'open');
      } else {
        throw new Error(`Channel is closed and will not re-open? ${this.state} ${this.confirm} ${this.confirmState}`);
      }
    }

    // perform data transformation, ie obj -> buffer
    const data = transformData(_data, options);

    // Apply default options after we deal with potentially converting the data
    for (const [key, value] of Object.entries(defaults.basicPublish)) {
      if (!hasOwnProperty.call(options, key)) {
        options[key] = value;
      }
    }

    options.exchange = exchange;
    options.routingKey = routingKey;

    // increment this as the final step before publishing, to make sure we're in sync with the server
    let thisSequenceNumber = null;
    if (this.confirm) {
      thisSequenceNumber = this.seq++;

      // This is to tie back this message as failed if it failed in confirm mode with a mandatory or immediate publish
      if (options.mandatory || options.immediate) {
        if (options.headers) {
          options.headers['x-seq'] = thisSequenceNumber;
        } else {
          options.headers = { 'x-seq': thisSequenceNumber };
        }
      }
    }

    debug(4, () => JSON.stringify(options));
    this.queuePublish(methods.basicPublish, data, options);

    if (thisSequenceNumber !== null) {
      await this._waitForSeq(thisSequenceNumber);
    }
  }

  _onMethod(channel, method, args) {
    this.currentMethod = method;
    this.currentArgs = args;

    debug(1, () => 'onMethod');
    if (method === methods.basicAck && this.confirm) {
      this._gotSeq(args.deliveryTag, args.multiple);
    }
  }

  _onContentHeader(channel, classInfo, weight, properties, size) {
    debug(1, () => 'content header');
    if (this.currentMethod === methods.basicReturn && properties.headers?.['x-seq'] != null) {
      this._gotSeq(properties.headers['x-seq'], false, new BasicReturnError(this.currentArgs));
    }
  }

  _onContent(channel, data) {
    // Content is not needed on a basicReturn
  }

  async _waitForSeq(seq) {
    return new Promise((resolve, reject) => {
      this.seqCallbacks.set(seq, (err) => {
        err ? reject(err) : resolve();
      });
    });
  }

  _gotSeq(seq, multi, err = null) {
    if (multi) {
      for (const key of this.seqCallbacks.keys()) {
        if (key <= seq) {
          this.seqCallbacks.get(key)(err);
          this.seqCallbacks.delete(key);
        }
      }
    } else {
      if (this.seqCallbacks.has(seq)) {
        this.seqCallbacks.get(seq)(err);
      } else {
        debug(3, () => "got a seq for #{seq} but that callback either doesn't exist or was already called or was returned");
      }

      this.seqCallbacks.delete(seq);
    }
  }
}

module.exports = Publisher;
