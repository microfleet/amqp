import assert = require('assert');
import { latency, toMiliseconds } from '../src/utils/latency'

describe('utils: latency', () => {
  it('displays latency in miliseconds', () => {
    const time = latency(process.hrtime())
    assert.ok(time < 0.1, `process.hrtime(process.hrtime()) takes more than 10 microseconds: ${time}`)
  })

  it('converts to miliseconds correctly with roundup to 3d digit', () => {
    // seconds
    // nanoseconds
    assert.equal(toMiliseconds([1, 1001000]), 1001.001)
  })
})
