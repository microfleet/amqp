import { AMQPTransport, connect } from '../lib/index.js'
import { HttpStatusError } from 'common-errors'
import { timesLimit } from 'async'

const RABBITMQ_HOST = process.env.RABBITMQ_PORT_5672_TCP_ADDR || 'localhost'
const RABBITMQ_PORT = +(process.env.RABBITMQ_PORT_5672_TCP_PORT || 5672)

const configuration = {
  exchange: 'test-exchange',
  connection: {
    host: RABBITMQ_HOST,
    port: RABBITMQ_PORT,
  },
}

let requests = 0
let baselineMemoryUsage = process.memoryUsage()

const cached = new AMQPTransport({
  ...configuration,
  debug: true,
  cache: 1000,
})
await cached.connect()

const opts = {
  cache: 2000,
  debug: true,
  exchange: configuration.exchange,
  queue: 'test-queue-consumer-cached',
  listen: ['cached.test.default', 'cached.test.throw'],
  connection: configuration.connection,
}

const formatMemoryUsage = (data) => `${Math.round(data / 1024 / 1024 * 100) / 100} MB`

const cachedConsumer = await connect(opts, async (message, raw) => {
  requests += 1

  if (requests % 10000 === 0) {
    const memoryData = process.memoryUsage()
    const memoryUsage = {
      rss: `${formatMemoryUsage(memoryData.rss - baselineMemoryUsage.rss)}`, // Resident Set Size - total memory allocated for the process execution
      heapTotal: `${formatMemoryUsage(memoryData.heapTotal - baselineMemoryUsage.heapTotal)}`, // total size of the allocated heap
      heapUsed: `${formatMemoryUsage(memoryData.heapUsed - baselineMemoryUsage.heapUsed)}`, // actual memory used during the execution
      external: `${formatMemoryUsage(memoryData.external - baselineMemoryUsage.external)}`, // V8 external memory
    }
    cachedConsumer.log.info({ memoryUsage }, 'processed %d requests', requests)
  }

  if (raw.routingKey === 'cached.test.throw') {
    throw new HttpStatusError(202, 'ok')
  }

  return {
    resp: typeof message === 'object' ? message : `${message}-response`,
    time: performance.now()
  }
})

baselineMemoryUsage = process.memoryUsage()
const req = 10e6
await timesLimit(req, 2000, async (i) => {
  return cached.publishAndWait('cached.test.default', i % 300, { cache: 0 })
})

await cached.close()
await cachedConsumer.close()
