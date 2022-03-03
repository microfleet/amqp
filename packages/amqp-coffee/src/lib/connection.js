const debug = require('./config').debug('amqp:Connection');

const { EventEmitter } = require('events');
const net = require('net');
const tls = require('tls');
const async = require('async');

const bytes = require('bytes');
const once = require('lodash/once');
const applyDefaults = require('lodash/defaults');

const {
  HandshakeFrame,
  Parser,
  Serializer,
  FrameType,
  methods,
} = require('@microfleet/amqp-codec');
const { setSocketReadBuffer, setSocketWriteBuffer } = require('./utils/set-sock-opts');
const ChannelManager = require('./channel-manager');
const Exchange = require('./exchange');
const Queue = require('./queue');
const defaults = require('./defaults');

if (process.env.AMQP_TEST) {
  defaults.connection.reconnectDelayTime = 100;
}

class Connection extends EventEmitter {
  // ###

  //   host: localhost | [localhost, localhost] | [{host: localhost, port: 5672}, {host: localhost, port: 5673}]
  //   port: int
  //   vhost: %2F
  //   hostRandom: default false, if host is an array

  //   @state : opening | open | closed | reconnecting | destroyed

  // ###
  constructor(config = {}, onConnect) {
    super();
    this.id = Math.round(Math.random() * 1000);

    let args = config;
    let cb = onConnect;

    if (typeof args === 'function') {
      cb = args;
      args = {};
    }

    // this is the main connect event
    cb = cb ? once(cb) : cb;
    this.cb = cb;

    this.state = 'opening';

    this.connectionOptions = applyDefaults(args, defaults.connection);

    // setup our defaults
    this.channelCount = 0;

    this.channels = new Map([[0, this]]);
    this.queues = new Map();
    this.exchanges = new Map();

    // bind functions
    this._connectionErrorEvent = this._connectionErrorEvent.bind(this);
    this._connectionClosedEvent = this._connectionClosedEvent.bind(this);
    this._sendHeartbeat = this._sendHeartbeat.bind(this);
    this._missedHeartbeat = this._missedHeartbeat.bind(this);

    // connection tuning paramaters
    this.channelMax = this.connectionOptions.channelMax;
    this.frameMax = this.connectionOptions.frameMax;
    this.serializer = new Serializer(this.frameMax);
    this.channelManager = new ChannelManager(this);

    if (!args.lazyConnect) {
      this.connect(cb);
      if (cb) {
        this.once('ready', cb);
      }
    }

    this.on('close', this._closed);
  }

  _prepareHostList() {
    // determine to host to connect to if we have an array of hosts
    this.connectionOptions.hosts = [this.connectionOptions.host].flat(2).map((uri) => {
      if (uri.port && uri.host) {
        return { host: uri.host.toLowerCase(), port: parseInt(uri.port, 10) };
      }

      // our host name has a : and theat implies a uri with host and port
      if (typeof (uri) === 'string' && uri.indexOf(':') !== -1) {
        const [host, port] = uri.split(':');
        return { host: host.toLowerCase(), port: parseInt(port, 10) };
      }

      if (typeof uri === 'string') {
        return {
          host: uri.toLowerCase(),
          port: !this.connectionOptions.ssl
            ? this.connectionOptions.port
            : this.connectionOptions.sslPort,
        };
      }

      throw new Error(`we dont know what do do with the host ${uri}`);
    });

    this.connectionOptions.hosti = 0;
    if (this.connectionOptions.hostRandom) {
      this.connectionOptions.hosti = Math.floor(Math.random() * this.connectionOptions.hosts.length);
    }
  }

