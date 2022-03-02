// require("@swc-node/register");
// require("tsconfig-paths/register");
// require("coffeescript/register");
// require("source-map-support/register");

(async () => {
  const AMQP = require('@microfleet/transport-amqp');

  const handleMessage = (data, properties, message, reply) => {
    // do nothing
    message.ack();
    reply(null);
  };

  const config = {
    exchange: 'bench.direct',
    queue: 'consume-test',
    listen: ['testing'],
    neck: 100,
    exchangeArgs: {
      autoDelete: true,
      type: 'direct',
    },
    connection: {
      host: 'rabbitmq',
      port: 5672,
    },
  };

  await AMQP.connect(config, handleMessage);
})().catch((err) => {
  console.error(err);
  process.exit(128);
});
