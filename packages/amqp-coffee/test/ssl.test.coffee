should   = require('should')
async    = require('async')
SslProxy = require('./sslproxy')
Proxy    = require('./proxy')
{ setTimeout } = require('timers/promises')

AMQP = require('../src').Connection

describe 'SSL Connection', () ->
  sslProxyConnection = null
  amqp = null
  proxy = null

  before (done)->
    sslProxyConnection = new SslProxy.route()
    done()

  after (done) ->
    sslProxyConnection?.close()
    done()

  afterEach () ->
    await amqp?.close()
    proxy?.close()
    amqp = null
    proxy = null

  it 'tests it can connect to localhost using ssl', () ->
    amqp = new AMQP {host:'localhost', ssl: true, sslOptions: {ca: [require('fs').readFileSync('./test/ssl/testca/cacert.pem')]}}
    await amqp.connect()

  it 'we can reconnect if the connection fails ssl', ()->
    proxy = new Proxy.route(7051, 5671, "localhost")
    amqp = new AMQP {host:'localhost', sslPort: 7051, ssl: true, sslOptions: {ca: [require('fs').readFileSync('./test/ssl/testca/cacert.pem')]}}
    await amqp.connect()
    proxy.interrupt()

    await amqp.queue {queue:"test"}

  it 'we emit only one close event ssl', ()->
    proxy = new Proxy.route(9010, 5671, "localhost")
    amqp = new AMQP {host:'localhost', sslPort: 9010, ssl: true, sslOptions: {ca: [require('fs').readFileSync('./test/ssl/testca/cacert.pem')]}}
    closes = 0

    await amqp.connect()
    await new Promise (resolve) ->
      amqp.on 'close', ()->
        closes++
        amqp.close()

        await setTimeout(300)
        closes.should.eql 1
        amqp.close()
        resolve()

      proxy.close()

  it 'we disconnect ssl', ()->
    amqp = amqp = new AMQP {host:'localhost', ssl: true, sslOptions: {ca: [require('fs').readFileSync('./test/ssl/testca/cacert.pem')]}}
    await amqp.connect()
    await amqp.close()
    amqp.state.should.eql 'destroyed'
