/* eslint-disable @typescript-eslint/no-var-requires */
const Benchmark = require('benchmark')
const fmt = require('util').format
const { AMQPTransport, connect } = require('../lib')

// see packages/benchmarks
// do `docker-compose up -d` exec into tester, launch this
const configuration = {
  exchange: 'test-exchange',
  cache: 10000,
  connection: {
    host: process.env.RABBITMQ_PORT_5672_TCP_ADDR || 'rabbitmq',
    port: process.env.RABBITMQ_PORT_5672_TCP_PORT || 5672,
  },
  defaultQueueOpts: {
    autoDelete: true,
    arguments: {
      'x-queue-mode': 'default',
    },
  },
  privateQueueOpts: {
    autoDelete: true,
    arguments: {
      'x-queue-mode': 'default',
    },
  },
}

// simple back-forth
async function listener(data, raw) {
  return 'ok'
}

// opts for consumer
const opts = {
  ...configuration,
  queue: 'tq',
  listen: 'tq',
}

// publisher
const publisher = new AMQPTransport(configuration)
let messagesSent = 0

;(async () => {
  const [consumer] = await Promise.all([
    connect(opts, listener),
    publisher.connect()
  ])

  const suite = new Benchmark.Suite('RabbitMQ')
  
  suite
    .add('Round-trip: no cache', {
      defer: true,
      async: true,
      fn(deferred) {
        // dedupe calls
        publisher.publishAndWait('tq', { number: Math.ceil(Math.random() * 10000) }).then(() => {
          messagesSent += 1
          deferred.resolve()
        })
      },
    })
    .add('Round-trip: dedupe', {
      defer: true,
      async: true,
      fn(deferred) {
        // dedupe calls
        publisher.publishAndWait('tq', { number: Math.ceil(Math.random() * 10000) }, { cache: 0, reuse: true }).then(() => {
          messagesSent += 1
          deferred.resolve()
        })
      },
    })
    .add('Round-trip: cache', {
      defer: true,
      async: true,
      fn(deferred) {
        // dedupe calls
        publisher.publishAndWait('tq', { number: Math.ceil(Math.random() * 100000) }, { cache: 60e3, reuse: true }).then(() => {
          messagesSent += 1
          deferred.resolve()
        })
      },
    })
    // add listeners
    .on('cycle', function (event) {
      console.log(String(event.target));
    })
    .on('complete', function () {
      console.log('Fastest is ' + this.filter('fastest').map('name'));
    })
    .on('complete', function suiteCompleted() {
      const { stats } = this.filter('fastest')[0]
      const { times } = this.filter('fastest')[0]
      process.stdout.write(fmt('Messages sent: %s\n', messagesSent))
      process.stdout.write(fmt('Mean is %s ms ~ %s %\n', stats.mean * 1000, stats.rme))
      process.stdout.write(fmt('Total time is %s s %s s\n', times.elapsed, times.period))
      consumer.close()
      publisher.close()
    })
    .run({ defer: true })
})()