  connect(cb) {
    async.series([
      (next) => {
        this._prepareHostList();
        this.updateConnectionOptionsHostInformation();
        next();
      },
      (next) => {
        if (this.connectionOptions.rabbitMasterNode?.queue != null) {
          require('./plugins/rabbit').masterNode(this, this.connectionOptions.rabbitMasterNode.queue, next);
        } else {
          next();
        }
      },
      (next) => {
        const setupConnectionListeners = () => {
          const connectionEvent = this.connectionOptions.ssl
            ? 'secureConnect'
            : 'connect';

          this.connection.once(connectionEvent, () => this._connectedFirst());
          this.connection.on(connectionEvent, () => this._connected());
          this.connection.on('error', this._connectionErrorEvent);
          this.connection.on('close', this._connectionClosedEvent);
        };

        if (this.connectionOptions.ssl) {
          const tlsOptions = this.connectionOptions.sslOptions ?? {};
          const setupTlsConnection = () => {
            if (this.connection != null) {
              this.connection.removeAllListeners();
              this.connection.socket?.end();
            }

            this.connection = tls.connect(this.connectionOptions.port, this.connectionOptions.host, tlsOptions, () => {
              this.connection.on('error', (err) => {
                this.connection.emit('close', err);
              });
            });

            this.connection.connect = setupTlsConnection;
            setupConnectionListeners();
          };

          setupTlsConnection();
        } else {
          this.connection = net.connect(this.connectionOptions.port, this.connectionOptions.host);
          setupConnectionListeners();
        }

        if (this.connectionOptions.noDelay) {
          this.connection.setNoDelay();
        }

        // start listening for timeouts

        if (this.connectionOptions.connectTimeout && !this.connectionOptions.reconnect) {
          clearTimeout(this._connectTimeout);
          this._connectTimeout = setTimeout(() => {
            debug(1, () => 'Connection timeout triggered');

            this.close();

            const err = new Error('Connection Timeout');
            err.code = 'T';
            err.host = this.connectionOptions.host;
            err.port = this.connectionOptions.port;

            cb?.(err);
          }, this.connectionOptions.connectTimeout);
        }

        next();
      },
    ], (e, r) => {
      if (e) cb?.(e);
    });
  }

  updateConnectionOptionsHostInformation() {
    const { connectionOptions } = this;
    const { hosts, hosti } = connectionOptions;
    connectionOptions.host = hosts[hosti].host;
    connectionOptions.port = hosts[hosti].port;
  }

  // User called functions
  queue(args, cb) {
    if (!cb) {
      return new Queue(this.channelManager.temporaryChannel(), args);
    }

    return this.channelManager.temporaryChannel((err, channel) => {
      if (err) {
        return cb(err);
      }

      return new Queue(channel, args, cb);
    });
  }

  exchange(args, cb) {
    if (!cb) {
      return new Exchange(this.channelManager.temporaryChannel(), args);
    }

    return this.channelManager.temporaryChannel((err, channel) => {
      if (err) {
        return cb(err);
      }

      return new Exchange(channel, args, cb);
    });
  }

  consume(queueName, options, messageParser, cb) {
    return this.channelManager.consumerChannel((err, channel) => {
      if (err) {
        const error = new Error('failed to consume');
        error.err = err;
        error.channel = channel;
        return cb(error);
      }

      const consumerChannel = this.channels.get(channel);
      if (!consumerChannel) {
        return cb(new Error(`cant allocate consumer channel - ${channel}`));
      }

      return consumerChannel.consume(queueName, options, messageParser, cb);
    });
  }

  // channel is optional!
  publish(exchange, routingKey, data, options, cb) {
    const confirm = !!(cb && options.confirm);

    this.channelManager.publisherChannel(confirm, (err, channel) => {
      if (err) {
        const error = new Error('failed to open publisher channel');
        error.err = err;
        error.channel = channel;
        return cb(error);
      }

      const publishChannel = this.channels.get(channel);
      if (!publishChannel) {
        return cb(new Error(`cant allocate publish channel - ${channel}`));
      }

      return publishChannel.publish(exchange, routingKey, data, options, cb);
    });
  }

