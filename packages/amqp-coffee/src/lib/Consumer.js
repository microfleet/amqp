// Consumer
const os = require('os')

const debug = require('./config').debug('amqp:Consumer')
const Channel = require('./Channel')
const async = require('async')
const defaults = require('./defaults')
const applyDefaults = require('lodash/defaults')

const { methods, MaxEmptyFrameSize } = require('@microfleet/amqp-codec')
const { MessageFactory } = require('./message')

const CONSUMER_STATE_OPEN = 'open'
const CONSUMER_STATE_OPENING = 'opening'

const CONSUMER_STATE_CLOSED = 'closed'
const CONSUMER_STATE_USER_CLOSED = 'user_closed'
const CONSUMER_STATE_CHANNEL_CLOSED = 'channel_closed'
const CONSUMER_STATE_CONNECTION_CLOSED = 'connection_closed'

const CONSUMER_STATES_CLOSED = [
  CONSUMER_STATE_CLOSED, 
  CONSUMER_STATE_USER_CLOSED, 
  CONSUMER_STATE_CONNECTION_CLOSED, 
  CONSUMER_STATE_CHANNEL_CLOSED
]

class Consumer extends Channel {

  constructor(connection, channel) {
    debug(2, () => `channel open for consumer ${channel}`)
    super(connection, channel)
    
    this.consumerState = CONSUMER_STATE_CLOSED
    this.messageHandler  = null

    this.incomingMessage = null
    this.outstandingDeliveryTags = new Map()
  }

  consume(queueName, options, messageHandler, cb) {
    if (typeof options == 'function') {
      if (typeof messageHandler == 'function') {
        cb = messageHandler
      }

      messageHandler = options
      options = {}
    }

    this.consumerTag = options.consumerTag || `${os.hostname()}-${process.pid}-${Date.now()}`

    debug(2, () => `Consuming to ${queueName} on channel ${this.channel} ${this.consumerTag}`)

    this.consumerState = CONSUMER_STATE_OPENING

    let qosOptions
    if (options.prefetchCount != null && options.prefetchCount > 0) {
      // this should be a qos channel and we should expect ack's on messages
      this.qos = true

      const providedOptions = { prefetchCount: options.prefetchCount }
      if (options.global) providedOptions['global'] = options.global

      qosOptions = applyDefaults(providedOptions, defaults.basicQos)
      options.noAck = options.noAck || false
      delete options.prefetchCount
    } else {
      this.qos = false
      options.noAck = true
    }

    // do not mutate original opts
    const consumeOptions = applyDefaults({}, options, defaults.basicConsume)
    consumeOptions.queue = queueName
    consumeOptions.consumerTag = this.consumerTag

    if (!messageHandler) {
      return cb?.(new Error("No message handler"))
    }

    this.messageHandler = messageHandler
    this.consumeOptions = consumeOptions
    this.qosOptions = qosOptions

    this._consume(cb)
    
    return this
  }

  close(cb) {
    this.cancel(() => {
      this.consumerState = CONSUMER_STATE_USER_CLOSED
      super.close()
      cb?.()
    })
  }

  cancel(cb) {
    if (!CONSUMER_STATES_CLOSED.includes(this.consumerState)) {
      this.taskPushPreflight(
        methods.basicCancel, 
        {
          consumerTag: this.consumerTag, 
          noWait:false
        }, 
        methods.basicCancelOk, 
        this._consumerStateOpenPreflight, 
        cb
      )
    } else {
      cb?.()
    }
  }

  pause(cb) {
    if (!CONSUMER_STATES_CLOSED.includes(this.consumerState)) {
      this.cancel((err, res) => {
        // should pause be a different state?
        this.consumerState = CONSUMER_STATE_USER_CLOSED
        cb?.(err, res)
      })
    } else {
      cb?.()
    }
  }

  resume(cb) {
    if (CONSUMER_STATES_CLOSED.includes(this.consumerState)) {
      this._consume(cb)
    } else {
      cb?.()
    }
  }

  flow(active, cb) {
    if (active) {
      this.resume(cb)
    } else {
      this.pause(cb)
    }
  }

