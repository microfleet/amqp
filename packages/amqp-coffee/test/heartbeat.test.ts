import 'should'
import Proxy   from './proxy'
import sinon   from 'sinon'

import { Connection as AMQP } from '../src/amqp'
import { setTimeout } from 'timers/promises'
import { once } from 'events'
import { assert } from 'console'

describe('Connection Heartbeats', () => {
  let amqp: AMQP

  beforeEach(async () => {
    amqp = new AMQP({ host: 'rabbitmq' })
    await amqp.connect()
  })

  afterEach(async () => {
    await amqp.close()
  })

  it('we can get a heartbeat 541', async () => {
    const spy = sinon.spy(amqp, '_receivedHeartbeat')
    do {
      await setTimeout(100)
    } while (!spy.called)
  })

  it('we reset the heartbeat timer while the connection is doing other things', async () => {
    let stage = 0
    const queuename = "queuename"
    const heartbeat = false
    stage = 2
    
    amqp.on('close', () => {
      if (stage === 2) {
        throw new Error("connection closed")
      }
    })

    const doThings = async (): Promise<void> => {
      const q = await amqp.queue({queue:queuename})
      await q.declare({passive:false})
      if (!heartbeat) {
        return doThings()
      }
    }

    await Promise.race([
      doThings(),
      setTimeout(3000)
    ])

    stage = 3
    await amqp.close()
  })


  it('we disconnect and we dont reconnect because of the heartbeat 540', async () => {
    await amqp.close()
    amqp.state.should.eql('destroyed')
    await setTimeout(3000)
    await amqp.close()
  })

  it('hearthbeat missing reconnects 574', async () => {
    await amqp.close()
    const proxy = new Proxy.route(7070, 5672, "rabbitmq")
    amqp = new AMQP({host:'localhost', port: 7070})
    await amqp.connect()
    await setTimeout(100)
    amqp._missedHeartbeat()

    await once(amqp, 'close')
    await once(amqp, 'ready')

    await amqp.close()
    proxy.close()
  })

  it('we send heartbeats 575', async () => {
    const consumer = new AMQP({host: 'rabbitmq', heartbeat: 1000})
    await consumer.connect()

    const queue = await amqp.queue({queue: ''})
    await queue.declare()
    const queueName = queue.queueOptions.queue
    assert(queueName)

    await consumer.consume(queueName, {}, () => {
      //. do nothing
    })

    let shouldStop = false
    setTimeout(4000).then(() => {
      shouldStop = true
    })
    
    while (!shouldStop) {
      await amqp.publish('', queueName, 'message')
      await setTimeout(1)
    }

    await amqp.close()
    await consumer.close()
  })
})
