import { EventEmitter } from 'events'
import net = require('net')
import tls = require('tls')
import async = require('async')

import bytes = require('bytes')
import applyDefaults = require('lodash/defaults')
import { strict as assert } from 'assert'

import {
  HandshakeFrame,
  Parser,
  Serializer,
  FrameType,
  methods,
  ParsedResponse,
  MethodFrame,
  ContentHeader,
  ContentHeaderProperties,
} from '@microfleet/amqp-codec'
import { ChannelManager } from './channel-manager'
import { Exchange, ExchangeOptions } from './exchange'
import { Queue, QueueOptions } from './queue'
import * as defaults from './defaults'
import { debug as _debug } from './config'
import * as rabbitmAdminPlugin from './plugins/rabbit'
import { Consumer, ConsumeHandlerOpts, MessageHandler } from './consumer'
import { PublishOptions } from './publisher'
import { ConnectionTimeoutError, ServerVersionError, ServerClosedError, ServerClosedArgs } from './errors'
import { Channel, InferOptions, Methods } from './channel'
import { once } from 'events'

const debug = _debug('amqp:Connection')

if (process.env.AMQP_TEST) {
  defaults.connection.reconnectDelayTime = 100
}

export interface ClientProperties {
  capabilities?: {
    consumer_cancel_notify: boolean
  },
  version?: string,
  platform?: string,
  product?: string,
}

export interface ConnectionOptions {
  host: string | string[] | { host: string, port: number | string }[]
  port: number
  heartbeat: number
  login: string
  password: string
  vhost: string
  temporaryChannelTimeout: number
  temporaryChannelTimeoutCheck: number
  reconnect: boolean
  reconnectDelayTime: number
  connectTimeout: number
  hostRandom: boolean
  ssl: boolean
  sslPort: number
  sslOptions: tls.ConnectionOptions
  noDelay: boolean
  clientProperties: ClientProperties
  channelMax: number
  frameMax: number
  lazyConnect: boolean
  rabbitMasterNode?: {
    queue: string
  }
}

export const enum ConnectionState {
  idle = "idle",
  opening = "opening",
  open = "open",
  closed = "closed",
  reconnecting = "reconnecting",
  destroyed = "destroyed",
}

const OpeningStates = [ConnectionState.opening, ConnectionState.reconnecting]

export class Connection extends EventEmitter {
  public readonly id = Math.round(Math.random() * 1000)
  public state = ConnectionState.idle

  // private stuff
  public readonly connectionOptions: ConnectionOptions

  // setup our defaults
  public channels: Map<number, Connection | Channel> = new Map([[0, this]])
  public channelMax: number
  public frameMax: number
  public readonly channel = 0
  public readonly channelManager: ChannelManager

  private parser!: Parser
  private readonly serializer: Serializer
  private _connectTimeout: NodeJS.Timer | null = null
  private heartbeatTimer: NodeJS.Timer | null = null
  private sendHeartbeatTimer: NodeJS.Timer | null = null
  private opening$P: Promise<void> | undefined

  // for optional module loading
  private readonly setSocketReadBuffer: (fd: number, size: number) => void | (() => void)
  private readonly setSocketWriteBuffer: (fd: number, size: number) => void | (() => void)

  // connection to work with
  public connection!: tls.TLSSocket | net.Socket
  public serverProperties: Record<string, any> | null = null
  public activeHost!: string
  public activePort!: number
  public preparedHosts!: { host: string, port: number }[]
  public hosti!: number

  // ###
  //   host: localhost | [localhost, localhost] | [{host: localhost, port: 5672}, {host: localhost, port: 5673}]
  //   port: int
  //   vhost: %2F
  //   hostRandom: default false, if host is an array
  //   @state : opening | open | closed | reconnecting | destroyed
  // ###
  constructor(config: Partial<ConnectionOptions> = {}) {
    super()

    this.connectionOptions = applyDefaults({}, config, defaults.connection)

    // bind functions
    this._connectionErrorEvent = this._connectionErrorEvent.bind(this)
    this._connectionClosedEvent = this._connectionClosedEvent.bind(this)
    this._sendHeartbeat = this._sendHeartbeat.bind(this)
    this._missedHeartbeat = this._missedHeartbeat.bind(this)

    // connection tuning paramaters
    this.channelMax = this.connectionOptions.channelMax
    this.frameMax = this.connectionOptions.frameMax
    this.serializer = new Serializer(this.frameMax)
    this.channelManager = new ChannelManager(this)

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { setSocketReadBuffer, setSocketWriteBuffer } = require('./utils/set-sock-opts')
      this.setSocketReadBuffer = setSocketReadBuffer
      this.setSocketWriteBuffer = setSocketWriteBuffer
    } catch (e: any) {
      this.setSocketReadBuffer = () => {/* noop */}
      this.setSocketWriteBuffer = () => {/* noop */}
      process.emitWarning('could not load set-sock-opts', {
        code: 'AMQP_SOCK_OPTS',
        detail: e.message,
      })
      // noop
    }


