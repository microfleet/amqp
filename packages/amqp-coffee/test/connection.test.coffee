should = require('should')
assert = require('assert')
Proxy  = require('./proxy')
{ setTimeout } = require('timers/promises')

describe 'Connection', () ->
  AMQP = require('../src/amqp').Connection
  amqp = null
  proxy = null

  afterEach () ->
    await amqp?.close()
    proxy?.close()

  it 'tests it can connect to rabbitmq', () ->
    amqp = new AMQP {host:'rabbitmq'}
    await amqp.connect()

  it 'tests it can connect to nested hosts array', () ->
    amqp = new AMQP {host:[['rabbitmq']]}
    await amqp.connect()

  it 'we fail connecting to an invalid host', () ->
    amqp = new AMQP {reconnect:false, host:'iamnotthequeueyourlookingfor'}
    await assert.rejects(amqp.connect())

  it 'we fail connecting to an invalid no callback', () ->
    amqp = new AMQP {reconnect:false, host:'iamnotthequeueyourlookingfor', lazyConnect: false}
    amqp.on 'error', ()->
      done()

  it 'we can reconnect if the connection fails 532', ()->
    proxy = new Proxy.route(7001, 5672, "rabbitmq")
    amqp = null

    amqp = new AMQP {host:'localhost', port: 7001}
    await amqp.connect()

    proxy.interrupt()
    await amqp.queue {queue:"test"}

  it 'we disconnect', ()->
    # proxy = new proxy.route(9001, 5672, "localhost")
    amqp = null

    amqp = new AMQP {host:'rabbitmq'}
    await amqp.connect()
    await amqp.close()
    amqp.state.should.eql 'destroyed'


  it 'we can connect to an array of hosts', ()->
    # proxy = new proxy.route(9001, 5672, "localhost")
    amqp = new AMQP {host:['rabbitmq','127.0.0.1']}
    await amqp.connect()
    await amqp.close()

  it 'we emit only one close event', ()->
    proxy = new Proxy.route(9010, 5672, "rabbitmq")
    amqp  = null
    closes = 0

    amqp = new AMQP {host:['rabbitmq','127.0.0.1'], port: 9010}
    await amqp.connect()

    await new Promise (resolve) ->
      amqp.on 'close', () ->
        closes++
        amqp.close()

        await setTimeout(300)
        closes.should.eql 1
        resolve()

      proxy.close()

  it 'we can reconnect to an array of hosts if the connection fails', ()->
    this.timeout(5000)
    proxy = new Proxy.route(9009, 5672, "rabbitmq")
    amqp = new AMQP {host:['localhost','127.0.0.1'], port: 9009}

    await amqp.connect()
    proxy.interrupt()

    await amqp.queue {queue:"test"}

  it 'we can connect to an array of hosts randomly', ()->
    amqp = new AMQP {hostRandom: true, host:['rabbitmq','rabbitmq']}
    await amqp.connect()

  it 'we can timeout connecting to a host', ()->
    amqp = new AMQP {reconnect:false, connectTimeout: 100, host:'test.com'}
    await assert.rejects amqp.connect()
