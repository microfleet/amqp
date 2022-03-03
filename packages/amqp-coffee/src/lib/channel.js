// Channel

const { EventEmitter } = require('events');
const debug = require('./config').debug('amqp:Channel');
const async = require('async');
const { methods, classMethodsTable } = require('@microfleet/amqp-codec');

// we track this to avoid node's max stack size with a saturated async queue
let OVERFLOW_PROTECTION = 0;

class Channel extends EventEmitter {
  constructor(connection, channel) {
    super();
    this.channel = channel;
    this.connection = connection;
    this.state = 'closed';
    this.waitingCallbacks = new Map(); // channel operations
    this.transactional = false;

    this.queue = async.queue(this._taskWorker.bind(this), 1);
    this.taskPush = this.taskPush.bind(this);
    this.open();
  }

  temporaryChannel() {
    this.transactional = true; // THIS IS NOT AMQP TRANSACTIONS
    this.lastChannelAccess = Date.now();

    if (process.env.AMQP_TEST != null) {
      this.connection.connectionOptions.temporaryChannelTimeout = 200;
      this.connection.connectionOptions.temporaryChannelTimeoutCheck = 100;
    }

    if (this.channelTracker == null) {
      const { temporaryChannelTimeout, temporaryChannelTimeoutCheck } = this.connection.connectionOptions;
      this.channelTracker = setInterval(() => {
        if (this.lastChannelAccess < (Date.now() - temporaryChannelTimeout)) {
          debug(4, () => 'Closing channel due to inactivity');
          this.close(true);
        }
      }, temporaryChannelTimeoutCheck);
    }
  }

  open(cb) {
    if (this.state === 'closed') {
      debug(1, ['opening channel', this.channel]);

      this.state = 'opening';

      if (cb) this.waitForMethod(methods.channelOpenOk, cb);
      this.connection._sendMethod(this.channel, methods.channelOpen, {});
      this.connection.channelCount += 1;

      if (this.transactional) this.temporaryChannel();
    } else if (cb) {
      debug(1, ['state isnt closed', this.channel]);
      cb(new Error("state isn't closed. not opening channel"));
    }
  }

  reset(cb) {
    debug(1, 'channel reset called');

    if (this.state !== 'open') {
      this._callOutstandingCallbacks(new Error('Channel Opening or Reseting'));
    }

    // if our state is closed and either we arn't a transactional channel (queue, exchange declare etc..)
    // or we're within our acceptable time window for this queue
    if (this.state === 'closed'
        && (
          !this.transactional
          || this.listeners('open').length > 0
          || (
            this.transactional
            && this.lastChannelAccess > (Date.now() - this.connection.connectionOptions.temporaryChannelTimeout)
          ))
    ) {
      debug(1, () => 'State is closed... reconnecting');

      async.series([
        (next) => this.open(next),
        (next) => this._onChannelReconnect(next),
      ], cb);
    } else {
      cb?.();
    }
  }

  crash(cb) {
    if (process.env.AMQP_TEST == null) {
      cb?.();
      return;
    }

    // this will crash a channel forcing a channelOpen from the server
    // this is really only for testing
    debug('Trying to crash channel');
    this.connection._sendMethod(this.channel, methods.queuePurge, { queue: 'idontexist' });
    if (cb) this.waitForMethod(methods.channelClose, cb);
  }

  close(auto) {
    if (auto == null || !auto) {
      debug(1, () => 'User requested channel close');
    }

    clearInterval(this.channelTracker);
    this.channelTracker = null;

    if (this.state === 'open') {
      this.connection.channelCount -= 1;
      this.state = 'closed';
      this.connection._sendMethod(this.channel, methods.channelClose, {
        replyText: 'Goodbye',
        replyCode: 200,
        classId: 0,
        methodId: 0,
      });
    }
  }

  waitForMethod(method, cb) {
    const { waitingCallbacks } = this;

    if (!waitingCallbacks.has(method.name)) {
      waitingCallbacks.set(method.name, [cb]);
    } else {
      waitingCallbacks.get(method.name).push(cb);
    }
  }

  callbackForMethod(method) {
    const { waitingCallbacks } = this;

    if (method == null || !waitingCallbacks.has(method.name)) {
      return () => true;
    }

    const methodCallback = waitingCallbacks.get(method.name);
    const cb = methodCallback.shift();
    if (methodCallback.length === 0) {
      waitingCallbacks.delete(method.name);
    }

    return cb;
  }

  // Functions to overwrite
  _channelOpen() {
    debug(4, () => 'channel open called and should be overwritten');
  }

  _channelClosed() {
    debug(4, () => 'channel closed called and should be overwritten');
  }

  _onChannelReconnect(cb) {
    debug(4, () => 'channel reconnect called and should be overwritten');
    cb();
  }