    if (!this.connectionOptions.lazyConnect) {
      this.connect()
    }

    this.on('close', this._closed)
  }

  _prepareHostList() {
    // determine to host to connect to if we have an array of hosts
    this.preparedHosts = [this.connectionOptions.host].flat(2).map((uri) => {
      if (typeof uri === 'object' && uri.port && uri.host) {
        return {
          host: uri.host.toLowerCase(),
          port: typeof uri.port === 'string' ? parseInt(uri.port, 10) : uri.port,
        }
      }

      // our host name has a : and theat implies a uri with host and port
      if (typeof (uri) === 'string' && uri.indexOf(':') !== -1) {
        const [host, port] = uri.split(':')
        return { host: host.toLowerCase(), port: parseInt(port, 10) }
      }

      if (typeof uri === 'string') {
        return {
          host: uri.toLowerCase(),
          port: !this.connectionOptions.ssl
            ? this.connectionOptions.port
            : this.connectionOptions.sslPort,
        }
      }

      throw new Error(`we dont know what do do with the host ${uri}`)
    })

    this.hosti = 0
    if (this.connectionOptions.hostRandom) {
      this.hosti = Math.floor(Math.random() * this.preparedHosts.length)
    }
  }

  public async connect(): Promise<void> {
    // noop in case we are already opening the connection
    switch (this.state) {
      case ConnectionState.opening:
        return this.opening$P

      case ConnectionState.open:
        return

      case ConnectionState.reconnecting:
        await once(this, 'ready')
        return
    }

    this.state = ConnectionState.opening
    this.opening$P = (async () => {
      this._prepareHostList()
      this.updateConnectionOptionsHostInformation()

      if (this.connectionOptions.rabbitMasterNode?.queue != null) {
        await rabbitmAdminPlugin.masterNode(this, this.connectionOptions.rabbitMasterNode.queue)
      }

      const setupConnectionListeners = () => {
        const connectionEvent = this.connectionOptions.ssl
          ? 'secureConnect'
          : 'connect'

        this.connection.once(connectionEvent, () => this._connectedFirst())
        this.connection.on(connectionEvent, () => this._connected())
        this.connection.on('error', this._connectionErrorEvent)
        this.connection.on('close', this._connectionClosedEvent)
      }

      if (this.connectionOptions.ssl) {
        const tlsOptions = this.connectionOptions.sslOptions ?? {}
        const setupTlsConnection = (port: number, host: string) => {
          if (this.connection != null) {
            this.connection.removeAllListeners()
            // @ts-expect-error not on public types
            this.connection.socket?.end()
          }

          this.connection = tls.connect(port, host, tlsOptions, () => {
            this.connection.on('error', (err) => {
              this.connection.emit('close', err)
            })
          })

          // TODO: remove that
          // @ts-expect-error we monkey patch, its bad
          this.connection.connect = setupTlsConnection

          setupConnectionListeners()
          return this.connection
        }

        setupTlsConnection(this.activePort, this.activeHost)
      } else {
        this.connection = net.connect(this.activePort, this.activeHost)
        setupConnectionListeners()
      }

      if (this.connectionOptions.noDelay) {
        this.connection.setNoDelay()
      }

      // start listening for timeouts
      if (this.connectionOptions.connectTimeout && !this.connectionOptions.reconnect) {
        if (this._connectTimeout) {
          clearTimeout(this._connectTimeout)
        }

        this._connectTimeout = setTimeout(() => {
          debug(1, () => 'Connection timeout triggered')
          this.close(new ConnectionTimeoutError(this.activeHost, this.activePort))
        }, this.connectionOptions.connectTimeout)
      }

      await once(this, 'ready')
    })()

    try {
      await this.opening$P
    } finally {
      this.opening$P = undefined
    }
  }

  public updateConnectionOptionsHostInformation(): void {
    const { preparedHosts, hosti } = this
    this.activeHost = preparedHosts[hosti].host
    this.activePort = preparedHosts[hosti].port
  }

  // User called functions
  public async queue(args: Partial<QueueOptions>): Promise<Queue> {
    assert(this.connection, 'must call .connect() first')

    const tempChannel = await this.channelManager.temporaryChannelAsync()
    return new Queue(tempChannel, args)
  }

  public async exchange(args: Partial<ExchangeOptions>): Promise<Exchange> {
    assert(this.connection, 'must call .connect() first')

    const tempChannel = await this.channelManager.temporaryChannelAsync()
    return new Exchange(tempChannel, args)
  }

  public async consumer(): Promise<Consumer> {
    assert(this.connection, 'must call .connect() first')

    const consumerChannel = this.channelManager.consumerChannel()
    await consumerChannel.ready()
    return consumerChannel
  }

  public async consume(queueName: string, options: ConsumeHandlerOpts, messageHandler: MessageHandler): Promise<Consumer> {
    assert(this.connection, 'must call .connect() first')

    const consumerChannel = this.channelManager.consumerChannel()
    await consumerChannel.consume(queueName, messageHandler, options)
    return consumerChannel
  }

  public async publish(exchange: string, routingKey: string, data: any, options: Partial<PublishOptions> = {}): Promise<void> {
    const publishChannel = this.channelManager.publisherChannel(options.confirm)
    return publishChannel.publishAsync(exchange, routingKey, data, options)
  }

  public async close(err?: Error): Promise<void> {
    // should close all the things and reset for a new clean guy
    // @connection.removeAllListeners() TODO evaluate this
    this._clearHeartbeatTimer()
    if (this.state === ConnectionState.destroyed) {
      return
    }

    this.state = ConnectionState.destroyed
    if (!this.connection || this.connection.destroyed) {
      return
    }

    debug(3, 'calling close')
    // process.nextTick(() => {
      // only atempt to cleanly close the connection if our current connection is writable
    if (this.connection.writable) {
      this._sendMethod(0, methods.connectionClose, {
        classId: 0, methodId: 0, replyCode: 200, replyText: 'closed',
      })
    }

    const forceConnectionClose = setTimeout(() => {
      this.connection.destroy(err)
    }, 1000)

    this.connection.once('close', () => {
      clearTimeout(forceConnectionClose)
    })
    // })

    await once(this.connection, 'close')
  }

  // TESTING OUT OF ORDER OPERATION
  crashOOO() {
    if (!process.env.AMQP_TEST) {
      return true
    }

    // this will crash a channel forcing an out of order operation
    debug('Trying to crash connection by an oow op')
    return this._sendBody(this.channel, Buffer.alloc(100), {})
  }

  // Service Called Functions
  _connectedFirst() {
    debug(1, () => `Connected to ${this.connectionOptions.host}:${this.connectionOptions.port}`)
  }

  _connected() {
    debug(1, () => `Connected#generic to ${this.connectionOptions.host}:${this.connectionOptions.port}`)

    // @ts-expect-error -- it does exist
    if (this.connection._handle && typeof this.connection._handle.fd !== 'undefined') {
      // @ts-expect-error -- it does exist
      const fd = this.connection._handle.fd
      this.setSocketReadBuffer(fd, bytes('4mb'))
      this.setSocketWriteBuffer(fd, bytes('4mb'))
    }

    if (this._connectTimeout) {
      clearTimeout(this._connectTimeout)
    }

    this._resetAllHeartbeatTimers()
    this._setupParser(this._reestablishChannels)
  }

  _connectionErrorEvent(e: ServerClosedArgs) {
    if (this.state !== ConnectionState.destroyed) {
      debug(1, () => ['Connection Error', e, this.connectionOptions.host])
    }

    // if we are to keep trying we wont callback until we're successful, or we've hit a timeout.
    if (!this.connectionOptions.reconnect) {
      this.emit('error', new ServerClosedError(e))
    }
  }

  _connectionClosedEvent(had_error?: boolean) {
    debug(1, () => ['received connection closed event', had_error])

    // go through all of our channels and close them
    for (const channel of this.channels.values()) {
      if (!(channel instanceof Connection)) {
        channel._connectionClosed()
      }
    }

    if (this._connectTimeout) clearTimeout(this._connectTimeout)
    if (this.state === ConnectionState.open) this.emit('close')

    if (this.state !== ConnectionState.destroyed) {
      if (!this.connectionOptions.reconnect) {
        debug(1, () => 'Connection closed not reconnecting...')
        return
      }

      this.state = ConnectionState.reconnecting
      debug(1, () => 'Connection closed reconnecting...')

      setTimeout(() => {
        // rotate hosts if we have multiple hosts
        if (this.preparedHosts.length > 1) {
          this.hosti = (this.hosti + 1) % this.preparedHosts.length
          this.updateConnectionOptionsHostInformation()
        }

        debug(1, () => `reconnecting to ${JSON.stringify(this.connectionOptions)}`)

        // network --> parser
        // send any connection data events to our parser
        this.connection.removeAllListeners('data') // cleanup reconnections
        this.connection.connect(this.activePort, this.activeHost)
      }, this.connectionOptions.reconnectDelayTime)
    }
  }

  _reestablishChannels() {
    debug(1, 'reestablishing channels')
    return async.forEachSeries(this.channels.keys(), (channel, done) => {
      debug(1, () => [channel, 'processing'])

      if (channel === 0) {
        debug(1, () => [channel, '[skip]'])
        done()
        return
      }

      // check to make sure the channel is still around before attempting to reset it
      // the channel could have been temporary
      if (this.channelManager.isChannelClosed(channel)) {
        debug(1, () => [channel, '[skip] channel closed'])
        done()
        return
      }

      const ch = this.channels.get(channel)
      if (ch && !(ch instanceof Connection)) {
        debug(1, () => [channel, 'calling reset'])
        ch.reset(done)
        return
      }

      debug(1, () => [channel, '[skip] no handlers'])
      done()
    })
  }

  _closed() {
    this._clearHeartbeatTimer()
  }

  // we should expect a heartbeat at least once every heartbeat interval x 2
  // we should reset this timer every time we get a heartbeat
  //
  // on initial connection we should start expecting heart beats
  // on disconnect or close we should stop expecting these.
  // on heartbeat received we should expect another
  _receivedHeartbeat() {
    debug(4, () => '♥ heartbeat')
    this._resetHeartbeatTimer()
  }

  _resetAllHeartbeatTimers() {
    this._resetSendHeartbeatTimer()
    this._resetHeartbeatTimer()
  }

  _resetHeartbeatTimer() {
    debug(6, () => '_resetHeartbeatTimer')
    if (!this.heartbeatTimer) {
      this.heartbeatTimer = setInterval(this._missedHeartbeat, this.connectionOptions.heartbeat * 2)
    } else {
      this.heartbeatTimer.refresh()
    }
  }

  _clearHeartbeatTimer() {
    debug(6, () => '_clearHeartbeatTimer')
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.sendHeartbeatTimer) clearInterval(this.sendHeartbeatTimer)
    this.heartbeatTimer = null
    this.sendHeartbeatTimer = null
  }

  _resetSendHeartbeatTimer() {
    debug(6, () => '_resetSendHeartbeatTimer')

    if (!this.sendHeartbeatTimer) {
      this.sendHeartbeatTimer = setInterval(this._sendHeartbeat, this.connectionOptions.heartbeat)
    } else {
      this.sendHeartbeatTimer.refresh()
    }
  }

  _sendHeartbeat() {
    this.connection.write(this.serializer.encode(0, { type: FrameType.HEARTBEAT }))
  }

  // called directly in tests to simulate missed heartbeat
  _missedHeartbeat() {
    if (this.state === 'open') {
      debug(1, () => 'We missed a heartbeat, destroying the connection.')
      this.connection.destroy()
    }

    this._clearHeartbeatTimer()
  }

  private _onParserResponse(channel: number, datum: ParsedResponse) {
    if (datum instanceof Error) {
      debug(4, () => [channel, 'parser error', datum])
      this.emit('error', datum)
      return
    }

    debug(1, JSON.stringify(datum))
    debug(4, () => [channel, datum.type])

    switch (datum.type) {
      case FrameType.METHOD:
        this._onMethod(channel, datum)
        return

      case FrameType.HEADER:
        this._onContentHeader(channel, datum)
        return

      case FrameType.BODY:
        this._onContent(channel, datum.data)
        return

      case FrameType.HEARTBEAT:
        this._receivedHeartbeat()
        return

      default:
        debug('unknown data type')
    }
  }

  _setupParser(cb?: () => void) {
    if (this.parser) {
      debug(1, () => 'parser reset')
      this.parser.reset()
    } else {
      // setup the parser
      this.parser = new Parser({
        handleResponse: this._onParserResponse.bind(this),
      })
    }

    this.connection.on('data', this.parser.processChunk)
    this.connection.write(HandshakeFrame)

    if (cb) {
      this.removeListener('ready', cb)
      this.once('ready', cb)
    }
  }

  _sendMethod<T extends Methods>(channel: number, method: T, args: Partial<InferOptions<T>>) {
    if (channel !== 0 && OpeningStates.includes(this.state)) {
      // TODO: introduce queue instead of spawning promises
      this.once('ready', () => {
        this._sendMethod(channel, method, args)
      })
      return
    }

    const methodBuffer = this.serializer.encode(channel, {
      type: FrameType.METHOD,
      name: method.name,
      method,
      args,
    })

    debug(3, () => ['send into', channel, '<', method.name, 'args', args])

    this.connection.write(methodBuffer)
    this._resetSendHeartbeatTimer()
  }

  // Only used in sendBody
  _sendHeader(channel: number, size: number, args: Partial<ContentHeaderProperties>) {
    debug(3, () => `${this.id} ${channel} < header ${size}`)

    const headerBuffer = this.serializer.encode(channel, {
      type: FrameType.HEADER,
      size,
      properties: args,
    })

    this.connection.write(headerBuffer)
    this._resetSendHeartbeatTimer()
  }

  _sendBody(channel: number, body: Buffer, args: Record<string, any>, cb?: (err?: Error | null) => void) {
    if (!Buffer.isBuffer(body)) {
      debug(1, () => 'invalid body type')
      cb?.(new Error('Invalid body type for publish, expecting a buffer'))
      return false
    }

    const { connection } = this
    connection.cork()
    this._sendHeader(channel, body.length, args)
    for (const frame of this.serializer.encode(channel, { type: FrameType.BODY, data: body })) {
      connection.write(frame)
    }
    process.nextTick(() => connection.uncork())
    debug(4, () => `send body bytes: ${body.length}`)

    this._resetSendHeartbeatTimer()
    cb?.()
    return true
  }

  _onContentHeader(channel: number, frame: ContentHeader): void {
    this._resetHeartbeatTimer()
    const managedChannel = this.channels.get(channel)

    if (managedChannel?._onContentHeader != null) {
      managedChannel._onContentHeader(channel, frame)
    } else {
      debug(1, () => [`unhandled -- _onContentHeader ${channel} > `, frame])
    }
  }

  _onContent(channel: number, data: Buffer): void {
    this._resetHeartbeatTimer()
    const managedChannel = this.channels.get(channel)
    if (managedChannel?._onContent != null) {
      managedChannel._onContent(channel, data)
    } else {
      debug(1, () => `unhandled -- _onContent ${channel} > ${data.length}`)
    }
  }

  private _onMethod<T extends MethodFrame>(channel: number, frame: T): void {
    this._resetHeartbeatTimer()
    if (channel > 0) {
      const chan = this.channels.get(channel)

      // delegate to correct channel
      if (!chan) {
        debug(1, () => `Received a message on untracked channel ${channel}, ${frame.name} ${JSON.stringify(frame.args)}`)
        return
      }

      if (chan instanceof Connection) {
        debug(1, () => `Channel ${channel} has no _onChannelMethod`)
        return
      }

      chan._onChannelMethod(channel, frame)
      return
    }

    if (frame.name === methods.connectionStart.name) {
      const args = frame.args
      if (args.versionMajor !== 0 && args.versionMinor !== 9) {
        this.emit('error', new ServerVersionError(args))
        return
      }

      // set our server properties up
      this.serverProperties = args.serverProperties
      this._sendMethod(0, methods.connectionStartOk, {
        clientProperties: this.connectionOptions.clientProperties,
        mechanism: 'AMQPLAIN',
        response: {
          LOGIN: this.connectionOptions.login,
          PASSWORD: this.connectionOptions.password,
        },
        locale: 'en_US',
      })
      return
    }

    if (frame.name === methods.connectionTune.name) {
      const args = frame.args

      if (args.channelMax != null && args.channelMax !== 0 && (args.channelMax < this.channelMax || this.channelMax === 0)) {
        this.channelMax = args.channelMax
      }

      if (args.frameMax != null && args.frameMax < this.frameMax) {
        this.frameMax = args.frameMax
        this.serializer.setMaxFrameSize(this.frameMax)
      }

      this._sendMethod(0, methods.connectionTuneOk, {
        channelMax: this.channelMax,
        frameMax: this.frameMax,
        heartbeat: this.connectionOptions.heartbeat / 1000,
      })

      this._sendMethod(0, methods.connectionOpen, {
        virtualHost: this.connectionOptions.vhost,
      })

      return
    }

    if (frame.name === methods.connectionOpenOk.name) {
      this.state = ConnectionState.open
      this.emit('ready')
      return
    }

    if (frame.name === methods.connectionClose.name) {
      const args = frame.args

      this.state = ConnectionState.closed
      this._sendMethod(0, methods.connectionCloseOk, {})

      this.emit('close', new ServerClosedError(args))
      return
    }

    if (frame.name === methods.connectionCloseOk.name) {
      this.emit('close')
      this.connection.destroy()
      return
    }

    debug(1, () => `0 < no matched method on connection for ${frame.name}`)
  }
}
