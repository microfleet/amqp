// Generated by CoffeeScript 2.6.1
(function() {
  var AMQPParser, ChannelManager, Connection, EndFrame, EventEmitter, Exchange, FrameType, HeartbeatFrame, Queue, applyDefaults, async, classes, debug, defaults, defer, delay, flatten, hasOwnProperty, keys, methodTable, methods, net, once, serializeFields, serializeInt, tls,
    boundMethodCheck = function(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new Error('Bound instance method accessed before binding'); } };

  debug = require('./config').debug('amqp:Connection');

  ({EventEmitter} = require('events'));

  net = require('net');

  tls = require('tls');

  async = require('async');

  once = require('lodash/once');

  applyDefaults = require('lodash/defaults');

  defer = require('lodash/defer');

  flatten = require('lodash/flattenDeep');

  delay = require('lodash/delay');

  keys = require('lodash/keys');

  defaults = require('./defaults');

  ({methodTable, classes, methods} = require('./config').protocol);

  ({FrameType, HeartbeatFrame, EndFrame} = require('./config').constants);

  ({serializeInt, serializeFields} = require('./serializationHelpers'));

  Queue = require('./Queue');

  Exchange = require('./Exchange');

  AMQPParser = require('./AMQPParser');

  ChannelManager = require('./ChannelManager');

  if (process.env.AMQP_TEST != null) {
    defaults.connection.reconnectDelayTime = 100;
  }

  hasOwnProperty = Object.prototype.hasOwnProperty;

  Connection = class Connection extends EventEmitter {
    /*

      host: localhost | [localhost, localhost] | [{host: localhost, port: 5672}, {host: localhost, port: 5673}]
      port: int
      vhost: %2F
      hostRandom: default false, if host is an array

      @state : opening | open | closed | reconnecting | destroyed

    */
    constructor(args, cb) {
      super();
      this.updateConnectionOptionsHostInformation = this.updateConnectionOptionsHostInformation.bind(this);
      // channel is optional!
      this.publish = this.publish.bind(this);
      this.close = this.close.bind(this);
      // TESTING OUT OF ORDER OPERATION
      this.crashOOO = this.crashOOO.bind(this);
      // Service Called Functions
      this._connectedFirst = this._connectedFirst.bind(this);
      this._connectionErrorEvent = this._connectionErrorEvent.bind(this);
      this._connectionClosedEvent = this._connectionClosedEvent.bind(this);
      this._reestablishChannels = this._reestablishChannels.bind(this);
      this._closed = this._closed.bind(this);
      // we should expect a heartbeat at least once every heartbeat interval x 2
      // we should reset this timer every time we get a heartbeat

      // on initial connection we should start expecting heart beats
      // on disconnect or close we should stop expecting these.
      // on heartbeat received we should expect another
      this._receivedHeartbeat = this._receivedHeartbeat.bind(this);
      this._resetAllHeartbeatTimers = this._resetAllHeartbeatTimers.bind(this);
      this._resetHeartbeatTimer = this._resetHeartbeatTimer.bind(this);
      this._clearHeartbeatTimer = this._clearHeartbeatTimer.bind(this);
      this._resetSendHeartbeatTimer = this._resetSendHeartbeatTimer.bind(this);
      this._sendHeartbeat = this._sendHeartbeat.bind(this);
      // called directly in tests to simulate missed heartbeat
      this._missedHeartbeat = this._missedHeartbeat.bind(this);
      this._sendMethod = this._sendMethod.bind(this);
      // Only used in sendBody
      this._sendHeader = this._sendHeader.bind(this);
      this._sendBody = this._sendBody.bind(this);
      this._onContentHeader = this._onContentHeader.bind(this);
      this._onContent = this._onContent.bind(this);
      this._onMethod = this._onMethod.bind(this);
      this.id = Math.round(Math.random() * 1000);
      if (typeof args === 'function') {
        cb = args;
        args = {};
      }
      if (cb != null) {
        // this is the main connect event
        cb = once(cb);
      }
      this.cb = cb;
      this.state = 'opening';
      this.connectionOptions = applyDefaults(args, defaults.connection);
      // setup our defaults
      this.channelCount = 0;
      this.channels = {
        0: this
      };
      this.queues = {};
      this.exchanges = {};
      // connection tuning paramaters
      this.channelMax = this.connectionOptions.channelMax;
      this.frameMax = this.connectionOptions.frameMax;
      this.sendBuffer = Buffer.allocUnsafe(this.frameMax);
      this.channelManager = new ChannelManager(this);
      async.series([
        (next) => {
          // determine to host to connect to if we have an array of hosts
          this.connectionOptions.hosts = flatten([this.connectionOptions.host]).map((uri) => {
            var host,
        port;
            if ((uri.port != null) && (uri.host != null)) {
              return {
                host: uri.host.toLowerCase(),
                port: parseInt(uri.port)
              };
            // our host name has a : and theat implies a uri with host and port
            } else if (typeof uri === 'string' && uri.indexOf(":") !== -1) {
              [host,
        port] = uri.split(":");
              return {
                host: host.toLowerCase(),
                port: parseInt(port)
              };
            } else if (typeof uri === 'string') {
              return {
                host: uri.toLowerCase(),
                port: !this.connectionOptions.ssl ? this.connectionOptions.port : this.connectionOptions.sslPort
              };
            } else {
              throw new Error(`we dont know what do do with the host ${uri}`);
            }
          });
          this.connectionOptions.hosti = 0;
          if (this.connectionOptions.hostRandom) {
            this.connectionOptions.hosti = Math.floor(Math.random() * this.connectionOptions.hosts.length);
          }
          this.updateConnectionOptionsHostInformation();
          return next();
        },
        (next) => {
          var ref;
          if (((ref = this.connectionOptions.rabbitMasterNode) != null ? ref.queue : void 0) != null) {
            return require('./plugins/rabbit').masterNode(this,
        this.connectionOptions.rabbitMasterNode.queue,
        next);
          } else {
            return next();
          }
        },
        (next) => {
          var ref,
        setupConnectionListeners,
        setupTlsConnection,
        tlsOptions;
          setupConnectionListeners = () => {
            var connectionEvent;
            if (this.connectionOptions.ssl) {
              connectionEvent = 'secureConnect';
            } else {
              connectionEvent = 'connect';
            }
            this.connection.once(connectionEvent,
        () => {
              return this._connectedFirst();
            });
            this.connection.on(connectionEvent,
        () => {
              return this._connected();
            });
            this.connection.on('error',
        this._connectionErrorEvent);
            return this.connection.on('close',
        this._connectionClosedEvent);
          };
          if (this.connectionOptions.ssl) {
            tlsOptions = (ref = this.connectionOptions.sslOptions) != null ? ref : {};
            setupTlsConnection = () => {
              var ref1;
              if (this.connection != null) {
                this.connection.removeAllListeners();
                if (((ref1 = this.connection) != null ? ref1.socket : void 0) != null) {
                  this.connection.socket.end();
                }
              }
              this.connection = tls.connect(this.connectionOptions.port,
        this.connectionOptions.host,
        tlsOptions,
        () => {
                return this.connection.on('error',
        () => {
                  return this.connection.emit('close');
                });
              });
              this.connection.connect = setupTlsConnection;
              return setupConnectionListeners();
            };
            setupTlsConnection();
          } else {
            this.connection = net.connect(this.connectionOptions.port,
        this.connectionOptions.host);
            setupConnectionListeners();
          }
          if (this.connectionOptions.noDelay) {
            this.connection.setNoDelay();
          }
          // start listening for timeouts
          if ((this.connectionOptions.connectTimeout != null) && !this.connectionOptions.reconnect) {
            clearTimeout(this._connectTimeout);
            this._connectTimeout = setTimeout(() => {
              debug(1,
        function() {
                return "Connection timeout triggered";
              });
              this.close();
              return typeof cb === "function" ? cb({
                code: 'T',
                message: 'Connection Timeout',
                host: this.connectionOptions.host,
                port: this.connectionOptions.port
              }) : void 0;
            },
        this.connectionOptions.connectTimeout);
          }
          return next();
        }
      ], function(e, r) {
        if ((e != null) && (cb != null)) {
          return cb(e);
        }
      });
      if (cb != null) {
        this.once('ready', cb);
      }
      this.on('close', this._closed);
      return this;
    }

    updateConnectionOptionsHostInformation() {
      boundMethodCheck(this, Connection);
      this.connectionOptions.host = this.connectionOptions.hosts[this.connectionOptions.hosti].host;
      return this.connectionOptions.port = this.connectionOptions.hosts[this.connectionOptions.hosti].port;
    }

    // User called functions
    queue(args, cb) {
      if ((cb == null) || typeof cb !== 'function') {
        return new Queue(this.channelManager.temporaryChannel(), args);
      } else {
        return this.channelManager.temporaryChannel(function(err, channel) {
          var q;
          if (err != null) {
            return cb(err);
          }
          return q = new Queue(channel, args, cb);
        });
      }
    }

    exchange(args, cb) {
      if ((cb == null) || typeof cb !== 'function') {
        return new Exchange(this.channelManager.temporaryChannel(), args);
      } else {
        return this.channelManager.temporaryChannel(function(err, channel) {
          var e;
          if (err != null) {
            return cb(err);
          }
          return e = new Exchange(channel, args, cb);
        });
      }
    }

    consume(queueName, options, messageParser, cb) {
      return this.channelManager.consumerChannel((err, channel) => {
        var consumerChannel;
        if (err == null) {
          consumerChannel = this.channels[channel];
        }
        if ((err != null) || (consumerChannel == null)) {
          return cb({err, channel});
        }
        return consumerChannel.consume(queueName, options, messageParser, cb);
      });
    }

    publish(exchange, routingKey, data, options, cb) {
      var confirm;
      boundMethodCheck(this, Connection);
      if ((cb != null) && options.confirm) { // there is no point to confirm without a callback
        confirm = true;
      } else {
        confirm = false;
      }
      return this.channelManager.publisherChannel(confirm, (err, channel) => {
        var publishChannel;
        if (err == null) {
          publishChannel = this.channels[channel];
        }
        //TODO figure out error messages
        if ((err != null) || (publishChannel == null)) {
          return cb({err, channel});
        }
        return publishChannel.publish(exchange, routingKey, data, options, cb);
      });
    }

    close(cb) {
      boundMethodCheck(this, Connection);
      // should close all the things and reset for a new clean guy
      // @connection.removeAllListeners() TODO evaluate this
      this._clearHeartbeatTimer();
      return defer(() => {
        var forceConnectionClose, state;
        this.state = 'destroyed';
        if (cb != null) {
          cb = once(cb);
        }
        // only atempt to cleanly close the connection if our current connection is writable
        if (this.connection.writable) {
          this._sendMethod(0, methods.connectionClose, {
            classId: 0,
            methodId: 0,
            replyCode: 200,
            replyText: 'closed'
          });
        } else {
          return typeof cb === "function" ? cb() : void 0;
        }
        state = {
          write: this.connection.writable,
          read: this.connection.readable
        };
        forceConnectionClose = setTimeout(() => {
          this.connection.destroy();
          return typeof cb === "function" ? cb() : void 0;
        }, 1000);
        return this.connection.once('close', function() {
          clearTimeout(forceConnectionClose);
          return typeof cb === "function" ? cb() : void 0;
        });
      });
    }

    crashOOO() {
      boundMethodCheck(this, Connection);
      if (process.env.AMQP_TEST == null) {
        return true;
      }
      // this will crash a channel forcing an out of order operation
      debug("Trying to crash connection by an oow op");
      return this._sendBody(this.channel, Buffer.alloc(100), {});
    }

    _connectedFirst() {
      boundMethodCheck(this, Connection);
      return debug(1, () => {
        return `Connected to ${this.connectionOptions.host}:${this.connectionOptions.port}`;
      });
    }

    _connected() {
      clearTimeout(this._connectTimeout);
      this._resetAllHeartbeatTimers();
      return this._setupParser(this._reestablishChannels);
    }

    _connectionErrorEvent(e, r) {
      boundMethodCheck(this, Connection);
      if (this.state !== 'destroyed') {
        debug(1, () => {
          return ["Connection Error ", e, r, this.connectionOptions.host];
        });
      }
      if (!this.connectionOptions.reconnect) {
        if (this.cb != null) {
          return this.cb(e, r);
        } else {
          return this.emit('error', e);
        }
      }
    }

    _connectionClosedEvent(had_error) {
      var channel, channelNumber, ref;
      boundMethodCheck(this, Connection);
      ref = this.channels;
      // go through all of our channels and close them
      for (channelNumber in ref) {
        channel = ref[channelNumber];
        if (typeof channel._connectionClosed === "function") {
          channel._connectionClosed();
        }
      }
      clearTimeout(this._connectTimeout);
      if (this.state === "open") {
        this.emit('close');
      }
      if (this.state !== 'destroyed') {
        if (!this.connectionOptions.reconnect) {
          debug(1, function() {
            return "Connection closed not reconnecting...";
          });
          return;
        }
        this.state = 'reconnecting';
        debug(1, function() {
          return "Connection closed reconnecting...";
        });
        return delay(() => {
          // rotate hosts if we have multiple hosts
          if (this.connectionOptions.hosts.length > 1) {
            this.connectionOptions.hosti = (this.connectionOptions.hosti + 1) % this.connectionOptions.hosts.length;
            this.updateConnectionOptionsHostInformation();
          }
          return this.connection.connect(this.connectionOptions.port, this.connectionOptions.host);
        }, this.connectionOptions.reconnectDelayTime);
      }
    }

    _reestablishChannels() {
      boundMethodCheck(this, Connection);
      return async.forEachSeries(keys(this.channels), (channel, done) => {
        var base;
        if (channel === "0") {
          return done();
        } else {
          // check to make sure the channel is still around before attempting to reset it
          // the channel could have been temporary
          if (this.channelManager.isChannelClosed(channel)) {
            return done();
          } else {
            return typeof (base = this.channels[channel]).reset === "function" ? base.reset(done) : void 0;
          }
        }
      });
    }

    _closed() {
      boundMethodCheck(this, Connection);
      return this._clearHeartbeatTimer();
    }

    _receivedHeartbeat() {
      boundMethodCheck(this, Connection);
      debug(4, function() {
        return "♥ heartbeat";
      });
      return this._resetHeartbeatTimer();
    }

    _resetAllHeartbeatTimers() {
      boundMethodCheck(this, Connection);
      this._resetSendHeartbeatTimer();
      return this._resetHeartbeatTimer();
    }

    _resetHeartbeatTimer() {
      boundMethodCheck(this, Connection);
      debug(6, function() {
        return "_resetHeartbeatTimer";
      });
      clearInterval(this.heartbeatTimer);
      return this.heartbeatTimer = setInterval(this._missedHeartbeat, this.connectionOptions.heartbeat * 2);
    }

    _clearHeartbeatTimer() {
      boundMethodCheck(this, Connection);
      debug(6, function() {
        return "_clearHeartbeatTimer";
      });
      clearInterval(this.heartbeatTimer);
      clearInterval(this.sendHeartbeatTimer);
      this.heartbeatTimer = null;
      return this.sendHeartbeatTimer = null;
    }

    _resetSendHeartbeatTimer() {
      boundMethodCheck(this, Connection);
      debug(6, function() {
        return "_resetSendHeartbeatTimer";
      });
      clearInterval(this.sendHeartbeatTimer);
      return this.sendHeartbeatTimer = setInterval(this._sendHeartbeat, this.connectionOptions.heartbeat);
    }

    _sendHeartbeat() {
      boundMethodCheck(this, Connection);
      return this.connection.write(HeartbeatFrame);
    }

    _missedHeartbeat() {
      boundMethodCheck(this, Connection);
      if (this.state === 'open') {
        debug(1, function() {
          return "We missed a heartbeat, destroying the connection.";
        });
        this.connection.destroy();
      }
      return this._clearHeartbeatTimer();
    }

    _setupParser(cb) {
      if (this.parser != null) {
        this.parser.removeAllListeners();
      }
      // setup the parser
      this.parser = new AMQPParser('0-9-1', 'client', this);
      this.parser.on('method', this._onMethod);
      this.parser.on('contentHeader', this._onContentHeader);
      this.parser.on('content', this._onContent);
      this.parser.on('heartbeat', this._receivedHeartbeat);
      // network --> parser
      // send any connection data events to our parser
      this.connection.removeAllListeners('data'); // cleanup reconnections
      this.connection.on('data', (data) => {
        return this.parser.execute(data);
      });
      if (cb != null) {
        this.removeListener('ready', cb);
        return this.once('ready', cb);
      }
    }

    _sendMethod(channel, method, args) {
      var b, endIndex, lengthIndex, methodBuffer, ref, startIndex;
      boundMethodCheck(this, Connection);
      if (channel !== 0 && ((ref = this.state) === 'opening' || ref === 'reconnecting')) {
        return this.once('ready', () => {
          return this._sendMethod(channel, method, args);
        });
      }
      debug(3, function() {
        return `${channel} < ${method.name}`;
      });
      b = this.sendBuffer;
      b.used = 0;
      b[b.used++] = 1; // constants. FrameType.METHOD
      serializeInt(b, 2, channel);
      // will replace with actuall length later
      lengthIndex = b.used;
      serializeInt(b, 4, 0);
      startIndex = b.used;
      serializeInt(b, 2, method.classIndex); // short, classId
      serializeInt(b, 2, method.methodIndex); // short, methodId
      serializeFields(b, method.fields, args, true);
      endIndex = b.used;
      // write in the frame length now that we know it.
      b.used = lengthIndex;
      serializeInt(b, 4, endIndex - startIndex);
      b.used = endIndex;
      b[b.used++] = 206; // constants Indicators.frameEnd;
      
      // we create this new buffer to make sure it doesn't get overwritten in a situation where we're backed up flushing to the network
      methodBuffer = Buffer.allocUnsafe(b.used);
      b.copy(methodBuffer, 0, 0, b.used);
      this.connection.write(methodBuffer);
      return this._resetSendHeartbeatTimer();
    }

    _sendHeader(channel, size, args) {
      var b, bodyEnd, bodyStart, classInfo, field, headerBuffer, i, j, k, len, len1, lengthStart, propertyFields, propertyFlag, propertyFlags, ref;
      boundMethodCheck(this, Connection);
      debug(3, () => {
        return `${this.id} ${channel} < header ${size}`;
      });
      b = this.sendBuffer;
      classInfo = classes[60];
      b.used = 0;
      b[b.used++] = 2; // constants. FrameType.HEADER
      serializeInt(b, 2, channel);
      lengthStart = b.used;
      serializeInt(b, 4, 0); // temporary length
      bodyStart = b.used;
      serializeInt(b, 2, classInfo.index); // class 60 for Basic
      serializeInt(b, 2, 0); // weight, always 0 for rabbitmq
      serializeInt(b, 8, size); // byte size of body
      
      //properties - first propertyFlags
      propertyFlags = [0];
      propertyFields = [];
      ref = classInfo.fields;
      /*
      The property flags are an array of bits that indicate the presence or absence of each
      property value in sequence. The bits are ordered from most high to low - bit 15 indicates
      the first property.

      The property flags can specify more than 16 properties. If the last bit (0) is set, this indicates that a
      further property flags field follows. There are many property flags fields as needed.
      */
      for (i = j = 0, len = ref.length; j < len; i = ++j) {
        field = ref[i];
        if ((i + 1) % 16 === 0) {
          // we have more than 15 properties, set bit 0 to 1 of the previous bit set
          propertyFlags[Math.floor((i - 1) / 15)] |= 1 << 0;
          propertyFlags.push(0);
        }
        if (hasOwnProperty.call(args, field.name)) {
          propertyFlags[Math.floor(i / 15)] |= 1 << (15 - i);
        }
      }
      for (k = 0, len1 = propertyFlags.length; k < len1; k++) {
        propertyFlag = propertyFlags[k];
        serializeInt(b, 2, propertyFlag);
      }
      //now the actual properties.
      serializeFields(b, classInfo.fields, args, false);
      //serializeTable(b, props);
      bodyEnd = b.used;
      // Go back to the header and write in the length now that we know it.
      b.used = lengthStart;
      serializeInt(b, 4, bodyEnd - bodyStart);
      b.used = bodyEnd;
      b[b.used++] = 206; // constants.frameEnd;
      
      // we create this new buffer to make sure it doesn't get overwritten in a situation where we're backed up flushing to the network
      headerBuffer = Buffer.allocUnsafe(b.used);
      b.copy(headerBuffer, 0, 0, b.used);
      this.connection.write(headerBuffer);
      return this._resetSendHeartbeatTimer();
    }

    _sendBody(channel, body, args, cb) {
      var h, length, offset;
      boundMethodCheck(this, Connection);
      if (body instanceof Buffer) {
        this._sendHeader(channel, body.length, args);
        offset = 0;
        while (offset < body.length) {
          length = Math.min(body.length - offset, this.frameMax);
          h = Buffer.allocUnsafe(7);
          h.used = 0;
          h[h.used++] = 3; // constants.frameBody
          serializeInt(h, 2, channel);
          serializeInt(h, 4, length);
          debug(3, () => {
            return `${this.id} ${channel} < body ${offset}, ${offset + length} of ${body.length}`;
          });
          this.connection.write(h);
          this.connection.write(body.slice(offset, offset + length));
          this.connection.write(EndFrame);
          this._resetSendHeartbeatTimer();
          offset += this.frameMax;
        }
        if (typeof cb === "function") {
          cb();
        }
        return true;
      } else {
        debug(1, function() {
          return "invalid body type";
        });
        if (typeof cb === "function") {
          cb("Invalid body type for publish, expecting a buffer");
        }
        return false;
      }
    }

    _onContentHeader(channel, classInfo, weight, properties, size) {
      boundMethodCheck(this, Connection);
      this._resetHeartbeatTimer();
      channel = this.channels[channel];
      if ((channel != null ? channel._onContentHeader : void 0) != null) {
        return channel._onContentHeader(channel, classInfo, weight, properties, size);
      } else {
        return debug(1, function() {
          return [`unhandled -- _onContentHeader ${channel} > `, {classInfo, properties, size}];
        });
      }
    }

    _onContent(channel, data) {
      boundMethodCheck(this, Connection);
      this._resetHeartbeatTimer();
      channel = this.channels[channel];
      if ((channel != null ? channel._onContent : void 0) != null) {
        return channel._onContent(channel, data);
      } else {
        return debug(1, function() {
          return `unhandled -- _onContent ${channel} > ${data.length}`;
        });
      }
    }

    _onMethod(channel, method, args) {
      var e, serverVersionError;
      boundMethodCheck(this, Connection);
      this._resetHeartbeatTimer();
      if (channel > 0) {
        if (this.channels[channel] == null) {
          return debug(1, function() {
            return `Received a message on untracked channel ${channel}, ${method.name} ${JSON.stringify(args)}`;
          });
        }
        if (this.channels[channel]._onChannelMethod == null) {
          return debug(1, function() {
            return `Channel ${channel} has no _onChannelMethod`;
          });
        }
        return this.channels[channel]._onChannelMethod(channel, method, args);
      } else {
        // connection methods for channel 0
        switch (method) {
          case methods.connectionStart:
            if (args.versionMajor !== 0 && args.versionMinor !== 9) {
              serverVersionError = new Error('Bad server version');
              serverVersionError.code = 'badServerVersion';
              return this.emit('error', serverVersionError);
            }
            // set our server properties up
            this.serverProperties = args.serverProperties;
            return this._sendMethod(0, methods.connectionStartOk, {
              clientProperties: this.connectionOptions.clientProperties,
              mechanism: 'AMQPLAIN',
              response: {
                LOGIN: this.connectionOptions.login,
                PASSWORD: this.connectionOptions.password
              },
              locale: 'en_US'
            });
          case methods.connectionTune:
            if ((args.channelMax != null) && args.channelMax !== 0 && args.channelMax < this.channelMax || this.channelMax === 0) {
              this.channelMax = args.channelMax;
            }
            if ((args.frameMax != null) && args.frameMax < this.frameMax) {
              this.frameMax = args.frameMax;
              this.sendBuffer = Buffer.allocUnsafe(this.frameMax);
            }
            this._sendMethod(0, methods.connectionTuneOk, {
              channelMax: this.channelMax,
              frameMax: this.frameMax,
              heartbeat: this.connectionOptions.heartbeat / 1000
            });
            return this._sendMethod(0, methods.connectionOpen, {
              virtualHost: this.connectionOptions.vhost
            });
          case methods.connectionOpenOk:
            this.state = 'open';
            return this.emit('ready');
          case methods.connectionClose:
            this.state = 'closed';
            this._sendMethod(0, methods.connectionCloseOk, {});
            e = new Error(args.replyText);
            e.code = args.replyCode;
            return this.emit('close', e);
          case methods.connectionCloseOk:
            this.emit('close');
            return this.connection.destroy();
          default:
            return debug(1, function() {
              return `0 < no matched method on connection for ${method.name}`;
            });
        }
      }
    }

  };

  module.exports = Connection;

}).call(this);
