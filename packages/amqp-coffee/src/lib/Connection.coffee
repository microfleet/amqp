debug = require('./config').debug('amqp:Connection')

{ EventEmitter } = require('events')
net = require('net')
tls = require('tls')
async = require('async')

bytes = require('bytes')
once = require('lodash/once')
applyDefaults = require('lodash/defaults')
defer = require('lodash/defer')
flatten = require('lodash/flattenDeep')
delay = require('lodash/delay')
keys = require('lodash/keys')

defaults = require('./defaults')
Queue = require('./Queue')
Exchange = require('./Exchange')
ChannelManager  = require('./ChannelManager')

{ setSocketReadBuffer, setSocketWriteBuffer } = require('./utils/set-sock-opts')

{ 
  HandshakeFrame, 
  Parser, 
  Serializer, 
  FrameType,
  methods
} = require('@microfleet/amqp-codec')

if process.env.AMQP_TEST?
  defaults.connection.reconnectDelayTime = 100

class Connection extends EventEmitter

  ###

    host: localhost | [localhost, localhost] | [{host: localhost, port: 5672}, {host: localhost, port: 5673}]
    port: int
    vhost: %2F
    hostRandom: default false, if host is an array

    @state : opening | open | closed | reconnecting | destroyed

  ###
  constructor: (args, cb)->
    super()
    @id = Math.round(Math.random() * 1000)

    if typeof args is 'function'
      cb = args
      args = {}

    # this is the main connect event
    cb = once cb if cb?
    @cb = cb

    @state = 'opening'

    @connectionOptions = applyDefaults args, defaults.connection

    # setup our defaults
    @channelCount = 0

    @channels   = {0:this}
    @queues     = {}
    @exchanges  = {}

    # connection tuning paramaters
    @channelMax = @connectionOptions.channelMax
    @frameMax   = @connectionOptions.frameMax
    @serializer = new Serializer @frameMax

    @channelManager = new ChannelManager(@)

    unless args.lazyConnect
      @connect cb
      if cb? then @once 'ready', cb

    @on 'close', @_closed

    return @

  connect: (cb) =>
    async.series [

      (next)=>
        # determine to host to connect to if we have an array of hosts
        @connectionOptions.hosts = flatten([@connectionOptions.host]).map (uri)=>
          if uri.port? and uri.host?
            return {host: uri.host.toLowerCase(), port: parseInt(uri.port)}

          # our host name has a : and theat implies a uri with host and port
          else if typeof(uri) is 'string' and uri.indexOf(":") isnt -1
            [host, port] = uri.split(":")
            return {host: host.toLowerCase(), port: parseInt(port)}

          else if typeof(uri) is 'string'
            return {host: uri.toLowerCase(), port: if !@connectionOptions.ssl then @connectionOptions.port else @connectionOptions.sslPort}

          else
            throw new Error("we dont know what do do with the host #{uri}")

        @connectionOptions.hosti = 0

        if @connectionOptions.hostRandom
          @connectionOptions.hosti = Math.floor(Math.random() * @connectionOptions.hosts.length)

        @updateConnectionOptionsHostInformation()
        next()


      (next)=>
        if @connectionOptions.rabbitMasterNode?.queue?
          require('./plugins/rabbit').masterNode @, @connectionOptions.rabbitMasterNode.queue, next
        else
          next()

      (next)=>

        setupConnectionListeners = () =>
          if @connectionOptions.ssl
            connectionEvent = 'secureConnect'
          else
            connectionEvent = 'connect'

          @connection.once connectionEvent, () => @_connectedFirst()
          @connection.on   connectionEvent, () => @_connected()
          @connection.on   'error', @_connectionErrorEvent
          @connection.on   'close', @_connectionClosedEvent

        if @connectionOptions.ssl
          tlsOptions  = @connectionOptions.sslOptions ? {}

          setupTlsConnection = () =>
            if @connection?
              @connection.removeAllListeners()

              if @connection?.socket?
                @connection.socket.end()

            @connection = tls.connect @connectionOptions.port, @connectionOptions.host, tlsOptions, () =>
              @connection.on 'error', () =>
                @connection.emit 'close'

            @connection.connect = setupTlsConnection
            setupConnectionListeners()

          setupTlsConnection()

        else
          @connection = net.connect @connectionOptions.port, @connectionOptions.host
          setupConnectionListeners()

        if @connectionOptions.noDelay
          @connection.setNoDelay()

        # start listening for timeouts

        if @connectionOptions.connectTimeout? and !@connectionOptions.reconnect
          clearTimeout(@_connectTimeout)

          @_connectTimeout = setTimeout () =>
            debug 1, ()-> return "Connection timeout triggered"
            @close()
            cb?({ code:'T', message:'Connection Timeout', host:@connectionOptions.host, port:@connectionOptions.port })
          , @connectionOptions.connectTimeout

        next()
    ], (e, r)->
      if e? and cb?
        cb(e)

  updateConnectionOptionsHostInformation: () =>
    @connectionOptions.host  = @connectionOptions.hosts[@connectionOptions.hosti].host
    @connectionOptions.port  = @connectionOptions.hosts[@connectionOptions.hosti].port

  # User called functions
  queue: (args, cb)->
    if !cb? or typeof(cb) isnt 'function'
      return new Queue( @channelManager.temporaryChannel() , args)

    else
      @channelManager.temporaryChannel (err, channel)->
        if err? then return cb err
        q = new Queue(channel, args, cb)


  exchange: (args, cb)->
    if !cb? or typeof(cb) isnt 'function'
      return new Exchange(@channelManager.temporaryChannel(), args)

    else
      @channelManager.temporaryChannel (err, channel)->
        if err? then return cb err
        e = new Exchange(channel, args, cb)

  consume: (queueName, options, messageParser, cb)->
    @channelManager.consumerChannel (err, channel)=>
      consumerChannel = @channels[channel] if !err?

      if err? or !consumerChannel? then return cb({err, channel})
      consumerChannel.consume(queueName, options, messageParser, cb)

  # channel is optional!
  publish: (exchange, routingKey, data, options, cb)=>
    if cb? and options.confirm # there is no point to confirm without a callback
      confirm = true
    else
      confirm = false

    @channelManager.publisherChannel confirm, (err, channel)=>
      publishChannel = @channels[channel] if !err?
      #TODO figure out error messages
      if err? or !publishChannel? then return cb({err, channel})

      publishChannel.publish exchange, routingKey, data, options, cb


  close: (cb)=>
    # should close all the things and reset for a new clean guy
    # @connection.removeAllListeners() TODO evaluate this
    @_clearHeartbeatTimer()

    defer () =>
      @state = 'destroyed'

      if cb? then cb = once cb

      # only atempt to cleanly close the connection if our current connection is writable
      if @connection.writable
        @_sendMethod 0, methods.connectionClose, {classId:0, methodId: 0, replyCode:200, replyText:'closed'}
      else
        return cb?()

      forceConnectionClose = setTimeout () =>
        @connection.destroy()
        cb?()
      , 1000

      @connection.once 'close', () ->
        clearTimeout forceConnectionClose
        cb?()


  # TESTING OUT OF ORDER OPERATION
  crashOOO: () =>
    if !process.env.AMQP_TEST? then return true
    # this will crash a channel forcing an out of order operation
    debug "Trying to crash connection by an oow op"
    @_sendBody @channel, Buffer.alloc(100), {}

  # Service Called Functions
  _connectedFirst: () =>
    debug 1, () => return "Connected to #{@connectionOptions.host}:#{@connectionOptions.port}"

  _connected: ()->
    debug 1, () => return "Connected#generic to #{@connectionOptions.host}:#{@connectionOptions.port}"

    debug 1, () => "setting bigger buffers at #{@connection._handle.fd}"
    setSocketReadBuffer(@connection._handle.fd, bytes('4mb'))
    setSocketWriteBuffer(@connection._handle.fd, bytes('4mb'))
    debug 1, () => "buffers set"

    clearTimeout(@_connectTimeout)
    @_resetAllHeartbeatTimers()
    @_setupParser(@_reestablishChannels)

  _connectionErrorEvent: (e, r)=>
    if @state isnt 'destroyed'
      debug 1, () => return ["Connection Error ", e, r, @connectionOptions.host]

    # if we are to keep trying we wont callback until we're successful, or we've hit a timeout.
    if !@connectionOptions.reconnect
      if @cb?
        @cb(e,r)
      else
        @emit 'error', e

  _connectionClosedEvent: (had_error)=>
    # go through all of our channels and close them
    for channelNumber, channel of @channels
      channel._connectionClosed?()

    clearTimeout(@_connectTimeout)
    @emit 'close' if @state is "open"

    if @state isnt 'destroyed'
      if !@connectionOptions.reconnect
        debug 1, ()-> return "Connection closed not reconnecting..."
        return

      @state = 'reconnecting'
      debug 1, ()-> return "Connection closed reconnecting..."

      delay () =>
        # rotate hosts if we have multiple hosts
        if @connectionOptions.hosts.length > 1
          @connectionOptions.hosti = (@connectionOptions.hosti + 1) % @connectionOptions.hosts.length
          @updateConnectionOptionsHostInformation()

        debug 1, ()=> return "reconnecting to #{JSON.stringify(@connectionOptions)}"
        
        # network --> parser
        # send any connection data events to our parser
        @connection.removeAllListeners('data') # cleanup reconnections
        @connection.connect @connectionOptions.port, @connectionOptions.host
      , @connectionOptions.reconnectDelayTime


  _reestablishChannels: () =>
    debug(1, "reestablishing channels")
    async.forEachSeries keys(@channels), (channel, done)=>
      if channel is "0" then done() else
        # check to make sure the channel is still around before attempting to reset it
        # the channel could have been temporary
        if @channelManager.isChannelClosed(channel) then done() else
          @channels[channel].reset?(done)

  _closed: () =>
    @_clearHeartbeatTimer()

  # we should expect a heartbeat at least once every heartbeat interval x 2
  # we should reset this timer every time we get a heartbeat

  # on initial connection we should start expecting heart beats
  # on disconnect or close we should stop expecting these.
  # on heartbeat received we should expect another
  _receivedHeartbeat: () =>
    debug 4, () -> return "♥ heartbeat"
    @_resetHeartbeatTimer()

  _resetAllHeartbeatTimers: () =>
    @_resetSendHeartbeatTimer()
    @_resetHeartbeatTimer()

  _resetHeartbeatTimer: () =>
    debug 6, () -> return "_resetHeartbeatTimer"
    unless @heartbeatTimer
      @heartbeatTimer = setInterval @_missedHeartbeat, @connectionOptions.heartbeat * 2
    else
      @heartbeatTimer.refresh()

  _clearHeartbeatTimer: () =>
    debug 6, () -> return "_clearHeartbeatTimer"
    clearInterval @heartbeatTimer
    clearInterval @sendHeartbeatTimer
    @heartbeatTimer = null
    @sendHeartbeatTimer = null

  _resetSendHeartbeatTimer: () =>
    debug 6, () -> return "_resetSendHeartbeatTimer"

    unless @sendHeartbeatTimer
      @sendHeartbeatTimer = setInterval(@_sendHeartbeat, @connectionOptions.heartbeat)
    else
      @sendHeartbeatTimer.refresh()

  _sendHeartbeat: () =>
    @connection.write @serializer.encode(0, { type: FrameType.HEARTBEAT })

  # called directly in tests to simulate missed heartbeat
  _missedHeartbeat: () =>
    if @state is 'open'
      debug 1, ()-> return "We missed a heartbeat, destroying the connection."
      @connection.destroy()

    @_clearHeartbeatTimer()

  _onParserResponse: (channel, datum) =>
    debug "onParserResponse -> #{channel} #{Object.keys(datum)}"

    if datum instanceof Error
      @emit 'error', datum
      return

    switch datum.type
      when FrameType.METHOD
        @_onMethod(channel, datum.method, datum.args)
      
      when FrameType.HEADER
        @_onContentHeader(channel, datum.classInfo, datum.weight, datum.properties, datum.size)

      when FrameType.BODY
        @_onContent(channel, datum.data)

      when FrameType.HEARTBEAT
        @_receivedHeartbeat()

  _setupParser: (cb)->
    if @parser?
      debug 1, () => return "parser reset"
      @parser.reset()
    else
      # setup the parser
      @parser = new Parser {
        handleResponse: @_onParserResponse
      }

    # local reff
    # parser = @parser
    @connection.on 'data', @parser.processChunk
    # @connection.on 'data', parser.processChunk
    @connection.write HandshakeFrame

    if cb?
      @removeListener('ready', cb)
      @once 'ready', cb

  _sendMethod: (channel, method, args)=>
    if channel isnt 0 and @state in ['opening', 'reconnecting']
      return @once 'ready', () =>
        @_sendMethod(channel, method, args)

    debug 3, () -> return "#{channel} < #{method.name}"# #{util.inspect args}"

    methodBuffer = @serializer.encode channel, {
      type: FrameType.METHOD,
      name: method.name,
      method,
      args,
    }

    @connection.write(methodBuffer)

    @_resetSendHeartbeatTimer()

  # Only used in sendBody
  _sendHeader: (channel, size, args)=>
    debug 3, () => return "#{@id} #{channel} < header #{size}"# #{util.inspect args}"
    debug args

    headerBuffer = @serializer.encode channel, {
      type: FrameType.HEADER,
      size,
      properties: args,
    }

    @connection.write headerBuffer

    @_resetSendHeartbeatTimer()

  _sendBody: (channel, body, args, cb)=>
    unless body instanceof Buffer
      debug 1, ()-> return "invalid body type"
      cb?("Invalid body type for publish, expecting a buffer")
      return false

    debug "sending header"
    connection = @connection
    connection.cork()
    @_sendHeader channel, body.length, args
    for frame from @serializer.encode(channel, { type: FrameType.BODY, data: body })
      connection.write frame
    process.nextTick(() -> connection.uncork())
    debug "send body bytes: #{body.length}"

    @_resetSendHeartbeatTimer()
    cb?()
    return true

  _onContentHeader: (channel, classInfo, weight, properties, size)=>
    @_resetHeartbeatTimer()
    channel = @channels[channel]
    if channel?._onContentHeader?
      channel._onContentHeader(channel, classInfo, weight, properties, size)
    else
      debug 1, ()-> return ["unhandled -- _onContentHeader #{channel} > ", {classInfo, properties, size}]

  _onContent: (channel, data)=>
    @_resetHeartbeatTimer()
    channel = @channels[channel]
    if channel?._onContent?
      channel._onContent(channel, data)
    else
      debug 1, ()-> return "unhandled -- _onContent #{channel} > #{data.length}"

  _onMethod: (channel, method, args)=>
    @_resetHeartbeatTimer()
    if channel > 0
      # delegate to correct channel
      if !@channels[channel]?
        return debug 1, ()-> return "Received a message on untracked channel #{channel}, #{method.name} #{JSON.stringify args}"
      if !@channels[channel]._onChannelMethod?
        return debug 1, ()-> return "Channel #{channel} has no _onChannelMethod"
      @channels[channel]._onChannelMethod(channel, method, args)


    else
      # connection methods for channel 0
      switch method
        when methods.connectionStart
          if args.versionMajor != 0 and args.versionMinor!=9
            serverVersionError = new Error('Bad server version')
            serverVersionError.code = 'badServerVersion'

            return @emit 'error', serverVersionError

          # set our server properties up
          @serverProperties = args.serverProperties
          @_sendMethod 0, methods.connectionStartOk, {
            clientProperties: @connectionOptions.clientProperties
            mechanism:    'AMQPLAIN'
            response:{
              LOGIN:      @connectionOptions.login
              PASSWORD:   @connectionOptions.password
            }
            locale: 'en_US'
          }
        when methods.connectionTune
          if args.channelMax? and args.channelMax isnt 0 and args.channelMax < @channelMax or @channelMax is 0
            @channelMax = args.channelMax

          if args.frameMax? and args.frameMax < @frameMax
            @frameMax = args.frameMax
            @serializer.setMaxFrameSize @frameMax

          @_sendMethod 0, methods.connectionTuneOk, {
            channelMax: @channelMax
            frameMax: @frameMax
            heartbeat: @connectionOptions.heartbeat / 1000
          }

          @_sendMethod 0, methods.connectionOpen, {
            virtualHost: @connectionOptions.vhost
          }

        when methods.connectionOpenOk
          @state = 'open'
          @emit 'ready'

        when methods.connectionClose
          @state = 'closed'
          @_sendMethod 0, methods.connectionCloseOk, {}

          e = new Error(args.replyText)
          e.code = args.replyCode
          @emit 'close', e

        when methods.connectionCloseOk
          @emit 'close'
          @connection.destroy()

        else
          debug 1, ()-> return "0 < no matched method on connection for #{method.name}"

module.exports = Connection
