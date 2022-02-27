// Generated by CoffeeScript 2.6.1
(function() {
  // Channel
  var Channel, EventEmitter, OVERFLOW_PROTECTION, async, classes, debug, defaults, defer, methodTable, methods,
    boundMethodCheck = function(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new Error('Bound instance method accessed before binding'); } };

  ({EventEmitter} = require('events'));

  debug = require('./config').debug('amqp:Channel');

  async = require('async');

  defer = require('lodash/defer');

  defaults = require('./defaults');

  ({methodTable, classes, methods} = require('./config').protocol);

  // we track this to avoid node's max stack size with a saturated async queue
  OVERFLOW_PROTECTION = 0;

  Channel = class Channel extends EventEmitter {
    constructor(connection, channel) {
      super();
      this.reset = this.reset.bind(this);
      this.crash = this.crash.bind(this);
      this.close = this.close.bind(this);
      // TASK QUEUEING ---------------------------------------------------------
      this.taskPush = this.taskPush.bind(this);
      this.taskPushPreflight = this.taskPushPreflight.bind(this);
      this.taskQueuePushRaw = this.taskQueuePushRaw.bind(this);
      this.queueSendMethod = this.queueSendMethod.bind(this);
      this.queuePublish = this.queuePublish.bind(this);
      this._taskWorker = this._taskWorker.bind(this);
      this._callOutstandingCallbacks = this._callOutstandingCallbacks.bind(this);
      this.channel = channel;
      this.connection = connection;
      this.state = 'closed';
      this.waitingCallbacks = {}; // channel operations
      this.queue = async.queue(this._taskWorker, 1);
      this.open();
      this.transactional = false;
    }

    temporaryChannel() {
      this.transactional = true; // THIS IS NOT AMQP TRANSACTIONS
      this.lastChannelAccess = Date.now();
      if (process.env.AMQP_TEST != null) {
        this.connection.connectionOptions.temporaryChannelTimeout = 200;
        this.connection.connectionOptions.temporaryChannelTimeoutCheck = 100;
      }
      if (this.channelTracker == null) {
        return this.channelTracker = setInterval(() => {
          if (this.lastChannelAccess < (Date.now() - this.connection.connectionOptions.temporaryChannelTimeout)) {
            debug(4, function() {
              return "Closing channel due to inactivity";
            });
            return this.close(true);
          }
        }, this.connection.connectionOptions.temporaryChannelTimeoutCheck);
      }
    }

    open(cb) {
      if (this.state === "closed") {
        this.state = 'opening';
        if (cb != null) {
          this.waitForMethod(methods.channelOpenOk, cb);
        }
        this.connection._sendMethod(this.channel, methods.channelOpen, {});
        this.connection.channelCount++;
        if (this.transactional) {
          return this.temporaryChannel();
        }
      } else {
        if (cb != null) {
          return cb("state isn't closed.  not opening channel");
        }
      }
    }

    reset(cb) {
      boundMethodCheck(this, Channel);
      if (this.state !== 'open') {
        this._callOutstandingCallbacks("Channel Opening or Reseting");
      }
      // if our state is closed and either we arn't a transactional channel (queue, exchange declare etc..)
      // or we're within our acceptable time window for this queue
      if (this.state === 'closed' && (!this.transactional || this.listeners('open').length > 0 || (this.transactional && this.lastChannelAccess > (Date.now() - this.connection.connectionOptions.temporaryChannelTimeout)))) {
        debug(1, function() {
          return "State is closed... reconnecting";
        });
        return async.series([
          (next) => {
            return this.open(next);
          },
          (next) => {
            return this._onChannelReconnect(next);
          }
        ], cb);
      } else {
        if (cb != null) {
          return cb();
        }
      }
    }

    crash(cb) {
      boundMethodCheck(this, Channel);
      if (process.env.AMQP_TEST == null) {
        if (typeof cb === "function") {
          cb();
        }
        return true;
      }
      // this will crash a channel forcing a channelOpen from the server
      // this is really only for testing
      debug("Trying to crash channel");
      this.connection._sendMethod(this.channel, methods.queuePurge, {
        queue: "idontexist"
      });
      if (cb != null) {
        return this.waitForMethod(methods.channelClose, cb);
      }
    }

    close(auto) {
      boundMethodCheck(this, Channel);
      if ((auto == null) || !auto) {
        debug(1, function() {
          return "User requested channel close";
        });
      }
      clearInterval(this.channelTracker);
      this.channelTracker = null;
      if (this.state === 'open') {
        this.connection.channelCount--;
        this.state = 'closed';
        return this.connection._sendMethod(this.channel, methods.channelClose, {
          replyText: 'Goodbye',
          replyCode: 200,
          classId: 0,
          methodId: 0
        });
      }
    }

    waitForMethod(method, cb) {
      if (this.waitingCallbacks[method] == null) {
        this.waitingCallbacks[method.name] = [];
      }
      return this.waitingCallbacks[method.name].push(cb);
    }

    callbackForMethod(method) {
      var cb;
      if ((method == null) || (this.waitingCallbacks[method.name] == null)) {
        return function() {
          return true;
        };
      }
      cb = this.waitingCallbacks[method.name].shift();
      if (this.waitingCallbacks[method.name].length === 0) {
        delete this.waitingCallbacks[method.name];
      }
      return cb;
    }

    // Functions to overwrite
    _channelOpen() {
      return debug(4, function() {
        return "channel open called and should be overwritten";
      });
    }

    _channelClosed() {
      return debug(4, function() {
        return "channel closed called and should be overwritten";
      });
    }

    _onChannelReconnect(cb) {
      debug(4, function() {
        return "channel reconnect called and should be overwritten";
      });
      return cb();
    }

    _onMethod(method, args) {
      return debug(3, function() {
        return "_onMethod MUST be overwritten by whoever extends Channel";
      });
    }

    taskPush(method, args, okMethod, cb) { // same as queueSendMethod
      boundMethodCheck(this, Channel);
      return this.queue.push({
        type: 'method',
        method,
        args,
        okMethod,
        cb
      });
    }

    taskPushPreflight(method, args, okMethod, preflight, cb) {
      boundMethodCheck(this, Channel);
      return this.queue.push({
        type: 'method',
        method,
        args,
        okMethod,
        preflight,
        cb
      });
    }

    taskQueuePushRaw(task, cb) {
      boundMethodCheck(this, Channel);
      if ((cb != null) && (task != null)) {
        task.cb = cb;
      }
      return this.queue.push(task);
    }

    queueSendMethod(method, args, okMethod, cb) {
      boundMethodCheck(this, Channel);
      return this.queue.push({
        type: 'method',
        method,
        args,
        okMethod,
        cb
      });
    }

    queuePublish(method, data, options) {
      boundMethodCheck(this, Channel);
      return this.queue.push({
        type: 'publish',
        method,
        data,
        options
      });
    }

    _taskWorker(task, done) {
      var args, cb, data, doneFn, method, okMethod, options, preflight, type;
      boundMethodCheck(this, Channel);
      if (this.transactional) {
        this.lastChannelAccess = Date.now();
      }
      ({type, method, okMethod, args, cb, data, options, preflight} = task);
      doneFn = function(err, res) {
        if (cb != null) {
          cb(err, res);
        }
        if (OVERFLOW_PROTECTION > 100) {
          OVERFLOW_PROTECTION = 0;
          return defer(done);
        } else {
          OVERFLOW_PROTECTION++;
          return done();
        }
      };
      // if preflight is false do not proceed
      if ((preflight != null) && !preflight()) {
        return doneFn(new Error('preflight check failed'));
      }
      if (this.state === 'closed' && this.connection.state === 'open') {
        debug(1, function() {
          return "Channel reassign";
        });
        this.connection.channelManager.channelReassign(this);
        return this.open((e, r) => {
          return this._taskWorker(task, done);
        });
      } else if (this.state !== 'open') {
        // if our connection is closed that ok, but if its destroyed it will not reopen
        if (this.connection.state === 'destroyed') {
          return doneFn(new Error("Connection is destroyed"));
        } else {
          if (this.connection.channelManager.isChannelClosed(this.channel)) {
            this.connection.channelManager.channelReassign(this);
          }
          return this.once('open', () => {
            return this._taskWorker(task, done);
          });
        }
      } else {
        if (okMethod != null) {
          this.waitForMethod(okMethod, doneFn);
        }
        if (type === 'method') {
          this.connection._sendMethod(this.channel, method, args);
          if (okMethod == null) {
            return doneFn();
          }
        } else if (type === 'publish') {
          this.connection._sendMethod(this.channel, method, options);
          this.connection._sendBody(this.channel, data, options, function(err, res) {});
          if (okMethod == null) {
            return doneFn();
          }
        } else {
          throw new Error(`a task was queue with an unknown type of ${type}`);
        }
      }
    }

    _callOutstandingCallbacks(message) {
      var cb, cbs, key, outStandingCallbacks, results;
      boundMethodCheck(this, Channel);
      outStandingCallbacks = this.waitingCallbacks;
      this.waitingCallbacks = {};
      if (message == null) {
        message = "Channel Unavaliable";
      }
      results = [];
      for (key in outStandingCallbacks) {
        cbs = outStandingCallbacks[key];
        results.push((function() {
          var i, len, results1;
          results1 = [];
          for (i = 0, len = cbs.length; i < len; i++) {
            cb = cbs[i];
            results1.push(typeof cb === "function" ? cb(message) : void 0);
          }
          return results1;
        })());
      }
      return results;
    }

    // incomming channel messages for us
    _onChannelMethod(channel, method, args) {
      var closingMethod;
      if (this.transactional) {
        this.lastChannelAccess = Date.now();
      }
      if (channel !== this.channel) {
        return debug(1, function() {
          return ["channel was sent to the wrong channel object", channel, this.channel];
        });
      }
      this.callbackForMethod(method)(null, args);
      switch (method) {
        case methods.channelCloseOk:
          this.connection.channelManager.channelClosed(this.channel);
          this.state = 'closed';
          this._channelClosed(new Error("Channel closed"));
          return this._callOutstandingCallbacks({
            msg: "Channel closed"
          });
        case methods.channelClose:
          this.connection.channelManager.channelClosed(channel);
          debug(1, function() {
            return `Channel closed by server ${JSON.stringify(args)}`;
          });
          this.state = 'closed';
          if ((args.classId != null) && (args.methodId != null)) {
            closingMethod = methodTable[args.classId][args.methodId].name;
            this.callbackForMethod(methods[`${closingMethod}Ok`])(args); //this would be the error
          }
          this._channelClosed({
            msg: "Server closed channel",
            error: args
          });
          return this._callOutstandingCallbacks(`Channel closed by server ${JSON.stringify(args)}`);
        case methods.channelOpenOk:
          this.state = 'open';
          this._channelOpen();
          return this.emit('open');
        default:
          return this._onMethod(channel, method, args);
      }
    }

    _connectionClosed() {
      // if the connection closes, make sure we reflect that because that channel is also closed
      if (this.state !== 'closed') {
        this.state = 'closed';
        this._channelClosed();
        if (this.channelTracker != null) {
          clearInterval(this.channelTracker);
          return this.channelTracker = null;
        }
      }
    }

  };

  module.exports = Channel;

}).call(this);
