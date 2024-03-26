/* eslint-disable no-console */
/* eslint-disable prefer-const */
import 'should'
import { v4 as uuid } from 'uuid'
import { strict as assert } from 'assert'
import { Connection as AMQP, Consumer, Message, ServerClosedError } from '../src'
import { MaxFrameSize } from '@microfleet/amqp-codec'
import { times, timesLimit, timesSeries, until } from 'async'
import { setTimeout } from 'timers/promises'
import bson = require('bson')
import Proxy = require('./proxy')

describe('Consumer', () => {
  let amqp: AMQP

  beforeEach(async () => {
    amqp = new AMQP({ host: 'rabbitmq' })
    await amqp.connect()
  })

  afterEach(async () => {
    await amqp.close()
  })

  const verify = async (fn: () => boolean) => {
    await until(
      async () => !!fn(), 
      async () => {
        await setTimeout(200)
      }
    )
  }

  it('test we can consume a queue and get a message', async () => {
    const testData = {test:"message"}
    const queue = uuid()

    let done = false

    const messageProcessor = (m: Message) => {
      m.data.should.eql(testData)
      done = true
    }

    const q = await amqp.queue({queue})
    await q.declare()
    await q.bind("amq.direct", queue)

    await amqp.consume(queue, {}, messageProcessor)
    await amqp.publish("amq.direct", queue, testData, {confirm: true})

    await verify(() => done)
  })


  it('test we can consume a queue and get a message with headers 163', async () => {
    const testData = {test:"message"}
    const queue = uuid()
    const headers = { 'x-test': 'test' }

    let done = false
    const messageProcessor = (m: Message) => {
      m.data.should.eql(testData)
      assert(m.properties.headers)
      m.properties.headers.should.eql(headers)
      done = true
    }

    const q = await amqp.queue({queue})
    await q.declare()
    await q.bind("amq.direct", queue)

    await amqp.consume(queue, {}, messageProcessor)

    await amqp.publish("amq.direct", queue, testData, { confirm: true, headers })

    await verify(() => done)
  })

  it('test we can set up a bunch of consumes 164', async () => {
    const queue = uuid()
    const messageProcessor = () => {
      // do nothing
    }

    const q = await amqp.queue({queue})
    await q.declare()
    await q.bind("amq.direct", queue)

    await times(20, async () => {
      await amqp.consume(queue, {}, messageProcessor)
    })
  })

  it('test we fail correctly with a exclusive consumer 165', async () => {
    const queue = uuid()
    const messageProcessor = () => {
      // do nothing
    }

    const q = await amqp.queue({queue})
    await q.declare()
    await q.bind("amq.direct", queue)

    await amqp.consume(queue, {exclusive: true}, messageProcessor)
    await assert.rejects(amqp.consume(queue, { exclusive: true }, messageProcessor))
  })

  it('test we can consume a queue and get a message, and keep it intact', async () => {
    const testData = {test:"message"}
    const queue = uuid()

    let done = false
    const messageProcessor = (m: Message) => {
      let message = m.data
      message.should.eql(testData)

      message = {test:false}
      message.should.not.eql(testData)

      message = m.data
      message.should.eql(testData)

      done = true
    }

    const q = await amqp.queue({queue})
    await q.declare()
    await q.bind("amq.direct", queue)

    await amqp.consume(queue, {}, messageProcessor)

    await amqp.publish("amq.direct", queue, testData, { confirm: true })
    await verify(() => done)
  })

  it('test we can consume a queue and get some messages, and keep them intact 587', async () => {
    const testData = [{test:"message1"},{test:"message2"}]
    const queue = uuid()

    let messageN = 0
    const messages: Message[] = []

    let done = false
    const messageProcessor = (m: Message) => {
      const thisMessage = messageN
      messageN++

      let message = m.data
      message.should.eql(testData[thisMessage])

      message = {test:false}
      message.should.not.eql(testData[thisMessage])

      message = m.data
      message.should.eql(testData[thisMessage])

      messages.push(m)

      if (messageN === 2) {
        let mcheck = 0
        for (const message of messages.values()) {
          message.data.should.eql(testData[mcheck])
          mcheck += 1
        }
        done = true
      }
    }

    const q = await amqp.queue({queue})
    await q.declare()
    await q.bind("amq.direct", queue)

    await amqp.consume(queue, {}, messageProcessor)

    await amqp.publish("amq.direct", queue, testData[0], {confirm: true})
    await amqp.publish("amq.direct", queue, testData[1], {confirm: true})

    await verify(() => done)
  })

  it('test we can consume a queue and get a big message 588', async () => {
    const testData = Buffer.alloc(MaxFrameSize*3.5)
    const queue = uuid()

    let done = false
    const messageProcessor = (m: Message) => {
      m.data.length.should.eql(testData.length)

      // byte by byte comparison replaces # m.data.should.eql(testData)
      assert.equal(testData.compare(m.data), 0, 'data === incorrect')
      done = true
    }

    const q = await amqp.queue({queue})
    await q.declare()
    await q.bind("amq.direct", queue)

    await amqp.consume(queue, {}, messageProcessor)
    await amqp.publish("amq.direct", queue, testData, {confirm: true})

    await verify(() => done)
  })

  it('test we can consume a queue several really big messages 173', async () => {
    const testData = Buffer.alloc(10*1024*1024) // 10 mb ish
    const queue = uuid()

    const messagesToSend = 10
    let messagesRecieved = 0

    let done = false
    const messageProcessor = (m: Message) => {
      m.data.length.should.eql(testData.length)

      // byte by byte comparison replaces # m.data.should.eql(testData)
      assert.equal(testData.compare(m.data), 0, 'data === incorrect')

      messagesRecieved += 1
      if (messagesRecieved === messagesToSend) {
        done = true
      }
    }

    const q = await amqp.queue({queue})
    await q.declare()
    await q.bind("amq.direct", queue)

    await amqp.consume(queue, {}, messageProcessor)

    await times(messagesToSend, async () => {
      await amqp.publish("amq.direct", queue, testData, { confirm: false })
    })

    await verify(() => done)
  })

  it('test we can consume a queue and get a JSON big message', async () => {
    const t = Buffer.alloc(MaxFrameSize*3.5)
    const testData = {t: t.toString()}
    const queue = uuid()

    let done = false
    const messageProcessor = (m: Message) => {
      m.data.should.eql(testData)
      done = true
    }

    const q = await amqp.queue({queue})
    await q.declare()
    await q.bind("amq.direct", queue)

    await amqp.consume(queue, {}, messageProcessor)

    await amqp.publish("amq.direct", queue, testData, {confirm: true})
    await verify(() => done)
  })

  it('test we can consume a queue and get a BSON big message 142', async () => {
    const t = Buffer.alloc(MaxFrameSize*3.5)
    const testData = {t: t.toString()}
    const queue = uuid()

    let done = false
    const messageProcessor = (m: Message) => {
      m.data.should.eql(testData)
      done = true
    }

    const q = await amqp.queue({queue})
    await q.declare()
    await q.bind("amq.direct", queue)

    await amqp.consume(queue, {}, messageProcessor)

    // testData = BSON.serialize testData
    await amqp.publish("amq.direct", queue, bson.serialize(testData), {contentType:"application/bson", confirm: true})
    await verify(() => done)
  })

  it('test we can consume and get max messages', async () => {

    const testData = {test:"message"}
    const queue = uuid()
    let messagesRecieved = 0

    let done = false
    const messageProcessor = async (m: Message) => {
      m.data.should.eql(testData)
      messagesRecieved += 1
      if (messagesRecieved === 1) {
        await setTimeout(50)
        messagesRecieved.should.eql(2)
        m.ack()
      }

      if (messagesRecieved === 3) {
        await setTimeout(1)
        messagesRecieved.should.eql(3)
        done = true
      }
    }

    const q = await amqp.queue({queue})
    await q.declare()
    await q.bind("amq.direct", queue)

    await times(10, async () => {
      await amqp.publish("amq.direct", queue, testData, { confirm: true })
    })

    await amqp.consume(queue, {prefetchCount: 2}, messageProcessor)
    await verify(() => done)
  })

  it('test we can consume and change prefetchCount 700', async () => {
    const testData = {test:"message"}
    const queue = uuid()
    let messagesRecieved = 0
    
    let consumer: Consumer
    let done = false
    const queueConnection = await amqp.queue({ queue, autoDelete: false })
    await queueConnection.declare()
    await queueConnection.bind("amq.direct", queue)

    const messageProcessor = async (m: Message) => {
      m.data.should.eql(testData)
      messagesRecieved += 1
      if (messagesRecieved === 1) {
        await setTimeout(50)
        messagesRecieved.should.eql(2)
        await consumer.setQos(5)
        m.ack()
      }

      if (messagesRecieved === 3) {
        await setTimeout(50)
        console.log('messagesRecieved', messagesRecieved)
        messagesRecieved.should.eql(6)
        done = true
      }
    }

    await times(10, async () => {
      await amqp.publish("amq.direct", queue, testData, { confirm: true })
    })

    const consumerOptions = {prefetchCount: 2, global: false}
    if (amqp.serverProperties?.product == 'RabbitMQ' &&
        (amqp.serverProperties?.capabilities?.per_consumer_qos === true ||
        amqp.serverProperties?.version == "3.3.0" )) {
      consumerOptions.global = true
    }
    
    consumer = await amqp.consume(queue, consumerOptions, messageProcessor)

    await verify(() => done)
    await queueConnection.delete({ ifEmpty: false })
  })

  it('test we can consume a bunch of messages 215', async () => {

    const prefetchCount = 1000
    const testData = {test:"message"}
    const queue = uuid()
    let messagesRecieved = 0

    let done = false
    const messageProcessor = async (m: Message) => {
      m.data.should.eql(testData)
      messagesRecieved += 1

      if (messagesRecieved === prefetchCount) {
        await setTimeout(50)
        messagesRecieved.should.eql(prefetchCount)
        done = true
      }
    }

    const q = await amqp.queue({queue})
    await q.declare()
    await q.bind("amq.direct", queue)

    await timesLimit(prefetchCount, 500, async () => {
      await amqp.publish("amq.direct", queue, testData, { confirm: true })
    })

    await amqp.consume(queue, {prefetchCount}, messageProcessor)

    await verify(() => done)
  })

  it('test we can use flow control 496', async () => {
    const testData = {test:"message"}
    const queue = uuid()

    let messagesRecieved = 0
    let consumer: Consumer
    let done = false
    const messageProcessor = async (m: Message) => {
      m.data.should.eql(testData)
      messagesRecieved += 1

      if (messagesRecieved === 10) {
        await consumer.pause()
        setTimeout(500).then(async () => {
          messagesRecieved.should.eql(10)
          await consumer.resume()
        })
      }

      setTimeout(50).then(() => m.ack())

      if (messagesRecieved === 50) {
        await setTimeout(50)
        messagesRecieved.should.eql(50)
        done = true
      }
    }

    const q = await amqp.queue({autoDelete:false, queue})
    await q.declare()
    await q.bind("amq.direct", queue)
    
    await times(50, async () => {
      await amqp.publish("amq.direct", queue, testData, { confirm: true })
    })
  
    await amqp.consume(queue, {prefetchCount: 10}, messageProcessor)
    await verify(() => done)
  })

  it('test we can consume and reject a message', async () => {
    const testData = {test:"message"}
    const queue = uuid()
    
    let messagesRecieved = 0
    let done = false
    const messageProcessor = async (m: Message) => {
      m.data.should.eql(testData)
      messagesRecieved += 1

      setTimeout(50).then(() => m.reject())

      if (messagesRecieved === 5) {
        await setTimeout()
        messagesRecieved.should.eql(5)
        done = true
      }
    }

    const q = await amqp.queue({queue})
    await q.declare()
    await q.bind("amq.direct", queue)

    await times(5, async () => {
      await amqp.publish("amq.direct", queue, testData, { confirm: true })
    })

    await amqp.consume(queue, {prefetchCount: 2}, messageProcessor)
    await verify(() => done)
  })

  it('test we can consume and retry a message', async () => {
    const testData = {test:"message"}
    const queue = uuid()
    
    let messagesRecieved = 0
    let done = false
    const messageProcessor = async (m: Message) => {
      m.data.should.eql(testData)
      messagesRecieved += 1

      if (messagesRecieved <= 2)
        m.retry()
      else
        m.ack()

      if (messagesRecieved === 2) {
        await setTimeout(200)
        messagesRecieved.should.eql(5)
        done = true
      }
    }

    const q = await amqp.queue({queue})
    await q.declare()
    await q.bind("amq.direct", queue)

    await times(3, async () => {
      await amqp.publish("amq.direct", queue, testData, {confirm: true})
    })

    await amqp.consume(queue, {prefetchCount: 2}, messageProcessor)

    await verify(() => done)
  })

  it('test we can consume and deal with a crash mid stream 705', async () => {

    const testData = {test:"message"}
    const queue = uuid()
    
    let messagesRecieved = 0
    let consumer: Consumer
    let done = false
    const messageProcessor = async (m: Message) => {
      m.data.should.eql(testData)
      messagesRecieved += 1
      if (messagesRecieved === 1) {
        await setTimeout(50)
        messagesRecieved.should.eql(2)
        consumer.crash()
        m.ack()
      }
      
      if (messagesRecieved === 4) {
        await setTimeout()
        messagesRecieved.should.eql(4)
        done = true
      }
    }

    const q = await amqp.queue({queue, autoDelete:false})
    await q.declare()
    await q.bind("amq.direct", queue)

    await times(3, async () => {
      await amqp.publish("amq.direct", queue, testData, {confirm: true})
    })

    consumer = await amqp.consume(queue, { prefetchCount: 2 }, messageProcessor)

    await verify(() => done)
  })

  it('test we can consume and cancel the consumer', async () => {
    const testData = {test:"message"}
    const queue = uuid()
    
    let messagesRecieved = 0
    let consumer: Consumer
    let done = false
    const messageProcessor = async (m: Message) => {
      console.log(m.data)
      m.data.should.eql(testData)
      messagesRecieved += 1

      if (messagesRecieved === 1) {
        await Promise.all([
          consumer.cancel().then(() => m.ack()),
          setTimeout(300).then(() => {
            messagesRecieved.should.eql(1)
            done = true
          })
        ])
      }
    }

    const q = await amqp.queue({queue, autoDelete:false})
    await q.declare()
    await q.bind("amq.direct", queue)

    await times(10, async () => {
      await amqp.publish("amq.direct", queue, testData, {confirm: true})
    })

    consumer = await amqp.consumer()
    await consumer.consume(queue, messageProcessor, { prefetchCount: 1 })

    await verify(() => done)
  })

  it('test we can consumer cancel notify', async () => {
    await amqp.close()
    const queue = uuid()
    
    const messageProcessor = (m: Message) => {
      console.error(m)
    }

    amqp = new AMQP({host:'rabbitmq', clientProperties: { capabilities: { consumer_cancel_notify: true }}})
    await amqp.connect()
          
    const q = await amqp.queue({queue, autoDelete:false})
    await q.declare()
    await q.bind("amq.direct", queue)

    const consumer = await amqp.consume(queue, {prefetchCount: 1}, messageProcessor)
    let done = false
    consumer.on('error', (err) => {
      assert(err)
      // @ts-expect-error ServerCancelError
      err.code.should.eql("basicCancel")
      done = true
    })

    await q.delete()
    await verify(() => done)
  })

  it('test we can consumer cancel notify with cancel listener', async () => {
    await amqp.close()
    const queue = uuid()

    const messageProcessor = (m: Message) => {
      console.error(m)
    }

    amqp = new AMQP({host:'rabbitmq', clientProperties: { capabilities: { consumer_cancel_notify: true }}})
    await amqp.connect()
    const q = await amqp.queue({queue, autoDelete:false})
    await q.declare()
    await q.bind("amq.direct", queue)

    let done = false
    const consumer = await amqp.consume(queue, { prefetchCount: 1}, messageProcessor)
    
    consumer.on('error', () => {
      assert.fail('error received, must not be here')
    })

    consumer.on('cancel', (err) => {
      assert(err)
      err.code.should.eql('basicCancel')
      err.name.should.eql('AMQP_ServerCancel')
      done = true
    })

    await q.delete()
    await verify(() => done)
  })

  it('test we can consume and interrupt a autoDelete queue 854', async () => {
    await amqp.close()
    const thisproxy = new Proxy.route(7007, 5672, "rabbitmq")
    const testData = {test:"message"}
    const queue = uuid()
    
    let messagesRecieved = 0
    let done = false
    const messageProcessor = (m: Message) => {
      m.data.should.eql(testData)
      messagesRecieved += 1

      if (messagesRecieved === 5) {
        thisproxy.interrupt()
      }

      m.ack()
    }

    amqp = new AMQP({ host: 'localhost', port: 7007 })
    await amqp.connect()
    const q = await amqp.queue({queue, autoDelete:true})
    await q.declare()
    await q.bind("amq.direct", queue)

    await times(10, async () => {
      await amqp.publish("amq.direct", queue, testData, {confirm: true})
    })

    const consumer = await amqp.consume(queue, {prefetchCount: 1}, messageProcessor)
          
    consumer.on('error', async (error) => {
      assert(error instanceof ServerClosedError)
      error.reason.replyCode.should.eql(404)
      await amqp.close()
      thisproxy.close()
      done = true
    })

    await verify(() => done)
  })

  it('test we can consume and interrupt a nameless queue 806', async () => {
    await amqp.close()
    const thisproxy = new Proxy.route(7007, 5672, "rabbitmq")
    const testData = {test:"message"}

    let messagesRecieved = 0
    let errorCount = 0
    let consumer: Consumer
    let done = false
    let queue = ''

    const messageProcessor = async (m: Message) => {
      messagesRecieved += 1
      thisproxy.interrupt()
      await setTimeout(25)
    }

    amqp = new AMQP({ host: 'localhost', port: 7007 })
    await amqp.connect()
    const q = await amqp.queue({queue})
    await q.declare()
    queue = q.queueOptions.queue

    consumer = await amqp.consume(queue, { prefetchCount: 1 }, messageProcessor)
    consumer.on('error', async (error) => {
      assert(error instanceof ServerClosedError)
      error.reason.replyCode.should.eql(404)
      errorCount += 1
      if (errorCount === 1) {
        messagesRecieved.should.eql(1)
        await setTimeout(300)
        errorCount.should.eql(1)
        done = true
      }
    })

    await amqp.publish("", queue, testData, {confirm: true})
    await verify(() => done)

    await amqp.close()
    thisproxy.close()
  })

  it('test we can consume and interrupt a nameless queue with resume 807', async () => {
    await amqp.close()
    const thisproxy = new Proxy.route(7008, 5672, "rabbitmq")
    const testData = {test:"message"}

    let messagesRecieved = 0
    let consumer: Consumer
    let errorCount = 0
    let done = false

    const messageProcessor = async (m: Message) => {
      console.log('MESSAGE RECEIVED')
      messagesRecieved += 1

      thisproxy.interrupt()
      await setTimeout(25)

      // as this won't bubble further
      try {
        await consumer.resume() // must call .close() on error
      } catch (err) {
        assert(err instanceof ServerClosedError)
        err.reason.replyCode.should.eql(404)
        errorCount += 1

        await consumer.close()

        if (errorCount === 1) {
          await setTimeout(300)
          errorCount.should.eql(1)
          messagesRecieved.should.eql(1)
          done = true
        }
      }
    }

    let queue = ''
    amqp = new AMQP({ host: 'localhost', port: 7008 })
    await amqp.connect()
    const q = await amqp.queue({queue})
    await q.declare()
    queue = q.queueOptions.queue

    consumer = await amqp.consumer()
    await consumer.consume(queue, messageProcessor, { prefetchCount: 1 })

    await amqp.publish("", queue, testData, {confirm: true})
    await verify(() => done)

    await amqp.close()
    thisproxy.close()
  })

  it('test we can consume and interrupt a nameless queue with close 807.5', async () => {
    await amqp.close()
    const thisproxy = new Proxy.route(7008, 5672, "rabbitmq")
    const testData = {test:"message"}
    
    let messagesRecieved = 0
    let consumer: Consumer
    let queue = ''
    let errorCount = 0

    const messageProcessor = async (m: Message) => {
      messagesRecieved += 1
      thisproxy.interrupt()
      await setTimeout(500)
      await consumer.close()
    }

    amqp = new AMQP({host:'localhost', port: 7008})
    await amqp.connect()

    const q = await amqp.queue({queue})
    await q.declare()
    queue = q.queueOptions.queue

    consumer = await amqp.consume(queue, {prefetchCount: 1}, messageProcessor)

    let done = false
    consumer.on('error', async (error) => {
      assert(error instanceof ServerClosedError)
      error.reason.replyCode.should.eql(404)
      errorCount += 1
      if (errorCount === 1) {
        await setTimeout(300)
        errorCount.should.eql(1)
        messagesRecieved.should.eql(1)
        done = true
      }
    })

    await amqp.publish("", queue, testData, {confirm: true})
    await verify(() => done)

    await amqp.close()
    thisproxy.close()
  })

  it('test we can close a consumer channel 854.5', async () => {
    const testData = {test:"message"}
    const queue = uuid()
    
    let messagesRecieved = 0
    let consumer: Consumer
    let done = false
    const messageProcessor = async (m: Message) => {
      m.data.should.eql(testData)
      messagesRecieved += 1

      if (messagesRecieved === 5) {
        await consumer.close()
        setTimeout(200).then(() => {
          (messagesRecieved > 6).should.eql(false)
          done = true
        })
      }

      m.ack()
    }

    const q = await amqp.queue({queue, autoDelete:false})
    await q.declare()
    await q.bind("amq.direct", queue)

    await times(10, async () => {
      await amqp.publish("amq.direct", queue, testData, {confirm: true})
    })

    consumer = await amqp.consume(queue, {prefetchCount: 1}, messageProcessor)
    await verify(() => done)
  })

  it('test we can consume and interrupt midstream and get all the messages 855', async () => {
    await amqp.close()
    const thisproxy = new Proxy.route(7003, 5672, "rabbitmq")
    const testData = {test:"message"}
    const queue = uuid()
    
    let messagesRecieved = 0
    let done = false
    const messageProcessor = (m: Message) => {
      m.data.should.eql(testData)
      messagesRecieved += 1

      if (messagesRecieved === 5) {
        thisproxy.interrupt()
      }

      if (messagesRecieved === 10) {
        done = true
      }
      m.ack()
    }


    amqp = new AMQP({host:'localhost', port: 7003})
    await amqp.connect()

    const q = await amqp.queue({queue, autoDelete:false})
    await q.declare()
    await q.bind("amq.direct", queue)

    await times(10, async () => {
      await amqp.publish("amq.direct", queue, testData, {confirm: true})
    })

    await amqp.consume(queue, {prefetchCount: 1}, messageProcessor)
    await verify(() => done)
  })

  it('test we can consume a undefined message 856', async () => {
    const queue = uuid()
    let done = false
    const messageProcessor = async (m: Message) => {
      assert(m.data === undefined)
      done = true
    }

    const q = await amqp.queue({queue})
    await q.declare()
    await q.bind("amq.direct", queue)

    await amqp.publish("amq.direct", queue, undefined, {confirm: true})
    await amqp.consume(queue, {}, messageProcessor)

    await verify(() => done)
  })

  it('test we can consume a null message 857', async () => {
    const queue = uuid()
    let done = false
    const messageProcessor = async (m: Message) => {
      (m.data == null).should.eql(true)
      done = true
    }

    const q = await amqp.queue({queue})
    await q.declare()
    await q.bind("amq.direct", queue)

    await amqp.publish("amq.direct", queue, null, {confirm: true})

    await amqp.consume(queue, {}, messageProcessor)
    await verify(() => done)
  })

  it('test we can consume a zero length message 858', async () => {
    const queue = uuid()
    let done = false
    const messageProcessor = async (m: Message) => {
      const zeroLengthBuffer = Buffer.alloc(0)
      assert(m.data.toString() === zeroLengthBuffer.toString())
      done = true
    }

    const q = await amqp.queue({queue})
    await q.declare()
    await q.bind("amq.direct", queue)

    await amqp.publish("amq.direct", queue, Buffer.alloc(0), {confirm: true})
    await amqp.consume(queue, {}, messageProcessor)

    await verify(() => done)
  })

  it('test acknowledging multiple deliveries', async () => {
    let consumer: Consumer
    const queueName = uuid()
    const queueOptions = {queue: queueName, autoDelete:false, durable:true}

    const queue = await amqp.queue(queueOptions)
    await queue.declare()
    await queue.bind("amq.direct", queueName)

    let done = false
    const checkSuccess = (m: Message) => {
      assert(m.deliveryTag != null)
      m.deliveryTag.should.eql(1)
      m.data.value.should.eql(3)
      done = true
    }

    const messageProcessor = async (m: Message) => {
      if (m.deliveryTag === 2)
        consumer.multiAck(2)

      if (m.deliveryTag === 3) {
        await setTimeout(500)
        await consumer.close()

        const c = await queue.messageCount(queueOptions)
        c.should.eql(1)

        const cc = await queue.consumerCount(queueOptions)
        cc.should.eql(0)

        consumer = await amqp.consume(queueName, {}, checkSuccess)
      }
    }

    consumer = await amqp.consume(queueName, {prefetchCount: 3}, messageProcessor)
    await timesSeries(3, async (value: number) => {
      await amqp.publish("amq.direct", queueName, { value: value + 1 }, { confirm: true })
    })

    await verify(() => done)
  })

  it('test we can use flow control 498 autoAck', async () => {
    const testData = {test:"message"}
    const queue = uuid()
    
    let messagesRecieved = 0
    let consumer: Consumer
    let done = false
    const messageProcessor = async (m: Message) => {
      m.data.should.eql(testData)
      messagesRecieved += 1

      if (messagesRecieved === 10) {
        consumer.pause()
        await setTimeout(500)
        messagesRecieved.should.eql(10)
        consumer.resume()
      }

      if (messagesRecieved === 50) {
        await setTimeout(50)
        messagesRecieved.should.eql(50)
        done = true
      }
    }

    const q = await amqp.queue({autoDelete:false, queue})
    await q.declare()
    await q.bind("amq.direct", queue)

    await times(50, async () => {
      await amqp.publish("amq.direct", queue, testData, {confirm: true})
    })

    consumer = await amqp.consume(queue, {prefetchCount: 10, noAck: true }, messageProcessor)

    await verify(() => done)
  })
})