// require("@swc-node/register");
// require("tsconfig-paths/register");
// require("coffeescript/register");
// require("source-map-support/register");

// docker exec into tester
// ./node_modules/.bin/clinic flame -- node ./src/service-transport.js

(async () => {
  const AMQP = require('@microfleet/transport-amqp');
  const { cpuUsage } = require('process');

  async function handleMessage(data, message) {
    return { bye: true }
  };

  const neck = 80
  const config = {
    exchange: 'bench.direct',
    queue: 'consume-test',
    listen: ['testing'],
    debug: true,
    name: 'bench-test',
    neck,
    exchangeArgs: {
      autoDelete: true,
      type: 'direct',
    },
    connection: {
      host: 'rabbitmq',
      port: 5672,
    },
  };

  console.log('asking to connect')

  const transport = await AMQP.connect(config, handleMessage);

  // do nothing
  let messages = 0;
  const ackEvery = (neck / 2)
  transport.on('after', (message) => {
    messages += 1
    if (messages % ackEvery === 0) {
      messages = 0
      message.multiAck()
    }
  })

  console.log('connected %s', process.pid)
})().catch((err) => {
  console.error(err);
  process.exit(128);
});
