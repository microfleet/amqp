import 'should'
import { v4 as uuid } from 'uuid'
import { strict as assert } from 'assert'
import { Connection as AMQP, Message } from '../src'
import { MaxFrameSize } from '@microfleet/amqp-codec'
import { times, timesSeries, until } from 'async'
import { setTimeout } from 'timers/promises'

describe('Publisher', () => {
  let amqp: AMQP

  beforeEach(async () => {
    amqp = new AMQP({ host: 'rabbitmq' })
    await amqp.connect()
  })

  afterEach(async () => {
    await amqp.close()
  })

  it('test we can publish a message in confirm mode', async () => {
    const queue = uuid()
    await amqp.publish("amq.direct", queue, "test message", {confirm:true})
  })

  it('we can publish a series of messages in confirm mode', async () => {
    const queue = uuid()
    
    await timesSeries(100, async () => {
      return amqp.publish("amq.direct", queue, "test message", { confirm: true })
    })
  })

  it('we can agressivly publish a series of messages in confirm mode 214', async () => {
    const queue = uuid()

    const q = await amqp.queue({queue})
    await q.declare()
    await q.bind("amq.direct", queue)

    await times(100, async () => {
      return amqp.publish("amq.direct", queue, "test message", { confirm: true })
    })
  })

  it('test we can publish a message a string', async () => {
    const queue = uuid()
    await amqp.publish("amq.direct", queue, "test message", {})
  })

  it('test we can publish without waiting for a connection', async () => {
    const queue = uuid()
    await amqp.publish("amq.direct", queue, "test message", {})
  })


  it('test we can publish a big string message', async () => {
    const queue = uuid()
    await amqp.publish("amq.direct", queue, `test message ${Buffer.alloc(10240000).toString()}`, {confirm: true})
  })

  it('test we can publish a JSON message', async () => {
    const queue = uuid()
    await amqp.publish("amq.direct", queue, {look:"im jason", jason:"nope"}, {})
  })

  it('test we can publish a string message 413', async () => {
    const queueName = uuid()
    const content = "ima string"
    
    const queue = await amqp.queue({queue:queueName})
    await queue.declare()
    await queue.bind('amq.direct', queueName)

    await amqp.publish("amq.direct", queueName, content, {})
    
    let consumed = false
    await amqp.consume(queueName, {}, (message) => {
      message.data.should.eql(content)
      consumed = true
    })

    await until(async () => consumed, () => setTimeout(50))
  })

  it('test we can publish a buffer message', async () => {
    const queue = uuid()
    await amqp.publish("amq.direct", queue, Buffer.alloc(15), {})
  })

  it('test we can publish a buffer message that need to be multiple data packets', async () => {
    const packetSize = MaxFrameSize * 2.5
    await amqp.publish("amq.direct", uuid(), Buffer.alloc(packetSize), {})
  })

  it('test we can publish a message size 344', async () => {
    const packetSize = 344
    await amqp.publish("amq.direct", uuid(), Buffer.alloc(packetSize), {confirm: true})
  })

  it('test we can publish a lots of messages in confirm mode 553', async () => {
    const packetSize = 344
    await timesSeries(1000, async (i: number) => {
      await amqp.publish("amq.direct", `queue-${i}`, Buffer.alloc(packetSize), {confirm: true})
    })
  })

  it('test we can publish a lots of messages in confirm mode quickly 187', async () => {
    const packetSize = 256837

    await times(100, async (i: number) => {
      await amqp.publish("amq.direct", `queue-${i}`, Buffer.alloc(packetSize), {confirm: true})
    })
  })

  it('test we can publish a mandatory message to a invalid route and not crash 188', async () => {
    await assert.rejects(
      amqp.publish("amq.direct", "idontExist", Buffer.alloc(50), {confirm:true, mandatory: true}), {
        replyCode: 312
      }
    )
  })

  it('test we can publish many mandatory messages to a some invalid routes 189', async () => {
    const queueName = uuid()
    const queue = await amqp.queue({queue:queueName})
    await queue.declare()
    await queue.bind('amq.direct', queueName)

    await Promise.all([
      timesSeries(100, async (i: number) => {
        await assert.rejects(
          amqp.publish("amq.direct", "idontExist", Buffer.alloc(50), { confirm: true, mandatory: true }), {
            replyCode: 312
          })
      }),
      timesSeries(100, async (i: number) => {
        await amqp.publish("amq.direct", queueName, Buffer.alloc(50), { confirm: true, mandatory: true })
      })
    ])
  })

  it('test we can publish quickly to multiple queues shared options 1891', async () => {
    const queueName1 = "testpublish1"
    const queueName2 = "testpublish2"

    const queue = await amqp.queue({queue:queueName1})
    await queue.declare()
    await queue.bind('amq.direct', queueName1)

    const queue2 = await amqp.queue({queue:queueName2})
    await queue2.declare()
    await queue2.bind('amq.direct', queueName2)

    const options = {confirm:true, mandatory: false}
    await timesSeries(10, async (i: number) => {
      amqp.publish("amq.direct", ["testpublish",((i%2)+1)].join(''), Buffer.alloc(50), options)
    })

    let q1count = 0
    let q2count = 0
    const messageProcessor = (message: Message) => {
      if (message.routingKey == queueName1) q1count++
      if (message.routingKey == queueName2) q2count++
    }

    await amqp.consume(queueName1, {}, messageProcessor)
    await amqp.consume(queueName2, {}, messageProcessor)

    await until(async () => q1count == 5 && q2count == 5, () => setTimeout(50))
  })

  it('test when be publishing and an out of order op happens we recover', async () => {
    const testData = {test:"message"}
    const queue = uuid()

    const q = await amqp.queue({ queue, autoDelete: false })
    await q.declare()
    await q.bind("amq.direct", queue)

    await timesSeries(5, async (i: number) => {
      try {
        await amqp.publish("amq.direct", queue, testData, {confirm: true})
      } catch(err) {
        await setTimeout(200)
        await amqp.publish("amq.direct", queue, testData, { confirm: true })
      }
    })
    
    let messagesRecieved = 0
    const messageProcessor = (m: Message) => {
      m.data.should.eql(testData)
      messagesRecieved += 1

      if (messagesRecieved === 3) {
        amqp.crashOOO()
      }

      m.ack()
    }

    await amqp.consume(queue, { prefetchCount: 1 }, messageProcessor)
    await timesSeries(50, async (i: number) => {
      try {
        await amqp.publish("amq.direct", queue, testData, { confirm: true })
      } catch (err) {
        await setTimeout(200)
        await amqp.publish("amq.direct", queue, testData, { confirm: true })
      }
    })

    await until(async () => messagesRecieved >= 55, () => setTimeout(100))
  })

  it('test when an out of order op happens while publishing large messages we recover 915', async () => {
    const testData = {test:"message", size: Buffer.alloc(1000)}
    const queue = uuid()
    
    const q = await amqp.queue({queue, autoDelete: false })
    await q.declare()
    await q.bind("amq.direct", queue)

    let messagesRecieved = 0
    const messageProcessor = (m: Message) => {
      // m.data.should.eql testData
      messagesRecieved += 1

      if (messagesRecieved === 100) {
        amqp.crashOOO()
      }

      m.ack()
    }

    await amqp.consume(queue, {prefetchCount: 1}, messageProcessor)

    await times(500, async (i: number) => {
      try {
        await amqp.publish("amq.direct", queue, testData, {confirm: true})
      } catch (e) {
        await setTimeout(200)
        await amqp.publish("amq.direct", queue, testData, { confirm: true })
      }
    })

    await until(
      async () => messagesRecieved >= 500, 
      async () => {
        await setTimeout(300)
      })
  })
})
