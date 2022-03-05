import 'should'
import { v4 as uuid } from 'uuid'
import { strict as assert } from 'assert'
import { Connection as AMQP } from '../src/amqp'

describe('Rabbit Plugin', () => {
  it('tests we can connect with a master node for a non-existent queue', async () => {
    const queue = uuid()
    const amqp = new AMQP({host:['rabbitmq'], rabbitMasterNode:{queue}})
    await amqp.connect()

    const q = await amqp.queue({ queue })
    await q.declare()
    await q.bind("amq.direct", queue)

    const messageProcessor = () => {
      // do nothing
    }

    await amqp.consume(queue, {}, messageProcessor)
    await amqp.close()
  })

  it('tests we can try to connect to a with a masterNode with no api server', async () => {
    const queue = uuid()
    const amqp = new AMQP({ host:['idontexist.testing'], rabbitMasterNode:{queue}})
    await assert.rejects(amqp.connect())
  })

  it('tests we can not connect to the master node', async () => {
    const queue = "masterNodeTest2"

    const amqp = new AMQP({host:['rabbitmq'], rabbitMasterNode:{queue}})
    await amqp.connect()
    const q = await amqp.queue({queue, autoDelete: false})
    await q.declare()
    await q.bind("amq.direct", queue)
    await amqp.close()
    
    const amqp2 = new AMQP({host:['127.0.0.1'], rabbitMasterNode:{queue}})
    assert.rejects(amqp2.connect())
  })

  it('tests we can connect with a master node for a existing queue', async () => {
    const queue = "masterNodeTest"
    const amqp = new AMQP({host:['rabbitmq'], rabbitMasterNode:{queue}})
    await amqp.connect()

    const q = await amqp.queue({queue, autoDelete: false})
    await q.declare()
    await q.bind("amq.direct", queue)

    await amqp.close()
    const amqp2 = new AMQP({host:['rabbitmq'], rabbitMasterNode:{queue}})
    await amqp2.connect()
    
    const messageProcessor = () => {/* do nothing */}

    await amqp2.consume(queue, {}, messageProcessor)

    amqp2.activeHost.should.eql('rabbitmq')

    await amqp2.close()
  })
})