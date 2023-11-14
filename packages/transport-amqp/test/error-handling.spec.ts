import assert from 'assert'

import {
  AMQPTransport
} from '../src'

import {
  ConnectionState,
} from '@microfleet/amqp-coffee'

describe('AMQPTransport', function AMQPTransportTestSuite() {

  this.timeout(30000)

  const RABBITMQ_HOST = process.env.RABBITMQ_PORT_5672_TCP_ADDR || 'localhost'
  const RABBITMQ_PORT = +(process.env.RABBITMQ_PORT_5672_TCP_PORT || 5672)

  const configuration = {
    exchange: 'amq.direct',
    connection: {
      host: RABBITMQ_HOST,
      port: RABBITMQ_PORT,
    },
  }

  const amqp: AMQPTransport= new AMQPTransport(configuration)

  before('is able to connect to rabbitmq', async () => {
    await amqp.connect()
    assert.equal(amqp.state, ConnectionState.open)
  })

  it('should be able to publish to existing exchange without errors', async () => {
      await amqp.publish("test", { "foo": "bar" }, { confirm: true })
  })

  it('should throw 404 while publishing to non-existing exchange', async () => {
      await assert.rejects(
        amqp.publish("test", { "foo": "bar" }, { confirm: true, exchange: "non-existing" }),
        (err: any) => {
          assert.equal(err.code, `AMQP_SERVER_CLOSED`)
          assert.equal(err.msg, `Server closed channel`)
          assert.equal(err.reason?.replyCode, 404)
        return true
    })
  })

  it('should throw 404 trying to access non-existing queue in passive mode', async () => {
    await assert.rejects(amqp.createQueue({
      queue: 'new-queue',
      passive: true
    }), (err: any) => {
      assert.equal(err.classId, 50)
      assert.equal(err.methodId, 10)
      assert.equal(err.replyCode, 404)
      return true
    })
  })

  it('should be able to declare queue and bind it to existing exchange', async () => {
    const { queue } = await amqp.createQueue({ queue: `bound-queue` })
    await queue.bind("amq.direct", "bound-queue")
    await amqp.publish("bound-queue", { "foo": "bar" }, { confirm: true })
  })

  it('should throw error while declaring queue and binding it to non-existing exchange', async () => {
    const { queue } = await amqp.createQueue({ queue: `test-queue` })
    await assert.rejects(queue.bind("non-existing", "test-queue"), (err: any) => {
      assert.equal(err.classId, 50)
      assert.equal(err.methodId, 20)
      assert.equal(err.replyCode, 404)
      return true
    })
  })

  it('should be safe to delete non-existing queue', async () => {
    const { queue: queue1 } = await amqp.createQueue({ queue: 'redeclared-queue' })
    const { queue: queue2 } = await amqp.createQueue({ queue: 'redeclared-queue' })
    await queue1.delete()
    await queue2.delete()
  })

  it('should throw 406 while trying to delete non-empty queue', async () => {
    const { queue } = await amqp.createQueue({ queue: 'non-empty-queue' })
    await queue.bind("amq.direct", "non-empty-queue")
    for(let i=0; i<5; i++) {
      await amqp.publish("non-empty-queue", { "foo": "bar" }, { confirm: true })
    }
    await assert.rejects(queue.delete(), (err: any) => {
      assert.equal(err.classId, 50)
      assert.equal(err.methodId, 40)
      assert.equal(err.replyCode, 406)
      return true
    })
  })

  it('should not throw 406 for createQueue() (beware 406 is consumed by library)', async () => {
    // precondition failed exception is absorbed by the library
    const { queue: queue1 } = await amqp.createQueue({
      queue: `test-queue-redeclared`,
      arguments: {
        'x-max-length': 1,
        'x-dead-letter-exchange': `streamlayer.dlx`,
        'x-overflow': 'reject-publish'
      }
    })

    const { queue: queue2 } = await amqp.createQueue({
      queue: `test-queue-redeclared`,
      arguments: {
        'x-max-length': 1,
        'x-dead-letter-exchange': `streamlayer.dlx`,
        'x-overflow': 'reject-publish',
        'x-expires': 86400
      }
    })

    await new Promise(h => setTimeout(h, 1000))
    await queue1.delete()
    await queue2.delete()
  })

  it('should not throw 406 for declareExchange() (beware, 406 is consumed by library)', async () => {
    // precondition failed exception is absorbed by the library
    const exchange1 = await amqp.declareExchange({ exchange: "test-exchange-redeclared", type: "direct" })
    const exchange2 = await amqp.declareExchange({ exchange: "test-exchange-redeclared", type: "topic"})
    await exchange1.delete()
    await exchange2.delete()
  })

  it('should restore connection upon connection reset', async () => {
    // idea: initiate connection reset by giving wrong type, make server drop connection
    // and check workability of methods, should not throw exceptions
    await assert.rejects(
        amqp.declareExchange({ exchange: "test-exchange-redeclared", type: "wrong" as any }),
        (err: any) => {
          assert.equal(err.code, 'CONNECTION_RESET')
          return true
        })
    const { queue } = await amqp.createQueue({ queue: 'after-reconnect-queue' })
    await queue.bind("amq.direct", "after-reconnect-queue")
    await amqp.publish("after-reconnect-queue", { "foo": "bar" }, { confirm: true })
    await amqp.publish("after-reconnect-queue", { "foo": "bar" }, { confirm: false })
  })

  after('is able to disconnect', async () => {
    // uncomment to check channels and messages in rabbitmq control panel
    // await new Promise(h => setTimeout(h, 60_000))
    await amqp.close()
  })


})
