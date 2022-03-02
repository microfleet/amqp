const Promise = require('bluebird');
const Benchmark = require('benchmark');
const fmt = require('util').format;
const AMQPTransport = require('../lib');

const configuration = {
  exchange: 'test-exchange',
  connection: {
    host: process.env.RABBITMQ_PORT_5672_TCP_ADDR || 'localhost',
    port: process.env.RABBITMQ_PORT_5672_TCP_PORT || 5672,
  },
  defaultQueueOpts: {
    autoDelete: true,
    arguments: {
      'x-queue-mode': 'lazy',
    },
  },
  privateQueueOpts: {
    autoDelete: true,
    arguments: {
      'x-queue-mode': 'lazy',
    },
  },
};

// simple back-forth
function listener(message, headers, actions, callback) {
  callback(null, 'ok');
}

// opts for consumer
const opts = {
  ...configuration,
  queue: 'tq',
  listen: 'tq',
};

// publisher
const publisher = new AMQPTransport(configuration);
let messagesSent = 0;

Promise.join(
  AMQPTransport.connect(opts, listener),
  publisher.connect()
)
  .spread((consumer) => {
    const suite = new Benchmark.Suite('RabbitMQ');
    suite.add('Round-trip', {
      defer: true,
      fn: function test(deferred) {
        return publisher
          .publishAndWait('tq', 'tq')
          .finally(() => {
            messagesSent += 1;
            deferred.resolve();
          });
      },
    })
      .on('complete', function suiteCompleted() {
        const { stats } = this.filter('fastest')[0];
        const { times } = this.filter('fastest')[0];
        process.stdout.write(fmt('Messages sent: %s\n', messagesSent));
        process.stdout.write(fmt('Mean is %s ms ~ %s %\n', stats.mean * 1000, stats.rme));
        process.stdout.write(fmt('Total time is %s s %s s\n', times.elapsed, times.period));
        consumer.close();
        publisher.close();
      })
      .run({ async: false, defer: true });
  });
