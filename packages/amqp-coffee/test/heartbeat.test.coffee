should  = require('should')
async    = require('async')
_        = require('underscore')
Proxy    = require('./proxy')
sinon    = require('sinon')

AMQP = require('../src/amqp').Connection
debug = require('debug')('heartbeat')

describe 'Connection Heartbeats', () ->
  it 'we can get a heartbeat 541', (done)->
    this.timeout(5000)
    amqp = null
    spy = null

    async.series [
      (next)->
        amqp = new AMQP {host:'rabbitmq', port: 5672, heartbeat: 1000}, (e, r)->
          should.not.exist e
          next()
        
        spy = sinon.spy(amqp, '_receivedHeartbeat')

      (next)->
        async.until (cb) ->
          cb(null, spy.called)
        , (it) -> 
          setTimeout(it, 100)
        , next

      (next)->
        amqp.close()
        next()

    ], done


  it 'we reset the heartbeat timer while the connection is doing other things', (done)->
    this.timeout(60000)
    amqp = null
    stage = null

    async.series [
      (next)->
        amqp = new AMQP {host:'rabbitmq', port: 5672, heartbeat: 1000}, (e, r)->
          should.not.exist e
          next()

      (next)->
        queuename = "queuename"
        heartbeat = false
        stage = 2
        amqp.on 'close', ()->
          if stage is 2
            throw new Error("connection closed")

        doThings = ()->

          amqp.queue {queue:queuename}, (e, q)->
            should.not.exist e
            should.exist q

            q.declare {passive:false}, (e,r)->
              should.not.exist e
              doThings() if !heartbeat

        doThings()

        _.delay next, 3000

      (next)->
        stage = 3
        amqp.close()
        next()

    ], done


  it 'we disconnect and we dont reconnect because of the heartbeat 540', (done)->
    this.timeout(60000)
    amqp = null

    async.series [
      (next)->
        amqp = new AMQP {host:'rabbitmq', port: 5672, heartbeat: 1000}, (e, r)->
          should.not.exist e
          next()

      (next)->
        amqp.close()
        _.delay next, 3000

      (next)->
        amqp.state.should.eql 'destroyed'
        amqp.close()
        next()

    ], done


  it 'hearthbeat missing reconnects 574', (done)->

    this.timeout(60000)
    proxy = new Proxy.route(7070, 5672, "rabbitmq")
    amqp = null

    async.series [
      (next)->
        amqp = new AMQP {host:'localhost', port: 7070}, (e, r)->
          should.not.exist e
          next()

      (next)->
        _.delay ()->
          amqp._missedHeartbeat()
        , 100

        amqp.once 'close', next

      (next)->
        amqp.once 'ready', next

      (next)->
        amqp.close()
        proxy.close()
        next()

    ], done



  it 'we send heartbeats 575', (done)->
    this.timeout(7000)
    amqp = null
    consumer = null
    queueName = null

    async.series [
      (next)->
        amqp = new AMQP {host:'rabbitmq'}, (e, r)->
          should.not.exist e

        debug('amqp ready')
        amqp.once 'ready', next

      (next)->
        consumer = new AMQP {host:'rabbitmq', heartbeat: 1000}, (e, r)->
          should.not.exist e

        debug('consumer ready')
        consumer.once 'ready', next

      (next)->
        amqp.queue {queue: ''}, (err, queueInfo)->
          should.not.exist err
          debug('queue pre')

          queueInfo.declare (err, queueInfo)->
            should.not.exist err
            queueName = queueInfo.queue
            debug('queue declared', queueInfo.queue)
            next()

      (next)->

        consumer.consume queueName, {}, ()->
          debug 'consumed+'

        shouldStop = false

        setTimeout ()->
          shouldStop = true
          debug('should stop')
        , 4000

        async.until (cb)->
          debug('eh?', shouldStop)
          setTimeout(cb, 1, null, shouldStop)
        , (done)->
          debug('h+')
          amqp.publish '', queueName, 'message', done
        , next

      (next)->
        debug('close?')
        amqp.close()
        consumer.close()
        next()

    ], done