  close(cb) {
    // should close all the things and reset for a new clean guy
    // @connection.removeAllListeners() TODO evaluate this
    this._clearHeartbeatTimer();

    process.nextTick(() => {
      this.state = 'destroyed';

      if (cb) cb = once(cb);

      // only atempt to cleanly close the connection if our current connection is writable
      if (this.connection.writable) {
        this._sendMethod(0, methods.connectionClose, {
          classId: 0, methodId: 0, replyCode: 200, replyText: 'closed',
        });
      } else {
        return cb?.();
      }

      const forceConnectionClose = setTimeout(() => {
        this.connection.destroy();
        cb?.();
      }, 1000);

      this.connection.once('close', () => {
        clearTimeout(forceConnectionClose);
        cb?.();
      });
    });
  }

  // TESTING OUT OF ORDER OPERATION
  crashOOO() {
    if (!process.env.AMQP_TEST) {
      return true;
    }

    // this will crash a channel forcing an out of order operation
    debug('Trying to crash connection by an oow op');
    this._sendBody(this.channel, Buffer.alloc(100), {});
  }

  // Service Called Functions
  _connectedFirst() {
    debug(1, () => `Connected to ${this.connectionOptions.host}:${this.connectionOptions.port}`);
  }

  _connected() {
    debug(1, () => `Connected#generic to ${this.connectionOptions.host}:${this.connectionOptions.port}`);

    setSocketReadBuffer(this.connection._handle.fd, bytes('4mb'));
    setSocketWriteBuffer(this.connection._handle.fd, bytes('4mb'));

    clearTimeout(this._connectTimeout);
    this._resetAllHeartbeatTimers();
    this._setupParser(this._reestablishChannels);
  }

  _connectionErrorEvent(e, r) {
    if (this.state !== 'destroyed') {
      debug(1, () => ['Connection Error ', e, r, this.connectionOptions.host]);
    }

    // if we are to keep trying we wont callback until we're successful, or we've hit a timeout.
    if (!this.connectionOptions.reconnect) {
      if (this.cb) {
        this.cb(e, r);
      } else {
        this.emit('error', e);
      }
    }
  }

  _connectionClosedEvent(had_error) {
    debug('received connection closed event');

    // go through all of our channels and close them
    for (const channel of this.channels.values()) {
      channel._connectionClosed?.();
    }

    clearTimeout(this._connectTimeout);
    if (this.state === 'open') this.emit('close');

    if (this.state !== 'destroyed') {
      if (!this.connectionOptions.reconnect) {
        debug(1, () => 'Connection closed not reconnecting...');
        return;
      }

      this.state = 'reconnecting';
      debug(1, () => 'Connection closed reconnecting...');

      setTimeout(() => {
        // rotate hosts if we have multiple hosts
        if (this.connectionOptions.hosts.length > 1) {
          this.connectionOptions.hosti = (this.connectionOptions.hosti + 1) % this.connectionOptions.hosts.length;
          this.updateConnectionOptionsHostInformation();
        }

        debug(1, () => `reconnecting to ${JSON.stringify(this.connectionOptions)}`);

        // network --> parser
        // send any connection data events to our parser
        this.connection.removeAllListeners('data'); // cleanup reconnections
        this.connection.connect(this.connectionOptions.port, this.connectionOptions.host);
      }, this.connectionOptions.reconnectDelayTime);
    }
  }

  _reestablishChannels() {
    debug(1, 'reestablishing channels');
    return async.forEachSeries(this.channels.keys(), (channel, done) => {
      if (channel === 0) {
        debug(1, 'skip 0');
        done();
        return;
      }

      // check to make sure the channel is still around before attempting to reset it
      // the channel could have been temporary
      if (this.channelManager.isChannelClosed(channel)) {
        debug(1, [channel, 'channel closed']);
        done();
        return;
      }

      this.channels.get(channel).reset?.(done);
    });
  }

  _closed() {
    this._clearHeartbeatTimer();
  }

