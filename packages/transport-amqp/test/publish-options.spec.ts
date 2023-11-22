import assert from 'node:assert'
import { NormalizedPublishProperties, publishOptionsFactory } from '../src/utils/publish-options'
import { DefaultPublishOptions } from '../src/schema'

describe('utils: publishOptions', () => {
  let options: NormalizedPublishProperties

  const baseDefaults: DefaultPublishOptions = {
    exchange: 'node-service',
    deliveryMode: 1,
    confirm: false,
    mandatory: false,
    immediate: false,
    contentType: 'application/json',
    contentEncoding: 'plain',
    headers: {},
    simpleResponse: true,
    priority: 0,
    cache: -1,
    gzip: false,
    skipSerialize: false,
    appId: '{"id":"best-app"}',
    timeout: -1,
  }

  beforeEach(() => {
    options = publishOptionsFactory.get()
  })

  it('exchange is correctly overwritten set when present in options & default options', () => {
    options.setDefaultOpts(baseDefaults)

    // doesn't pick it up from default opts
    assert.equal(options.messageProperties.exchange, '')

    options.setOptions('node-service', '', undefined)

    assert.equal(options.messageProperties.exchange, 'node-service')

    options.setOptions('node-service', '', {
      exchange: 'amq.direct'
    })

    assert.equal(options.messageProperties.exchange, 'amq.direct')
  })

  afterEach(() => {
    options.release()
  })
})
