import 'should'
import assert from 'node:assert/strict'
import { setTimeout } from 'node:timers/promises'
import { Connection as AMQP } from '../src'

describe('Exchange', () => {
  let amqp: AMQP

  beforeEach(async () => {
    amqp = new AMQP({ host: 'rabbitmq' })
    await amqp.connect()
  })

  afterEach(async () => {
    await amqp.close()
  })

  it('test it can declare a exchange', async () => {
    const exchange = await amqp.exchange({ exchange:"testsing" })
    await exchange.declare()
  })


  it('test it can declare a exchange using name', async () => {
    const exchange = await amqp.exchange({ name:"testsing" })
    await exchange.declare()
  })


  it('test it can declare a exchange with no options', async () => {    
    const exchange = await amqp.exchange({ exchange:"testsing" })
    await exchange.declare()
  })

  it('test it can fail declaring an exchange', async () => {
    // @ts-expect-error -- testing fail
    await assert.rejects(amqp.exchange({ idontbelong:"testsing" }))
  })

  it('test it can delete a exchange', async () => {
    
    const exchange = await amqp.exchange({exchange:"testsing"})
    await exchange.declare()
    await exchange.delete()
  })

  it('test it can declare a exchange exchange binding 5541', async () => {
    const exchange = await amqp.exchange({exchange:"exchone", autoDelete: false})
    await exchange.declare()


    const exch2 = await amqp.exchange({exchange:"exchtwo", autoDelete: false})
    await exch2.declare()

    await exch2.bind("exchone", "ee-routingkey")
    await exch2.unbind("exchone", "ee-routingkey")
    await exchange.delete()
    await exch2.delete()
  })

  it('test it can delete a exchange with no options', async () => {
    const exchange = await amqp.exchange({exchange:"testsing"})
    await exchange.declare()
    await exchange.delete()
  })


  it('test we can timeout a exchange channel and reopen it', async () => {
    const exchange = await amqp.exchange({exchange:"testsing"})
    await exchange.declare()

    amqp.channels.size.should.eql(2)
    await setTimeout(500)

    amqp.channels.size.should.eql(1)

    await exchange.declare()

    amqp.channels.size.should.eql(2)
  })
})
