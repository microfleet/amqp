const { create } = require('../transport-amqp/lib')
const { equal } = require("assert");

async function main() {
    const configuration = {
        exchange: 'test-exchange',
        connection: {
            host: "127.0.0.1",
            port: 15672,
        },
    }
    console.log("testing connection", configuration)
    // noinspection JSCheckFunctionSignatures
    /**
     * @var {AMQPTransport} amqp
     */
    let amqp
    const result = create(configuration)
    amqp = result[0]
    console.log(`amqp created`)
    await amqp.connect()
    console.log(`amqp connected`)
    // await amqp.publish(`users`, { foo: "bar" },  { confirm: true })
    // console.log(amqp.state)
}

main().catch(err => console.log(err))
