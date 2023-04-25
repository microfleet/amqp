// import { HttpStatusError, Error as CommonError } from 'common-errors'
// import { route as Proxy } from '@microfleet/amqp-coffee/test/proxy.js'
// import ld from 'lodash'
// import stringify from 'json-stringify-safe'
// import sinon from 'sinon'
import assert from 'assert'
// import microtime from 'microtime'
// import { promisify } from 'util'
// import { gzip as _gzip } from 'zlib'
// import { setTimeout } from 'timers/promises'
// import { timesLimit } from 'async'
const debug = require('debug')('amqp:test')

// require module
import {
  AMQPTransport,
  // jsonSerializer,
  // jsonDeserializer,
  // connect,
  // multiConnect,
  // ExtendedMessageProperties,
  // ResponseHandler,
  // kReplyHeaders,
} from '../src'
// import { toMiliseconds } from '../src/utils/latency'
import { ConnectionState } from '@microfleet/amqp-coffee'
// import { QueueArguments } from "@microfleet/transport-amqp";
// import { v4 } from 'uuid'

// eslint-disable-next-line @typescript-eslint/no-var-requires
// const debug = require('debug')('amqp')
// const gzip = promisify(_gzip)

describe('AMQPTransport', function AMQPTransportTestSuite() {

  this.timeout(600_000)

  const RABBITMQ_HOST = process.env.RABBITMQ_PORT_5672_TCP_ADDR || 'localhost'
  const RABBITMQ_PORT = +(process.env.RABBITMQ_PORT_5672_TCP_PORT || 5672)

  const configuration = {
    exchange: 'test-exchange-non-existing',
    connection: {
      host: RABBITMQ_HOST,
      port: RABBITMQ_PORT,
    },
  }

  let amqp: AMQPTransport

  it('is able to connect to rabbitmq', async () => {
    amqp = new AMQPTransport(configuration)
    await amqp.connect()
    assert.equal(amqp.state, ConnectionState.open)
  })

  it('should throw 404 on publish to non-existing exchange', async () => {
    for(let i=0; i<20; i++) {
      debug(`creating channel ${i}`)
      try {
        await amqp.publish("users", { "foo": "bar" }, { confirm: true })
      } catch (err) {
        // console.log(err)
      }
      // await new Promise(h => setTimeout(h, 1_000))
    }
  })

  it('should not throw error upon deletion of non-existing queue', async () => {
    const { queue: queue1 } = await amqp.createQueue({ queue: 'e2:e4' })
    const { queue: queue2 } = await amqp.createQueue({ queue: 'e2:e4' })
    await queue1.delete()
    await queue2.delete()
  })

  it('should throw error 406 on queue redeclare with different parameters', async () => {

    const { queue } = await amqp.createQueue({
      queue: `test-queue`,
      arguments: {
        'x-max-length': 1,
        'x-dead-letter-exchange': `streamlayer.dlx`,
        'x-overflow': 'reject-publish'
      }
    })

    for(let i=0; i<20; i++) {
      // try to redeclare and get channel remnants without close ok
      try {
        await amqp.createQueue({
          queue: `test-queue`,
          arguments: {
            'x-max-length': 1,
            'x-dead-letter-exchange': `streamlayer.dlx`,
            'x-overflow': 'reject-publish',
            'x-expires': 86400
          }
        })
      } catch (err) {
        assert.ok(err)
      }
    }

    await queue.delete()
  })

  it('is able to disconnect', async () => {
    await new Promise(h => setTimeout(h, 60_000))
    await amqp.close()
  })


})