  setQos(prefetchCount, cb) {
    let qosOptions
    if (typeof prefetchCount == 'function') {
      cb = prefetchCount
      qosOptions = this.qosOptions
    } else {
      // if our prefetch count has changed and we're rabbit version > 3.3.*
      // Rabbitmq 3.3.0 changes the behavior of qos.  we default to gloabl true in this case.
      if (prefetchCount !== this.qosOptions.prefetchCount &&
         this.connection.serverProperties?.product === 'RabbitMQ' &&
         (this.connection.serverProperties?.capabilities?.per_consumer_qos === true ||
         this.connection.serverProperties?.version === "3.3.0" )) {

        global = true
      }

      qosOptions = applyDefaults({ prefetchCount, global }, this.qosOptions)
    }

    this.taskPush(methods.basicQos, qosOptions, methods.basicQosOk, cb)
  }

  // Private

  _consume(cb) {
    async.series([
      (next) => this.qos ? this.setQos(next) : next(),
      (next) => {
        this.taskQueuePushRaw({ 
          type: 'method', 
          method: methods.basicConsume, 
          args: this.consumeOptions, 
          okMethod: methods.basicConsumeOk, 
          preflight: this._basicConsumePreflight
        }, next)
      },
      (next) => {
        this.consumerState = CONSUMER_STATE_OPEN
        next()
      }
    ], cb)
  }

  _basicConsumePreflight = () => {
    return this.consumerState !== CONSUMER_STATE_OPEN
  }

  _consumerStateOpenPreflight = () => {
    return this.consumerState === CONSUMER_STATE_OPEN
  }

  _channelOpen() {
    if (this.consumeOptions != null && this.consumerState === CONSUMER_STATE_CONNECTION_CLOSED) {
      this._consume()
    }
  }

  _channelClosed(reason = new Error('unknown channel close reason')) {
    // if we're reconnecting it is approiate to emit the error on reconnect, this is specifically useful
    // for auto delete queues
    if (this.consumerState === CONSUMER_STATE_CHANNEL_CLOSED) {
      this.emit('error', reason)
    }

    this.outstandingDeliveryTags = new Map()
    if (this.connection.state === 'open' && this.consumerState === CONSUMER_STATE_OPEN) {
        this.consumerState = CONSUMER_STATE_CHANNEL_CLOSED
        this._consume()
    } else {
      this.consumerState = CONSUMER_STATE_CONNECTION_CLOSED
    }
  }

  // QOS RELATED Callbacks
  multiAck(deliveryTag) {
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
  }

  qosEnabled() {
    return this.qos && !this.consumeOptions.noAck
  }

  deliveryOutstanding(tag) {
    return this.outstandingDeliveryTags.has(tag)
  }

  clearTag(tag) {
    this.outstandingDeliveryTags.delete(tag)
  }

  processTag(deliveryTag) {
    if (!this.qosEnabled() || !this.deliveryOutstanding(deliveryTag)) {
      return false
    }

    this.clearTag(deliveryTag)

    return this.state === 'open'
  }

  ack(deliveryTag) {
    if (!this.processTag(deliveryTag)) {
      return
    }
    
    const basicAckOptions = { deliveryTag, multiple: false }
    this.connection._sendMethod(this.channel, methods.basicAck, basicAckOptions)  
  }

  reject(deliveryTag) {
    if (!this.processTag(deliveryTag)) {
      return
    }

    const basicAckOptions = { deliveryTag, requeue: false }
    this.connection._sendMethod(this.channel, methods.basicReject, basicAckOptions)
  }

  retry(deliveryTag) {
    if (!this.processTag(deliveryTag)) {
      return
    }

    const basicAckOptions = { deliveryTag, requeue: true }
    this.connection._sendMethod(this.channel, methods.basicReject, basicAckOptions)
  }

  // CONTENT HANDLING
  _onMethod(channel, method, args) {
    debug(3, () => `onMethod ${method.name}, ${JSON.stringify(args)}`)
    switch(method) {
      case methods.basicDeliver:
        this.incomingMessage = new MessageFactory(args)
        break

      case methods.basicCancel:
        debug(1, () => "basicCancel")
        this.consumerState = CONSUMER_STATE_CLOSED

        const cancelError = new Error("Server initiated basicCancel")
        cancelError.code = 'basicCancel'

        if (this.listeners('cancel').length > 0) {
          this.emit('cancel', cancelError)
        } else {
          this.emit('error', cancelError)
        }
        break
    }
  }

  _onContentHeader(channel, classInfo, weight, properties, size) {
    this.incomingMessage.setProperties(weight, size, properties)
    this.incomingMessage.evaluateMaxFrame(this.connection.frameMax - MaxEmptyFrameSize)

    if (size == 0) {
      this._onContent(channel, null)
    }
  }

  _onContent(channel, chunk) {
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
  }
}

module.exports = Consumer
