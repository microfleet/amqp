const { performance } = require('node:perf_hooks')
const Benchmark = require('benchmark');

const suite = new Benchmark.Suite;

// add tests
suite
  .add('Date.now', function () {
    return Date.now()
  })
  .add('performance.now', function () {
    return performance.now()
  })
  // add listeners
  .on('cycle', function (event) {
    console.log(String(event.target));
  })
  .on('complete', function () {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
  })
  // run async
  .run({ 'async': true });