  // we should expect a heartbeat at least once every heartbeat interval x 2
  // we should reset this timer every time we get a heartbeat
  //
  // on initial connection we should start expecting heart beats
  // on disconnect or close we should stop expecting these.
  // on heartbeat received we should expect another
  _receivedHeartbeat() {
    debug(4, () => '♥ heartbeat');
    this._resetHeartbeatTimer();
  }

  _resetAllHeartbeatTimers() {
    this._resetSendHeartbeatTimer();
    this._resetHeartbeatTimer();
  }

  _resetHeartbeatTimer() {
    debug(6, () => '_resetHeartbeatTimer');
    if (!this.heartbeatTimer) {
      this.heartbeatTimer = setInterval(this._missedHeartbeat, this.connectionOptions.heartbeat * 2);
    } else {
      this.heartbeatTimer.refresh();
    }
  }

  _clearHeartbeatTimer() {
    debug(6, () => '_clearHeartbeatTimer');
    clearInterval(this.heartbeatTimer);
    clearInterval(this.sendHeartbeatTimer);
    this.heartbeatTimer = null;
    this.sendHeartbeatTimer = null;
  }

  _resetSendHeartbeatTimer() {
    debug(6, () => '_resetSendHeartbeatTimer');

    if (!this.sendHeartbeatTimer) {
      this.sendHeartbeatTimer = setInterval(this._sendHeartbeat, this.connectionOptions.heartbeat);
    } else {
      this.sendHeartbeatTimer.refresh();
    }
  }

  _sendHeartbeat() {
    this.connection.write(this.serializer.encode(0, { type: FrameType.HEARTBEAT }));
  }

  // called directly in tests to simulate missed heartbeat
  _missedHeartbeat() {
    if (this.state === 'open') {
      debug(1, () => 'We missed a heartbeat, destroying the connection.');
      this.connection.destroy();
    }

    this._clearHeartbeatTimer();
  }

  _onParserResponse(channel, datum) {
    if (datum instanceof Error) {
      this.emit('error', datum);
      return;
    }

    debug(4, () => [channel, datum]);

    switch (datum.type) {
      case FrameType.METHOD:
        this._onMethod(channel, datum.method, datum.args);
        return;

      case FrameType.HEADER:
        this._onContentHeader(channel, datum.classInfo, datum.weight, datum.properties, datum.size);
        return;

      case FrameType.BODY:
        this._onContent(channel, datum.data);
        return;

      case FrameType.HEARTBEAT:
        this._receivedHeartbeat();
        return;

      default:
        debug('unknown data type');
    }
  }

  _setupParser(cb) {
    if (this.parser) {
      debug(1, () => 'parser reset');
      this.parser.reset();
    } else {
      // setup the parser
      this.parser = new Parser({
        handleResponse: this._onParserResponse.bind(this),
      });
    }

    this.connection.on('data', this.parser.processChunk);
    this.connection.write(HandshakeFrame);

    if (cb) {
      this.removeListener('ready', cb);
      this.once('ready', cb);
    }
  }

  _sendMethod(channel, method, args) {
    if (channel !== 0 && ['opening', 'reconnecting'].includes(this.state)) {
      this.once('ready', () => {
        this._sendMethod(channel, method, args);
      });
      return;
    }

    debug(3, () => `${channel} < ${method.name}`);

    const methodBuffer = this.serializer.encode(channel, {
      type: FrameType.METHOD,
      name: method.name,
      method,
      args,
    });

    this.connection.write(methodBuffer);
    this._resetSendHeartbeatTimer();
  }

  // Only used in sendBody
  _sendHeader(channel, size, args) {
    debug(3, () => `${this.id} ${channel} < header ${size}`);

    const headerBuffer = this.serializer.encode(channel, {
      type: FrameType.HEADER,
      size,
      properties: args,
    });

    this.connection.write(headerBuffer);
    this._resetSendHeartbeatTimer();
  }

