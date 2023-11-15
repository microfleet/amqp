import { performance } from 'node:perf_hooks'
import { HttpStatusError, Error as CommonError } from 'common-errors'
import { route as Proxy } from '@microfleet/amqp-coffee/test/proxy.js'
import ld from 'lodash'
import stringify from 'json-stringify-safe'
import sinon from 'sinon'
import assert from 'assert'
import { promisify } from 'util'
import { gzip as _gzip, gunzip as _gunzip } from 'zlib'
import { setTimeout } from 'timers/promises'
import { timesLimit } from 'async'
// import v8 from 'v8'

// require module
import { 
  AMQPTransport, 
  jsonSerializer, 
  jsonDeserializer,
  connect,
  multiConnect,
  ExtendedMessageProperties,
  ResponseHandler,
  kReplyHeaders,
} from '../src'
import { ConnectionState, Message } from '@microfleet/amqp-coffee'
import { v4 } from 'uuid'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const debug = require('debug')('amqp')
const gzip = promisify(_gzip)
const gunzip = promisify(_gunzip)

const formatMemoryUsage = (data: number) => `${Math.round(data / 1024 / 1024 * 100) / 100} MB`

describe('AMQPTransport', function AMQPTransportTestSuite() {
  const RABBITMQ_HOST = process.env.RABBITMQ_PORT_5672_TCP_ADDR || 'localhost'
  const RABBITMQ_PORT = +(process.env.RABBITMQ_PORT_5672_TCP_PORT || 5672)

  const configuration = {
    exchange: 'test-exchange',
    connection: {
      host: RABBITMQ_HOST,
      port: RABBITMQ_PORT,
    },
  }

  let amqp: AMQPTransport
  let amqp_consumer: AMQPTransport

  describe('msg encoding & decoding', () => {
    const originalMsg = {
      meta: {
        controlsData: [
          0.25531813502311707, 0.0011256206780672073, 0.06426551938056946,
          -0.001104108989238739, 0.852259635925293, 0.005791602656245232,
          -0.5230863690376282, 0, 0.9999388456344604, 0.011071242392063141,
          0.523118257522583, -0.009435615502297878, 0.8522077798843384,
          0.8522599935531616, 0, 0.5231184363365173, 0, 0.005791574250906706,
          0.9999387264251709, -0.009435582906007767, 0, -0.5230863690376282,
          0.011071248911321163, 0.8522077798843384, 0, -0.13242781162261963,
          0.06709221005439758, 0.21647998690605164, 1,
        ],
        name: 'oki-dokie',
      },
      body: {
        random: true,
        data: [{
          filename: 'ok',
          version: 10.3,
        }],
      },
      buffer: Buffer.from('xxx'),
    }

    let msg: string

    it('stringifies message correctly', () => {
      msg = stringify(originalMsg, jsonSerializer)

      // eslint-disable-next-line max-len
      assert.equal(msg, '{"meta":{"controlsData":[0.25531813502311707,0.0011256206780672073,0.06426551938056946,-0.001104108989238739,0.852259635925293,0.005791602656245232,-0.5230863690376282,0,0.9999388456344604,0.011071242392063141,0.523118257522583,-0.009435615502297878,0.8522077798843384,0.8522599935531616,0,0.5231184363365173,0,0.005791574250906706,0.9999387264251709,-0.009435582906007767,0,-0.5230863690376282,0.011071248911321163,0.8522077798843384,0,-0.13242781162261963,0.06709221005439758,0.21647998690605164,1],"name":"oki-dokie"},"body":{"random":true,"data":[{"filename":"ok","version":10.3}]},"buffer":{"type":"Buffer","data":[120,120,120]}}')
    })

    it('deserializes message correctly', () => {
      assert.deepEqual(JSON.parse(msg, jsonDeserializer), originalMsg)
    })

    it('serializes & deserializes error', () => {
      const serialized = stringify(new Error('ok'), jsonSerializer)
      const err = JSON.parse(serialized, jsonDeserializer)

      assert.equal(err.name, 'MSError')
      assert.equal(!!err.stack, true)
      assert.equal(err.message, 'ok')
      assert.ok(err.constructor)
    })

    // See usage at:
    // https://github.com/microfleet/core/blob/f252a71e2947696f21d82830e2714b51aa4d8703/packages/plugin-router/src/lifecycle/handlers/response.ts#L58
    it('serializes & deserializes error wrapped with `common-errors` error', () => {
      class MyError extends Error {
        public data = { some: 'data' }
      }

      class MyBadError extends MyError { }

      const serialized = stringify(new CommonError('Wrapper', new MyBadError('ok')), jsonSerializer)
      const err = JSON.parse(serialized, jsonDeserializer)

      assert.equal(err.name, 'Error')
      assert.equal(!!err.stack, true)
      assert.equal(err.message, 'Wrapper')
      assert.deepStrictEqual(err.inner_error.data, { some: 'data' })
      assert.ok(err.constructor)
      assert.ok(err.inner_error.constructor)
    })

    it('serializes & deserializes http status error', () => {
      const serialized = stringify(new HttpStatusError(202, 'ok'), jsonSerializer)
      const err = JSON.parse(serialized, jsonDeserializer)

      assert.equal(err.name, 'HttpStatusError')
      assert.equal(!!err.stack, true)
      assert.equal(err.message, 'ok')
      assert.equal(err.statusCode, 202)
      assert.equal(err.status_code, 202)
    })
  })

  after('cleanup', async () => {
    await amqp?.close()
    await amqp_consumer?.close()
  })

  it('is able to be initialized', () => {
    const amqp = new AMQPTransport(configuration)
    assert(amqp instanceof AMQPTransport)
    assert(amqp.config, 'config defined')
  })

  it('fails on invalid configuration', () => {
    function createTransport() {
      const conf = {
        name: {},
        private: 'the-event',
        exchange: '',
        timeout: 'don-don',
        connection: 'bad option',
      }

      // @ts-expect-error testing invalid config
      return new AMQPTransport(conf)
    }

    assert.throws(createTransport, 'ValidationError')
  })

  it('is able to connect to rabbitmq', async () => {
    amqp = new AMQPTransport(configuration)
    await amqp.connect()
    assert.equal(amqp.state, ConnectionState.open)
  })

  it('is able to disconnect', async () => {
    await amqp.close()
  })

  it('is able to connect via helper function', async () => {
    amqp = await connect(configuration)
    assert.equal(amqp.state, ConnectionState.open)
  })

  it('is able to consume routes', async () => {
    const opts = {
      cache: 100,
      exchange: configuration.exchange,
      queue: 'test-queue',
      listen: ['test.default', 'test.throw'],
      connection: configuration.connection,
    }

    amqp_consumer = await connect(opts, async (message: any, raw: Message): Promise<any> => {
      amqp.log.debug({ raw }, 'incoming')

      if (raw.routingKey === 'test.throw') {
        throw new HttpStatusError(202, 'ok')
      }

      return {
        resp: typeof message === 'object' ? message : `${message}-response`,
        time: performance.now()
      }
    })

    assert.equal(amqp.state, ConnectionState.open)
  })

  it('error is correctly deserialized', async () => {
    await assert.rejects(amqp.publishAndWait('test.throw', {}, { mandatory: true, confirm: true }), {
      name: 'HttpStatusError',
      message: 'ok',
      statusCode: 202,
      status_code: 202,
    })
  })

  it('is able to publish to route consumer', async () => {
    const response = await amqp.publishAndWait('test.default', 'test-message')
    assert.equal(response.resp, 'test-message-response')
  })

  it('is able to publish to route consumer:2', async () => {
    const response = await amqp.publishAndWait('test.default', 'test-message')
    assert.equal(response.resp, 'test-message-response')
  })

  it('is able to publish to route consumer:2', async () => {
    const response = await amqp.publishAndWait('test.default', 'test-message')
    assert.equal(response.resp, 'test-message-response')
  })

  it('is able to send messages directly to a queue', async () => {
    // @ts-expect-error accessing private prop
    const privateQueue = amqp._replyTo
    assert(typeof privateQueue === 'string')
    
    await assert.rejects(amqp_consumer.sendAndWait(privateQueue, 'test-message-direct-queue'), {
      name: 'NotPermittedError'
    })
  })

  describe('concurrent publish', () => {
    let concurrent: AMQPTransport

    before('init consumer', async () => {
      concurrent = new AMQPTransport(configuration)
      await concurrent.connect()
    })

    it('able to publish multiple messages at once', () => {
      const promises = ld.times(5, (i) => (
        concurrent.publishAndWait('test.default', `ok.${i}`)
      ))
      return Promise.all(promises)
    })

    after('close consumer', async () => {
      await concurrent.close()
    })
  })

  describe('DLX: enabled', () => {
    let dlx: AMQPTransport

    before('init amqp', async () => {
      dlx = new AMQPTransport(configuration)
      await dlx.connect()
    })

    after('close amqp', async () => {
      await dlx.close()
    })

    it('create queue, but do not consume', async () => {
      const { consumer } = await dlx.createConsumedQueue(() => { /* noop */ }, ['hub'], {
        queue: 'dlx-consumer',
      })

      await consumer.close()
    })

    it('publish message and receive DLX response', async () => {
      // it will be published to the `dlx-consumer` queue
      // and after 2250 ms moved to '' with routing key based on the
      // headers values
      await assert.rejects(dlx
        .publishAndWait('hub', { wont: 'be-consumed-queue' }, {
          // set smaller timeout than 10s so we don't wait
          // resulting x-message-ttl is 80% (?) of timeout
          timeout: 2500,
        }), {
          message: 'Expired from queue "dlx-consumer" with routing keys ["hub"] after 2250ms 1 time(s)'
        })
    })
  })

  describe('cached request', () => {
    let cached: AMQPTransport
    let cachedConsumer: AMQPTransport
    let requests = 0
    let baselineMemoryUsage = process.memoryUsage()

    function printMemoryUsage() {
      const memoryData = process.memoryUsage()
      const memoryUsage = {
        rssGrowth: `${formatMemoryUsage(memoryData.rss - baselineMemoryUsage.rss)}`, // Resident Set Size - total memory allocated for the process execution
        heapTotalGrowth: `${formatMemoryUsage(memoryData.heapTotal - baselineMemoryUsage.heapTotal)}`, // total size of the allocated heap
        heapUsedGrowth: `${formatMemoryUsage(memoryData.heapUsed - baselineMemoryUsage.heapUsed)}`, // actual memory used during the execution
        externalGrowth: `${formatMemoryUsage(memoryData.external - baselineMemoryUsage.external)}`, // V8 external memory
      }
      cachedConsumer.log.info({ memoryUsage }, 'processed %d requests', requests)

      return Math.round((memoryData.heapUsed - baselineMemoryUsage.heapUsed) / 1024 / 1024 * 100) / 100
    }

    before('init publisher', async () => {
      cached = new AMQPTransport({
        ...configuration,
        cache: 1000,
      })
      await cached.connect()
    })

    before('init consumer', async () => {
      const opts = {
        cache: 2000,
        exchange: configuration.exchange,
        queue: 'test-queue-consumer-cached',
        listen: ['cached.test.default', 'cached.test.throw'],
        connection: configuration.connection,
      }

      cachedConsumer = await connect(opts, async (message: any, raw: Message): Promise<any> => {
        requests += 1

        if (requests % 10000 === 0) {
          printMemoryUsage()
        }

        if (raw.routingKey === 'cached.test.throw') {
          throw new HttpStatusError(202, 'ok')
        }

        return {
          resp: typeof message === 'object' ? message : `${message}-response`,
          time: performance.now()
        }
      })
    })

    after('close published', async () => {
      await cached.close()
      await cachedConsumer.close()
    })

    it('publishes batches of messages, they must return cached values and then new ones', async () => {
      const publish = () => cached.publishAndWait('cached.test.default', 1, { cache: 2000 })
      const spy = sinon.spy(cached, 'publish')

      try {
        const promises = [
          publish(),
          publish(),
          publish(),
          publish(),
          publish(),
          setTimeout(300).then(publish),
          setTimeout(5000).then(publish),
        ]

        const [
          initial,
          one, two, three, four,
          cachedP, 
          nonCached
        ] = await Promise.all(promises)

        // only called twice - once after expiration and everything else is deduped or read from cache
        assert.equal(spy.callCount, 2)

        // all identical
        assert.equal(initial.time, one.time)
        assert.equal(initial.time, two.time)
        assert.equal(initial.time, three.time)
        assert.equal(initial.time, four.time)

        assert.equal(initial.time, cachedP.time)
        assert(initial.time < nonCached.time)
      } finally {
        spy.restore()
      }
    })

    it('publishes batches of messages, it must dedupe them', async () => {
      const publish = () => cached.publishAndWait('cached.test.default', 1, { cache: 0 })
      const spy = sinon.spy(cached, 'publish')

      try {
        const promises = [
          publish(),
          publish(),
          publish(),
          publish(),
          publish(),
          setTimeout(300).then(publish),
          setTimeout(5000).then(publish),
        ]

        const [
          initial,
          one, two, three, four,
          nonCached1,
          nonCached2
        ] = await Promise.all(promises)

        // only called twice - once after expiration and everything else is deduped or read from cache
        assert.equal(spy.callCount, 3)

        // all identical
        assert.equal(initial.time, one.time)
        assert.equal(initial.time, two.time)
        assert.equal(initial.time, three.time)
        assert.equal(initial.time, four.time)

        assert(initial.time < nonCached1.time)
        assert(nonCached1.time < nonCached2.time)
      } finally {
        spy.restore()
      }
    })

    it('does not run out of memory when handling 10 mln messages with cache', async function test() {
      this.timeout(10000000)
      
      // v8.setFlagsFromString('--expose_gc')
      // gc
      assert(gc)

      // warm up cache & objects
      gc()

      baselineMemoryUsage = process.memoryUsage()
      const req = 10e4
      await timesLimit(req, 2000, async (i: number) => {
        return cached.publishAndWait('cached.test.default', i % 2500, { cache: 50e6 })
      })

      await setTimeout(1)
      gc()
      printMemoryUsage()

      // re-take baseline memory
      baselineMemoryUsage = process.memoryUsage()

      // second round as we've "warmed the cache of objects up"
      await timesLimit(req * 10, 2000, async (i: number) => {
        return cached.publishAndWait('cached.test.default', i % 2500, { cache: 50e6 })
      })

      await setTimeout(1)
      gc()
      const heapGroth = printMemoryUsage()

      assert(heapGroth < 0.3, `heap grew by ${heapGroth} MB`)

      // disabling trace-gc
      // v8.setFlagsFromString('--noexpose_gc')
    })
  })

  describe('contentEncoding, contentType', () => {
    
    let transport: AMQPTransport

    before('init publisher', async () => {
      transport = await connect(configuration)
    })

    after('close publisher', () => transport.close())

    it('parses application/json+gzip', async () => {
      let response
      const original = {
        sample: true,
        buf: Buffer.from('content'),
      }

      // send pre-serialized datum with gzip
      response = await transport.publishAndWait(
        'test.default',
        await gzip(JSON.stringify(original)),
        {
          skipSerialize: true,
          contentEncoding: 'gzip',
        }
      )
      assert.deepStrictEqual(response.resp, original)

      // pre-serialize no-gzip
      response = await transport.publishAndWait(
        'test.default',
        Buffer.from(JSON.stringify(original)),
        { skipSerialize: true }
      )
      assert.deepStrictEqual(response.resp, original)

      // not-serialized
      response = await transport.publishAndWait('test.default', original)
      assert.deepStrictEqual(response.resp, original)

      // not-serialized + gzip
      response = await transport.publishAndWait('test.default', original, { gzip: true })
      assert.deepStrictEqual(response.resp, original)
    })
  })

  describe('AMQPTransport.multiConnect', () => {
    let acksCalled = 0
    const preCount = sinon.spy()
    const postCount = sinon.spy()

    const conf = {
      exchange: configuration.exchange,
      connection: configuration.connection,
      queue: 'multi',
      listen: ['t.#', 'tbone', 'morgue'],
    }

    let multi: AMQPTransport
    let publisher: AMQPTransport
    let spy: sinon.SinonSpy

    after('close multi-transport', async () => {
      await multi?.close()
      await publisher?.close()
    })

    it('initializes amqp instance', async () => {
      // mirrors all messages
      spy = sinon.spy(async function listener(message, raw) {
        acksCalled += 1
        raw.ack()
        return message
      })

      // adds QoS for the first queue, but not all the others
      multi = await multiConnect(conf, spy, [{ neck: 1 }])
      publisher = await connect(configuration)

      multi.on('pre', preCount)
      multi.on('after', postCount)
    })

    it('verify that messages are all received & acked', async () => {
      const q1 = Array.from({ length: 100 }).map((_, idx) => ({
        route: `t.${idx}`,
        message: `t.${idx}`,
      }))

      const q2 = Array.from({ length: 20 }).map((_, idx) => ({
        route: 'tbone',
        message: `tbone.${idx}`,
      }))

      const q3 = Array.from({ length: 30 }).map((_, idx) => ({
        route: 'morgue',
        message: `morgue.${idx}`,
      }))

      const pub = [...q1, ...q2, ...q3]

      const responses = await Promise.all(pub.map(async (message) => {
        return publisher.publishAndWait(message.route, message.message)
      }))
  
      await setTimeout(1)

      assert.equal(acksCalled, pub.length) // all messages have .ack now

      // ensure all responses match
      pub.forEach((p, idx) => {
        assert.equal(responses[idx], p.message)
      })

      assert.equal(spy.callCount, pub.length)

      // ensure that pre & after are called for each message
      assert.equal(preCount.callCount, pub.length)
      assert.equal(postCount.callCount, pub.length)
    })
  })

  describe('priority queue', function test() {
    const conf = {
      exchange: configuration.exchange,
      connection: configuration.connection,
      queue: 'priority',
    }

    let priority: AMQPTransport
    let publisher: AMQPTransport

    it('initializes amqp instance', async () => {
      // mirrors all messages
      priority = await connect(conf)
      publisher = await connect(configuration)
    })

    after('close priority-transport', async () => {
      await priority?.close()
      await publisher?.close()
    })

    it('create priority queue', async () => {
      const { queue } = await priority.createQueue({
        queue: 'priority',
        arguments: {
          'x-max-priority': 5,
        },
      })

      await priority.bindExchange(queue, ['priority'], priority.config.exchangeArgs)
    })

    it('prioritize messages', async () => {
      const messages = Array.from({ length: 3 }).map((_, idx) => ({
        message: idx % 4,
        priority: idx % 4,
      }))

      const spy = sinon.spy(function listener(message, properties, actions, callback) {
        actions.ack()
        callback(null, performance.now())
      })

      const publish = Promise.all(messages.map(({ message, priority }) => {
        return publisher.publishAndWait('priority', message, { priority, confirm: true, timeout: 60000 })
      }))

      const consume = setTimeout(500).then(() => priority.createConsumedQueue(spy, ['priority'], {
        neck: 1,
        arguments: {
          'x-max-priority': 5,
        },
      }))

      const [data] = await Promise.all([publish, consume])

      data.forEach((micro, idx) => {
        if (data[idx + 1]) assert.ok(micro > data[idx + 1])
      })
    })
  })

  describe('double bind', function test() {
    let spy: sinon.SinonSpy
    let transport: AMQPTransport
    
    before('init transport', async () => {
      spy = sinon.spy(function responder(message, properties, actions, next) {
        next(null, { message, properties })
      })

      const opts = {
        connection: {
          ...configuration.connection,
          port: 5672,
          heartbeat: 2000,
        },
        exchange: 'test-topic',
        exchangeArgs: {
          autoDelete: false,
          type: 'topic',
        } as const,
        defaultQueueOpts: {
          autoDelete: false,
          exclusive: false,
        },
        queue: 'nom-nom',
        bindPersistantQueueToHeadersExchange: true,
        listen: ['direct-binding-key', 'test.mandatory'],
      }

      transport = await connect(opts, spy)
    })

    after('close transport', async () => {
      await transport.close()
    })

    it('delivers messages using headers', async () => {
      for (const routingKey of ['direct-binding-key', 'doesnt-exist']) {
        await transport.publish('', 'hi', {
          confirm: true,
          exchange: 'amq.match',
          headers: {
            'routing-key': routingKey,
          },
        })
      }

      await setTimeout(100)

      assert.ok(spy.calledOnce)
    })
  })

  describe('Consumers externally available', function suite() {
    let proxy: any
    let transport: AMQPTransport
    let spy: sinon.SinonSpy

    before('init transport', async () => {
      proxy = new Proxy(9010, RABBITMQ_PORT, RABBITMQ_HOST)
      transport = new AMQPTransport({
        connection: {
          port: 9010,
          heartbeat: 2000,
        },
        debug: true,
        exchange: 'test-direct',
        exchangeArgs: {
          autoDelete: false,
          type: 'direct',
        },
        defaultQueueOpts: {
          autoDelete: true,
          exclusive: true,
        },
      })

      await transport.connect()
      spy = sinon.spy(transport, 'closeAllConsumers')
    })

    after('close transport', async () => {
      spy.restore()
      await transport.close()
      await proxy.close()
    })

    function router(messageBody: any, properties: ExtendedMessageProperties, message: Message, next: ResponseHandler) {
      switch (properties.routingKey) {
        case '/':
          // #3 all right, try answer
          assert.deepEqual(messageBody, { foo: 'bar' })
          return next(null, { bar: 'baz' })
        default:
          throw new Error()
      }
    }

    it('`consumers` map filled', async () => {
      await transport.createConsumedQueue(router, ['/'])

      // @ts-expect-error private property
      const { _consumers } = transport

      assert.strictEqual(_consumers.size, 1)
      await transport.closeAllConsumers()

      assert.equal(_consumers.size, 0)
    })
  })

  describe('consumed queue', function test() {
    let proxy: any
    let transport: AMQPTransport

    before('init transport', async () => {
      proxy = new Proxy(9010, RABBITMQ_PORT, RABBITMQ_HOST)
      transport = new AMQPTransport({
        connection: {
          port: 9010,
          heartbeat: 2000,
        },
        debug: true,
        exchange: 'test-direct',
        exchangeArgs: {
          autoDelete: false,
          type: 'direct',
        },
        defaultQueueOpts: {
          autoDelete: true,
          exclusive: true,
        },
      })

      await transport.connect()
    })

    after('close transport', async () => {
      await transport?.close()
      await proxy?.close()
    })

    function router(messageBody: any, properties: ExtendedMessageProperties, message: Message, next: ResponseHandler) {
      switch (properties.routingKey) {
        case '/':
          // #3 all right, try answer
          assert.deepEqual(messageBody, { foo: 'bar' })
          return next(null, { bar: 'baz' })
        default:
          throw new Error(`invalid routing key - ${properties.routingKey}`)
      }
    }

    it('reestablishing consumed queue', async () => {
      const sample = { foo: 'bar' }
      const publish = () => transport.publishAndWait('/', sample, { confirm: true })

      let counter = 0
      const args: any[] = []
      transport.on('publish', (route, msg) => {
        if (route === '/') {
          args.push(msg)
          counter += 1
        } else {
          counter += 1
        }
      })

      const { queue, consumer } = await transport.createConsumedQueue(router, ['/'])

      await Promise.all([
        publish(),
        setTimeout(250).then(publish),
        setTimeout(300).then(() => proxy.interrupt(3000)),
        setTimeout(5000).then(publish),
      ])

      await Promise.all([consumer.close(), queue.delete()])

      transport.removeAllListeners('publish')
      assert.equal(counter, 6) // 3 requests, 3 responses
      for (const msg of args.values()) {
        assert.deepStrictEqual(msg, sample)
      }
    })

    it('should create consumed queue', async () => {
      let done: any
      let fail: any
      const promise = new Promise((resolve, reject) => {
        done = resolve
        fail = reject
      })

      const { queue } = await transport.createConsumedQueue(router)

      await transport.bindExchange(queue, '/')

      // #1 trigger error
      debug('called interrupt (1) in 20')
      proxy.interrupt(20)

      let attempt = 0
      transport.on('consumed-queue-reconnected', async () => {
        attempt += 1
        assert.equal(attempt, 1, 'must only trigger once')

        // #2 reconnected, try publish
        try {
          const message = await transport
            .publishAndWait('/', { foo: 'bar' }, { timeout: 500 })

          // #4 OK, try unbind
          assert.deepEqual(message, { bar: 'baz' })
          debug('unbind exchange from /', queue.queueOptions.queue)

          await transport.unbindExchange(queue, '/')

          // #5 unbound, let's reconnect
          transport.removeAllListeners('consumed-queue-reconnected')
          transport.on('consumed-queue-reconnected', async () => {
            debug('reconnected for the second time, publish must not succeed')

            // #7 reconnected again
            // dont wait for actual publish, if message comes router
            // will throw and crash the process
            transport.publish('/', { bar: 'foo' })

            // resolve only on second attempt after proxy interrupt
            await setTimeout(1000).then(done)
          })

          // #6 trigger error again
          await setTimeout(10)
          debug('called interrupt (2) in 20')
          proxy.interrupt(20)
        } catch (e) {
          debug('error for publish', e)
          fail(e)
        }
      })

      await promise
    })
  })

  describe('response headers', function test() {
    let proxy: any
    let transport: AMQPTransport

    before('init transport', async () => {
      proxy = new Proxy(9010, RABBITMQ_PORT, RABBITMQ_HOST)
      transport = new AMQPTransport({
        connection: {
          port: 9010,
          heartbeat: 2000,
        },
        debug: true,
        exchange: 'test-direct',
        exchangeArgs: {
          autoDelete: false,
          type: 'direct',
        },
        defaultQueueOpts: {
          autoDelete: true,
          exclusive: true,
        },
      })

      await transport.connect()
    })

    after('cleanup', async () => {
      await transport.close()
      await proxy.close()
    })

    const router = (messageBody: any, properties: ExtendedMessageProperties, raw: Message, next: ResponseHandler) => {
      const error = new Error('Error occured but at least you still have your headers')

      switch (properties.routingKey) {
        case '/include-headers':
          assert.deepEqual(messageBody, { foo: 'bar' })
          return next(null, { bar: 'baz' })

        case '/return-custom-header':
          assert.deepEqual(messageBody, { foo: 'bar' })
          raw.extendMessage(kReplyHeaders, { 'x-custom-header': 'custom-header-value' })
          return next(null, { bar: 'baz' })

        case '/return-headers-on-error':
          assert.deepEqual(messageBody, { foo: 'bar' })
          raw.extendMessage(kReplyHeaders, { 'x-custom-header': 'error-but-i-dont-care' })
          return next(error, null)

        default:
          throw new Error('invalid routing key')
      }
    }

    it('is able to return detailed response with headers', async () => {
      const sample = { foo: 'bar' }

      let counter = 0
      const args: any[] = []
      transport.on('publish', (route, msg) => {
        if (route === '/include-headers') {
          args.push(msg)
          counter += 1
        } else {
          counter += 1
        }
      })

      const { queue, consumer } = await transport.createConsumedQueue(router, ['/include-headers'])

      const response = await transport.publishAndWait('/include-headers', sample, {
        confirm: true,
        simpleResponse: false,
      })

      assert.deepEqual(
        response,
        {
          data: { bar: 'baz' },
          headers: { timeout: 10000 },
        }
      )

      await Promise.all([
        transport.closeAllConsumers(),
        queue.delete()
      ])

      transport.removeAllListeners('publish')
      assert.equal(counter, 2) // 1 requests, 1 responses
      for (const msg of args.values()) {
        assert.deepStrictEqual(msg, sample)
      }
    })

    it('is able to set custom reply headers', async () => {
      const sample = { foo: 'bar' }

      let counter = 0
      const args: any[] = []
      transport.on('publish', (route, msg) => {
        if (route === '/return-custom-header') {
          args.push(msg)
          counter += 1
        } else {
          counter += 1
        }
      })

      const { queue, consumer } = await transport.createConsumedQueue(router, ['/return-custom-header'])

      const response = await transport.publishAndWait('/return-custom-header', sample, {
        confirm: true,
        simpleResponse: false,
      })

      assert.deepEqual(
        response,
        {
          data: { bar: 'baz' },
          headers: { 'x-custom-header': 'custom-header-value', timeout: 10000 },
        }
      )

      await Promise.all([
        transport.closeAllConsumers(),
        queue.delete()
      ])

      transport.removeAllListeners('publish')
      assert.equal(counter, 2) // 1 requests, 1 responses
      for (const msg of args) {
        assert.deepStrictEqual(msg, sample)
      }
    })

    it('is able to return headers with error response', async () => {
      const sample = { foo: 'bar' }

      let counter = 0
      const args: any[] = []
      transport.on('publish', (route, msg) => {
        if (route === '/return-headers-on-error') {
          args.push(msg)
          counter += 1
        } else {
          counter += 1
        }
      })

      try {
        const { queue, consumer } = await transport.createConsumedQueue(router, ['/return-headers-on-error'])

        try {
          await transport.publishAndWait('/return-headers-on-error', sample, {
            confirm: true,
            simpleResponse: false,
          })
        } catch (error: any) {
          // here I should expect headers
          assert.strictEqual('Error occured but at least you still have your headers', error.message)
          assert.deepEqual({ 'x-custom-header': 'error-but-i-dont-care', timeout: 10000 }, error[kReplyHeaders])

          await Promise.all([
            transport.closeAllConsumers(),
            queue.delete()
          ])
        }
      } finally {
        transport.removeAllListeners('publish')
        assert.equal(counter, 2) // 1 requests, 1 responses
        for (const msg of args) {
          assert.deepStrictEqual(msg, sample)
        }
      }
    })
  })

  describe('autoConsumed + router + autoDeserialize = false', () => {
    let transport: AMQPTransport
    let publisher: AMQPTransport

    const queue = v4()
    const listen = v4()
    const bufutf8 = Buffer.from('a'.repeat(5000))

    let gzipped = 0
    let string = 0

    before('init transport', async () => {
      const router = async (body: Buffer | Error, m: Message): Promise<any> => {
        assert(Buffer.isBuffer(body))
        assert(Buffer.isBuffer(m.raw))
        assert(body.equals(m.raw))

        if (m.properties.contentEncoding === 'gzip') {
          (await gunzip(body)).equals(bufutf8)
          gzipped += 1
        } else {
          assert(body.equals(bufutf8), `body mismatch: ${body.toString()}`)
          string += 1
        }

        return { gzipped, string, tag: m.deliveryTag }
      }

      transport = await connect({
        connection: {
          host: RABBITMQ_HOST,
          port: RABBITMQ_PORT,
        },
        debug: true,
        exchange: 'test-direct',
        listen: [listen],
        queue,
        exchangeArgs: {
          autoDelete: false,
          type: 'direct',
        },
        defaultQueueOpts: {
          autoDelete: true,
          exclusive: true,
        },
        name: 'consumer'
      }, router, {
        autoDeserialize: false,
      })

      publisher = await connect({
        name: 'publisher',
        connection: {
          host: RABBITMQ_HOST,
          port: RABBITMQ_PORT,
        },
        debug: true,
        exchange: 'test-direct',
      })
    })

    after('cleanup', async () => {
      await transport.close()
      await publisher.close()
    })

    it('publish and read messages of different varieties', async () => {
      const bufutf8gzip = await gzip(bufutf8)

      await timesLimit(20, 500, async () => {
        return publisher.publishAndWait(listen, bufutf8, { timeout: 10000, gzip: false, skipSerialize: true })
      })

      await timesLimit(20, 500, async () => {
        return publisher.publishAndWait(listen, bufutf8gzip, { timeout: 10000, gzip: true, skipSerialize: true })
      })

      await timesLimit(20, 500, async () => {
        return publisher.publishAndWait(listen, bufutf8, { timeout: 10000, gzip: true })
      })

      assert.equal(gzipped, 0, 'gzip mismatch')
      assert.equal(string, 60, 'string mismatch')
    })
  })

  describe('high-load scenario', () => {
    let transport: AMQPTransport
    let publisher: AMQPTransport

    const queue = v4()
    const listen = v4()

    before('init transport', async () => {
      const max = 2000
      const router = async (body: any, m: Message): Promise<any> => {
        await setTimeout(Math.floor(Math.random() * (max + 1))) // up to 1 second
        return { body, tag: m.deliveryTag }
      }

      transport = await connect({
        connection: {
          host: RABBITMQ_HOST,
          port: RABBITMQ_PORT,
        },
        neck: 300,
        multiAckAfter: 5000,
        multiAckEvery: 150,
        debug: true,
        exchange: 'test-direct',
        listen: [listen],
        queue,
        exchangeArgs: {
          autoDelete: false,
          type: 'direct',
        },
        defaultQueueOpts: {
          autoDelete: true,
          exclusive: true,
        },
        name: 'consumer'
      }, router)

      publisher = await connect({
        name: 'publisher',
        debug: true,
        connection: {
          host: RABBITMQ_HOST,
          port: RABBITMQ_PORT,
        },
        privateQueueNeck: 250,
        exchange: 'test-direct',
      })
    })

    after('cleanup', async () => {
      await transport.close()
      await publisher.close()
    })

    it('test we can publish and retrieve tons of messages', async () => {
      await timesLimit(2974, 500, async (i: number) => {
        return publisher.publishAndWait(listen, { test: "message", n: i }, { timeout: 10000 })
      })

      // must have confirmed
      await setTimeout(4 * 1e3)

      const { queue: q } = await transport.createQueue({ queue, passive: true })
      const data = await q.declare()

      assert.equal(data.messageCount, 0)
      // eslint-disable-next-line no-console
      console.info(data)
    })
  })
})