  _onMethod() {
    debug(3, () => '_onMethod MUST be overwritten by whoever extends Channel');
  }

  // TASK QUEUEING ---------------------------------------------------------
  taskPush(method, args, okMethod, cb) { // same as queueSendMethod
    this.queue.push({
      type: 'method', method, args, okMethod, cb,
    });
  }

  taskPushPreflight(method, args, okMethod, preflight, cb) {
    this.queue.push({
      type: 'method', method, args, okMethod, preflight, cb,
    });
  }

  taskQueuePushRaw(task, cb) {
    if (cb != null && task != null) {
      task.cb = cb;
    }

    this.queue.push(task);
  }

  queueSendMethod(method, args, okMethod, cb) {
    this.queue.push({
      type: 'method', method, args, okMethod, cb,
    });
  }

  queuePublish(method, data, options) {
    this.queue.push({
      type: 'publish', method, data, options,
    });
  }

  _taskWorker(task, done) {
    if (this.transactional) {
      this.lastChannelAccess = Date.now();
    }

    const {
      type, method, okMethod, args, cb, data, options, preflight,
    } = task;

    const doneFn = (err, res) => {
      cb?.(err, res);
      if (OVERFLOW_PROTECTION > 100) {
        OVERFLOW_PROTECTION = 0;
        process.nextTick(done);
      } else {
        OVERFLOW_PROTECTION += 1;
        done();
      }
    };

    // if preflight is false do not proceed
    if (preflight != null && !preflight()) {
      doneFn(new Error('preflight check failed'));
      return;
    }

    if (this.state === 'closed' && this.connection.state === 'open') {
      debug(1, () => 'Channel reassign');
      this.connection.channelManager.channelReassign(this);
      this.open(() => {
        this._taskWorker(task, done);
      });
    } else if (this.state !== 'open') {
      // if our connection is closed that ok, but if its destroyed it will not reopen
      if (this.connection.state === 'destroyed') {
        doneFn(new Error('Connection is destroyed'));
      } else {
        if (this.connection.channelManager.isChannelClosed(this.channel)) {
          this.connection.channelManager.channelReassign(this);
        }

        this.once('open', () => {
          this._taskWorker(task, done);
        });
      }
    } else {
      if (okMethod != null) {
        this.waitForMethod(okMethod, doneFn);
      }

      if (type === 'method') {
        this.connection._sendMethod(this.channel, method, args);
        if (okMethod == null) doneFn();
      } else if (type === 'publish') {
        this.connection._sendMethod(this.channel, method, options);
        this.connection._sendBody(this.channel, data, options, () => { /* ignore err */ });
        if (okMethod == null) doneFn();
      } else {
        throw new Error(`a task was queue with an unknown type of ${type}`);
      }
    }
  }

  _callOutstandingCallbacks(message = new Error('Channel Unavaliable')) {
    const outStandingCallbacks = this.waitingCallbacks;
    this.waitingCallbacks = new Map();

    for (const cbs of outStandingCallbacks.values()) {
      for (const cb of cbs) {
        cb(message);
      }
    }
  }

  // incomming channel messages for us
  _onChannelMethod(channel, method, args) {
    if (this.transactional) {
      this.lastChannelAccess = Date.now();
    }

    if (channel !== this.channel) {
      debug(1, () => ['channel was sent to the wrong channel object', channel, this.channel]);
      return;
    }

    this.callbackForMethod(method)(null, args);

    switch (method) {
      case methods.channelCloseOk:
        this.connection.channelManager.channelClosed(this.channel);
        this.state = 'closed';

        this._channelClosed(new Error('Channel closed'));
        this._callOutstandingCallbacks(new Error('Channel closed'));
        break;

      case methods.channelClose: {
        this.connection.channelManager.channelClosed(channel);

        debug(1, () => ['Channel closed by server', args]);
        this.state = 'closed';

        if (args.classId != null && args.methodId != null) {
          const closingMethod = classMethodsTable[`${args.classId}_${args.methodId}`].name;
          this.callbackForMethod(methods[`${closingMethod}Ok`])(args); // this would be the error
        }

        this._channelClosed({ msg: 'Server closed channel', error: args });
        this._callOutstandingCallbacks(new Error(`Channel closed by server ${JSON.stringify(args)}`));
        break;
      }

      case methods.channelOpenOk:
        this.state = 'open';
        this._channelOpen();
        this.emit('open');
        break;

      default:
        this._onMethod(channel, method, args);
    }
  }

  _connectionClosed() {
    debug(1, [this.channel, 'channel closed event']);

    // if the connection closes, make sure we reflect that because that channel is also closed
    if (this.state !== 'closed') {
      this.state = 'closed';
      this._channelClosed();
      if (this.channelTracker != null) {
        clearInterval(this.channelTracker);
        this.channelTracker = null;
      }
    }
  }
}

module.exports = Channel;
