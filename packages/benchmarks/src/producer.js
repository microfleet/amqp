'use strict';

const { once } = require('events');
const AMQP = require('@microfleet/amqp-coffee');
const async = require('async');
const { faker } = require('@faker-js/faker');
const { setTimeout } = require('timers/promises');

(async () => {

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

  await async.series([
    (next) => exchange.declare(next),
    (next) => queue.declare(next),
    (next) => queue.bind('bench.direct', 'testing', next),
  ])

  // prepare ammo
  const length = 10
  const ammo = Array.from({ length }).map(() => Buffer.from(faker.datatype.json()))
  const getRandom = () => ammo[Math.ceil(Math.random() * length) - 1]

  // publish as fast as we can
  await async.timesLimit(
    process.env.REQ || 1000, 
    process.env.RPS || 5,
    (_, next) => {
      amqp.publish('bench.direct', 'testing', getRandom(), {
        confirm: true,
        contentType: 'application/json',
      }, next)
    }
  )

  amqp.close()
})().catch(err => {
  console.error(err)
  process.exit(128)
})