  _sendBody(channel, body, args, cb) {
    if (!Buffer.isBuffer(body)) {
      debug(1, () => 'invalid body type');
      cb?.('Invalid body type for publish, expecting a buffer');
      return false;
    }

    const { connection } = this;
    connection.cork();
    this._sendHeader(channel, body.length, args);
    for (const frame of this.serializer.encode(channel, { type: FrameType.BODY, data: body })) {
      connection.write(frame);
    }
    process.nextTick(() => connection.uncork());
    debug(4, () => `send body bytes: ${body.length}`);

    this._resetSendHeartbeatTimer();
    cb?.();
    return true;
  }

  _onContentHeader(channel, classInfo, weight, properties, size) {
    this._resetHeartbeatTimer();
    const managedChannel = this.channels.get(channel);
    if (managedChannel?._onContentHeader != null) {
      managedChannel._onContentHeader(channel, classInfo, weight, properties, size);
    } else {
      debug(1, () => [`unhandled -- _onContentHeader ${channel} > `, { classInfo, properties, size }]);
    }
  }

  _onContent(channel, data) {
    this._resetHeartbeatTimer();
    const managedChannel = this.channels.get(channel);
    if (managedChannel?._onContent != null) {
      managedChannel._onContent(channel, data);
    } else {
      debug(1, () => `unhandled -- _onContent ${channel} > ${data.length}`);
    }
  }

  _onMethod(channel, method, args) {
    this._resetHeartbeatTimer();
    if (channel > 0) {
      const chan = this.channels.get(channel);

      // delegate to correct channel
      if (!chan) {
        debug(1, () => `Received a message on untracked channel ${channel}, ${method.name} ${JSON.stringify(args)}`);
        return;
      }

      if (chan._onChannelMethod == null) {
        debug(1, () => `Channel ${channel} has no _onChannelMethod`);
        return;
      }

      chan._onChannelMethod(channel, method, args);
      return;
    }

    // connection methods for channel 0
    switch (method) {
      case methods.connectionStart:
        if (args.versionMajor !== 0 && args.versionMinor !== 9) {
          const serverVersionError = new Error('Bad server version');
          serverVersionError.code = 'badServerVersion';
          this.emit('error', serverVersionError);
          return;
        }

        // set our server properties up
        this.serverProperties = args.serverProperties;
        this._sendMethod(0, methods.connectionStartOk, {
          clientProperties: this.connectionOptions.clientProperties,
          mechanism: 'AMQPLAIN',
          response: {
            LOGIN: this.connectionOptions.login,
            PASSWORD: this.connectionOptions.password,
          },
          locale: 'en_US',
        });
        break;

      case methods.connectionTune:
        if (args.channelMax != null && args.channelMax !== 0 && (args.channelMax < this.channelMax || this.channelMax === 0)) {
          this.channelMax = args.channelMax;
        }

        if (args.frameMax != null && args.frameMax < this.frameMax) {
          this.frameMax = args.frameMax;
          this.serializer.setMaxFrameSize(this.frameMax);
        }

        this._sendMethod(0, methods.connectionTuneOk, {
          channelMax: this.channelMax,
          frameMax: this.frameMax,
          heartbeat: this.connectionOptions.heartbeat / 1000,
        });

        this._sendMethod(0, methods.connectionOpen, {
          virtualHost: this.connectionOptions.vhost,
        });

        break;

      case methods.connectionOpenOk:
        this.state = 'open';
        this.emit('ready');
        break;

      case methods.connectionClose: {
        this.state = 'closed';
        this._sendMethod(0, methods.connectionCloseOk, {});

        const e = new Error(args.replyText);
        e.code = args.replyCode;
        this.emit('close', e);
        break;
      }

      case methods.connectionCloseOk:
        this.emit('close');
        this.connection.destroy();
        break;

      default:
        debug(1, () => `0 < no matched method on connection for ${method.name}`);
    }
  }
}

module.exports = Connection;
