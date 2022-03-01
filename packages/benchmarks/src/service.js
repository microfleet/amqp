'use strict';

// require("@swc-node/register");
// require("tsconfig-paths/register");
// require("coffeescript/register");
// require("source-map-support/register");

(async () => {
  const { once } = require('events');
  const AMQP = require('@microfleet/amqp-coffee');
  const async = require('async');

  const amqp = new AMQP({ host: process.env.RABBITMQ_HOST || 'rabbitmq' })
  await once(amqp, 'ready')

  const exchange = amqp.exchange({
    exchange: 'bench.direct',
    type: 'direct',
    autoDelete: false,
  })

  const queue = amqp.queue({
    queue: 'consume-test',
    exchange: 'bench.direct',
    autoDelete: false,
    arguments: {
      'x-message-ttl': 1000
    },
  })

  let received = 0;
  const consumer = (message) => {
    received += 1;
    if (received % 50 === 0) {
      consumerC.multiAck(message.deliveryTag)
    }
  }

  let consumerC
  await async.series([
    (next) => exchange.declare(next),
    (next) => queue.declare(next),
    (next) => queue.bind('bench.direct', 'testing', next),
    (next) => consumerC = amqp.consume('consume-test', { prefetchCount: 100 }, consumer, next)
  ])
})().catch(err => {
  console.error(err)
  process.exit(128)
})

