import 'should'
import Proxy = require('./proxy')
import { v4 as uuid } from 'uuid'
import { setTimeout } from 'timers/promises'
import { strict as assert } from 'assert'

import { Connection as AMQP } from '../src/amqp'
import { once } from 'events'

describe('Queue', () => {  
  describe('proxy', () => {
    let amqp: AMQP
    let proxy: any

    beforeEach(async () => {
      proxy = new Proxy.route(7008, 5672, "rabbitmq")
      await once(proxy.server, 'listening')

      amqp = new AMQP({ host: 'localhost', port: 7008, heartbeat: 1000 })
      await amqp.connect()
    })

    afterEach(async () => {
      await amqp.close()
      proxy.close()
    })

    it('test it can get a queues consumer count with connection trouble 503', async () => {
      const queueName = uuid()

      const queue = await amqp.queue({ queue: queueName, autoDelete: false })
      await queue.declare({ passive: false })
      await queue.bind("amq.direct", queueName)

      const res = await queue.consumerCount()
      res.should.eql(0)

      proxy.interrupt()

      const processor = () => {
        // i do nothing :)
      }

      await amqp.consume(queueName, {}, processor)

      await setTimeout(250)

      const count = await queue.consumerCount()
      assert.equal(count, 1)

      await queue.delete()
    })

    it('test it can get a queues consumer count with connection trouble 504', async () => {
      const queue = await amqp.queue({ queue: "testing", autoDelete: false, durable: true })

      await queue.declare({ passive: false })
      await queue.bind("amq.direct", "testing")

      proxy.close()

      await Promise.all([
        assert.rejects(queue.consumerCount()),
        setTimeout(1000).then(() => proxy.listen())
      ])
      proxy.interrupt();

      (await queue.consumerCount()).should.eql(0)

      await queue.delete()
    })
  })

  describe('no-proxy', () => {
    let amqp: AMQP

    beforeEach(async () => {
      amqp = new AMQP({ host: 'rabbitmq' })
      await amqp.connect()
    })

    afterEach(async () => {
      await amqp.close()
    })

    it('test it can declare a queue 500', async () => {
      const queue = await amqp.queue({ queue: "testing" })
      await queue.declare({ passive: false })
      await queue.delete()
    })

    it('test it can declare a queue with no name 5001', async () => {
      const queue = await amqp.queue({ queue: '' })

      const r = await queue.declare({ passive: false })
      assert(r.queue)

      await queue.bind("amq.direct", uuid())
      queue.queueOptions.queue.should.not.eql('')
    })

    it('test it can get a queues message count 501', async () => {
      const queuename = uuid()
      const queue = await amqp.queue({ queue: queuename })
      await queue.declare({ passive: false })

      await queue.bind("amq.direct", queuename);

      (await queue.messageCount()).should.eql(0)

      await amqp.publish("amq.direct", queuename, "test message", { confirm: true })

      const res = await queue.messageCount()
      res.should.eql(1)

      await queue.delete({ ifEmpty: false })
    })

    it('test it can get a queues consumer count 502', async () => {
      const queue = await amqp.queue({ queue: "testing" })
      await queue.declare({ passive: false })
      await queue.bind("amq.direct", "testing");

      (await queue.consumerCount()).should.eql(0)

      const processor = () => {
        // i do nothing :)
      }

      await amqp.consume("testing", {}, processor);

      (await queue.consumerCount()).should.eql(1)

      await queue.delete()
    })

    it('test it can declare a queue while its trying to close a temp channel 632', async () => {
      const queue = await amqp.queue({ queue: "testing" })
      queue.channel.close()

      await queue.declare({ passive: false })
      await queue.delete()
    })

    it('test it can declare a queue while its trying to close a temp channel deferred 633', async () => {
      const queue = await amqp.queue({ queue: "testing" })

      await Promise.all([
        queue.declare({ passive: false }),
        setTimeout(1).then(() => queue.channel.close())
      ])

      await queue.delete()
    })

    it('test it can delete a queue', async () => {
      const queue = await amqp.queue({ queue: "testing" })
      await queue.declare({ passive: false })
      await queue.delete({})
    })

    it('test we can bind a queue', async () => {
      const queueName = uuid()
      const queue = await amqp.queue({ queue: queueName })
      await queue.declare({ passive: false })
      await queue.bind("amq.direct", queueName)
    })

    it('test we can bind queue to headers with custom arguments', async () => {
      const queueName = uuid()
      const queue = await amqp.queue({ queue: queueName })
      await queue.declare({ passive: false })

      const opts = {
        arguments: {
          'x-routing-key': queueName
        }
      }

      await queue.bind("amq.match", "", opts)
    })

    it('test we do not error on a double bind', async () => {
      const queueName = uuid()
      const queue = await amqp.queue({ queue: queueName })
      await queue.declare({ passive: false })
      await queue.bind("amq.direct", "testing")
      await queue.bind("amq.direct", "testing")

      await queue.delete()
    })

    it('test we can unbind a queue 2885', async () => {
      const queueName = uuid()
      const queue = await amqp.queue({ queue: queueName })
      await queue.declare({ passive: false })

      await queue.bind("amq.direct", "testing")
      await queue.bind("amq.direct", "testing2")

      await queue.unbind("amq.direct", "testing")
      await queue.unbind("amq.direct", "testing2")

      await setTimeout(10)

      let openChannels = 0
      for (const channel of amqp.channels.values()) {
        if (channel.state === 'open') openChannels++
      }
      openChannels.should.eql(2)

      await setTimeout(500)

      openChannels = 0
      for (const channel of amqp.channels.values()) {
        if (channel.state === 'open') openChannels++
      }
      openChannels.should.eql(1)

      await queue.delete()
    })

    it('test we can unbind a queue with no callbacks 2886', async () => {
      const queueName = uuid()
      const queue = await amqp.queue({ queue: queueName })
      await queue.declare({ passive: false })

      await queue.bind("amq.direct", "test1")
      await queue.bind("amq.direct", "test2")
      await queue.bind("amq.direct", "test3")
      await setTimeout(30)

      await queue.unbind("amq.direct", "test1")
      await queue.unbind("amq.direct", "test2")
      await queue.unbind("amq.direct", "test3")
      await setTimeout(500)

      let openChannels = 0
      for (const channel of amqp.channels.values()) {
        if (channel.state === 'open') openChannels++
      }
      openChannels.should.eql(1)

      await queue.delete()
    })

    it('test we can bind to a non-existing exchange and not leave channels open 2889', async () => {
      const queueName = uuid()
      const queue = await amqp.queue({ queue: queueName, passive: false, exclusive: true, autoDelete: true })
      await queue.declare()

      await assert.rejects(queue.bind("amq.direct2", "test1"))
      await assert.rejects(queue.bind("amq.direct2", "test1"))
      await setTimeout(100)
      await assert.rejects(queue.bind("amq.direct2", "test1"))
      await assert.rejects(queue.bind("amq.direct2", "test1"))

      await setTimeout(500)

      let openChannels = 0
      for (const channel of amqp.channels.values()) {
        if (channel.state === 'open') openChannels++
      }
      openChannels.should.eql(1)
    })

    it('test we can timeout a queue channel and reopen it', async () => {
      const queueName = uuid()
      const queue = await amqp.queue({ queue: queueName })
      await queue.declare({ passive: false })

      amqp.channels.size.should.eql(2)
      await setTimeout(500)

      amqp.channels.size.should.eql(1)

      await queue.declare({ passive: false })

      amqp.channels.size.should.eql(2)
    })

    it('test after a unbind error we could rebind, on a different channel', async () => {
      const queueName = uuid()
      const queue = await amqp.queue({ queue: queueName })

      await queue.declare({ passive: false })
      await queue.bind("amq.direct", "testing")

      await queue.unbind("amq.direct", "testing")
      await queue.channel.crash()
      await queue.bind("amq.direct", "testing")
    })

    it('test we get a error on a bad bind', async () => {
      const queueName = uuid()
      const queue = await amqp.queue({ queue: queueName })

      await assert.rejects(queue.bind("amq.direct", "testing"), {
        replyCode: 404
      })
    })

    it('test it can declare a AD queue twice 5897', async () => {
      let eventFired = 0

      amqp.on('error', (e) => {
        assert.ifError(e)
        eventFired += 1
      })

      const queue = await amqp.queue({ queue: 'testQueueHA', durable: true, autoDelete: true })
      eventFired += 1

      await queue.declare()
      eventFired += 1

      const amqp2 = new AMQP({ host: 'rabbitmq' })
      await amqp2.connect()

      amqp2.on('error', (e) => {
        assert.ifError(e)
        eventFired += 1
      })

      const q2 = await amqp2.queue({ queue: 'testQueueHA', durable: true, autoDelete: false })
      eventFired += 1

      await assert.rejects(q2.declare())
      eventFired += 1

      await setTimeout(1000)
      eventFired.should.eql(4)
    })
  })
})
