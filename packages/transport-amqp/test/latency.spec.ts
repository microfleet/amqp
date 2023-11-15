import assert = require('assert');
import { latency, toMiliseconds } from '../src/utils/latency'

describe('utils: latency', () => {
  it('displays latency in miliseconds', () => {
    const time = latency(Date.now())
    assert.ok(time < 0.1, `latency(performance.now()) takes more than 10 microseconds: ${time}`)
  })

  it('converts to miliseconds correctly with roundup to 3d digit', () => {
    // seconds
    // nanoseconds
    assert.equal(toMiliseconds([1, 1001000]), 1001.001)
  })
})
