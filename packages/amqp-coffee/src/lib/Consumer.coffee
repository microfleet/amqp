# Exchange
os = require('os')

debug = require('./config').debug('amqp:Consumer')
Channel = require('./Channel')
async = require('async')
defaults = require('./defaults')
applyDefaults = require('lodash/defaults')

{ methods, MaxEmptyFrameSize } = require('@microfleet/amqp-codec')
{ MessageFactory } = require('./message')

CONSUMER_STATE_OPEN = 'open'
CONSUMER_STATE_OPENING = 'opening'

CONSUMER_STATE_CLOSED = 'closed'
CONSUMER_STATE_USER_CLOSED = 'user_closed'
CONSUMER_STATE_CHANNEL_CLOSED = 'channel_closed'
CONSUMER_STATE_CONNECTION_CLOSED = 'connection_closed'

CONSUMER_STATES_CLOSED = [
  CONSUMER_STATE_CLOSED, 
  CONSUMER_STATE_USER_CLOSED, 
  CONSUMER_STATE_CONNECTION_CLOSED, 
  CONSUMER_STATE_CHANNEL_CLOSED
]

class Consumer extends Channel

  constructor: (connection, channel)->
    debug 2, () -> return "channel open for consumer #{channel}"
    super(connection, channel)
    @consumerState = CONSUMER_STATE_CLOSED
    @messageHandler  = null

    @incomingMessage = null
    @outstandingDeliveryTags = new Map()
    return @

  consume: (queueName, options, messageHandler, cb)->
    if typeof options == 'function'
      if typeof messageHandler == 'function'
        cb = messageHandler

      messageHandler = options
      options = {}

    @consumerTag = options.consumerTag ? "#{os.hostname()}-#{process.pid}-#{Date.now()}"

    debug 2, () =>return "Consuming to #{queueName} on channel #{@channel} #{@consumerTag}"

    @consumerState = CONSUMER_STATE_OPENING

    if options.prefetchCount?
      # this should be a qos channel and we should expect ack's on messages
      @qos = true

      providedOptions = {prefetchCount: options.prefetchCount}
      providedOptions['global'] = options.global if options.global?

      qosOptions    = applyDefaults providedOptions, defaults.basicQos
      options.noAck = options.noAck || false
      delete options.prefetchCount
    else
      @qos = false
      options.noAck = true

    # do not mutate original opts
    consumeOptions             = applyDefaults {}, options, defaults.basicConsume
    consumeOptions.queue       = queueName
    consumeOptions.consumerTag = @consumerTag

    @messageHandler = messageHandler if messageHandler?
    if !@messageHandler? then return cb?("No message handler")

    @consumeOptions = consumeOptions
    @qosOptions     = qosOptions

    @_consume(cb)

    return @

  close: (cb)=>
    @cancel () =>
      @consumerState = CONSUMER_STATE_USER_CLOSED
      super()
      cb?()

  cancel: (cb)=>
    if !(@consumerState in CONSUMER_STATES_CLOSED)
      @taskPushPreflight methods.basicCancel, {consumerTag: @consumerTag, noWait:false}, methods.basicCancelOk, @_consumerStateOpenPreflight, cb
    else
      cb?()

  pause: (cb)->
    if !(@consumerState in CONSUMER_STATES_CLOSED)
      @cancel (err, res)=>
        # should pause be a different state?
        @consumerState = CONSUMER_STATE_USER_CLOSED
        cb?(err, res)
    else
      cb?()

  resume: (cb)->
    if @consumerState in CONSUMER_STATES_CLOSED
      @_consume(cb)
    else
      cb?()

  flow: (active, cb)->
    if active then @resume(cb) else @pause(cb)

  setQos: (prefetchCount, cb)->
    if typeof prefetchCount is 'function'
      cb = prefetchCount
      qosOptions = @qosOptions
    else
      # if our prefetch count has changed and we're rabbit version > 3.3.*
      # Rabbitmq 3.3.0 changes the behavior of qos.  we default to gloabl true in this case.
      if prefetchCount isnt @qosOptions.prefetchCount and \
         @connection.serverProperties?.product == 'RabbitMQ' and\
         ( @connection.serverProperties?.capabilities?.per_consumer_qos == true or \
         @connection.serverProperties?.version == "3.3.0" )

        global = true


      qosOptions = applyDefaults({prefetchCount, global}, @qosOptions)

    @taskPush methods.basicQos, qosOptions, methods.basicQosOk, cb

  # Private

  _consume: (cb)=>
    async.series [
      (next)=>
        if @qos
          @setQos next
        else
          next()

      (next)=>
        @taskQueuePushRaw {type: 'method', method: methods.basicConsume, args: @consumeOptions, okMethod: methods.basicConsumeOk, preflight: @_basicConsumePreflight}, next

      (next)=>
        @consumerState = CONSUMER_STATE_OPEN
        next()
    ], cb

  _basicConsumePreflight: () =>
    return @consumerState != CONSUMER_STATE_OPEN

  _consumerStateOpenPreflight: () =>
    return @consumerState == CONSUMER_STATE_OPEN

  _channelOpen: () =>
    if @consumeOptions? and @consumerState is CONSUMER_STATE_CONNECTION_CLOSED then @_consume()

  _channelClosed: (reason)=>
    # if we're reconnecting it is approiate to emit the error on reconnect, this is specifically useful
    # for auto delete queues
    if @consumerState is CONSUMER_STATE_CHANNEL_CLOSED
      if !reason? then reason = {}
      @emit 'error', reason

    @outstandingDeliveryTags = new Map()
    if @connection.state is 'open' and @consumerState is CONSUMER_STATE_OPEN
        @consumerState = CONSUMER_STATE_CHANNEL_CLOSED
        @_consume()
    else
      @consumerState = CONSUMER_STATE_CONNECTION_CLOSED

  # QOS RELATED Callbacks
  `multiAck(deliveryTag) {
    if (!this.qosEnabled()) {
      return
    }

    const { outstandingDeliveryTags } = this;
    for (const key of outstandingDeliveryTags.keys()) {
      if (key <= deliveryTag) {
        outstandingDeliveryTags.delete(key)
      }
    }

    if (this.state === 'open') {
      const basicAckOptions = { deliveryTag, multiple: true };
      this.connection._sendMethod(this.channel, methods.basicAck, basicAckOptions)
    }
  }`

  `qosEnabled() {
    return this.qos && !this.consumeOptions.noAck
  }`

  `deliveryOutstanding(tag) {
    return this.outstandingDeliveryTags.has(tag)
  }`

  `clearTag(tag) {
    this.outstandingDeliveryTags.delete(tag)
  }`

  `processTag(deliveryTag) {
    if (!this.qosEnabled() || !this.deliveryOutstanding(deliveryTag)) {
      return false
    }

    this.clearTag(deliveryTag)

    return this.state === 'open'
  }`

  `ack(deliveryTag) {
    if (!this.processTag(deliveryTag)) {
      return
    }
    
    const basicAckOptions = { deliveryTag, multiple: false }
    this.connection._sendMethod(this.channel, methods.basicAck, basicAckOptions)  
  }`

  `reject(deliveryTag) {
    if (!this.processTag(deliveryTag)) {
      return
    }

    const basicAckOptions = { deliveryTag, requeue: false }
    this.connection._sendMethod(this.channel, methods.basicReject, basicAckOptions)
  }`

  `retry(deliveryTag) {
    if (!this.processTag(deliveryTag)) {
      return
    }

    const basicAckOptions = { deliveryTag, requeue: true }
    this.connection._sendMethod(this.channel, methods.basicReject, basicAckOptions)
  }`

  # CONTENT HANDLING
  _onMethod: (channel, method, args)->
    debug 3, ()->return "onMethod #{method.name}, #{JSON.stringify args}"
    switch method
      when methods.basicDeliver
        @incomingMessage = new MessageFactory(args)

      when methods.basicCancel
        debug 1, ()->return "basicCancel"
        @consumerState = CONSUMER_STATE_CLOSED

        if @listeners('cancel').length > 0
          @emit 'cancel', "Server initiated basicCancel"
        else
          cancelError = new Error("Server initiated basicCancel")
          cancelError.code = 'basicCancel'
          @emit 'error', cancelError

  `_onContentHeader(channel, classInfo, weight, properties, size) {
    this.incomingMessage.setProperties(weight, size, properties)
    this.incomingMessage.evaluateMaxFrame(this.connection.frameMax - MaxEmptyFrameSize)

    if (size == 0) {
      this._onContent(channel, null)
    }
  }`

  `_onContent(channel, chunk) {
    const { incomingMessage } = this

    if (chunk !== null) {
      debug('handling chunk')
      incomingMessage.handleChunk(chunk)
    }

    if (incomingMessage.ready()) {
      const message = incomingMessage.create(this)
      this.outstandingDeliveryTags.set(message.deliveryTag, true)
      this.messageHandler(message)
    }
  }`

module.exports = Consumer
