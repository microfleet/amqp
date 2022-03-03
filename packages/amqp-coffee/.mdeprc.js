const { basename } = require('path')
const dir = basename(__dirname)

const root = `/src/packages/${dir}/node_modules/.bin`

module.exports = {
  ...require('../../.mdeprc.js'),
  node: "16",
  auto_compose: true,
  services: ["rabbitmq"],
  tests: "./test/**/*.test.coffee",
  test_framework: `c8 ${root}/mocha`,
  nycCoverage: false,
  nycReport: false,
  pre: 'rimraf ./coverage/tmp',
  post_exec: 'pnpm exec -- c8 report -r text -r lcov',
  root,
  extras: {
    tester: {
      working_dir: `/src/packages/${dir}`,
      environment: {
        AMQP_TEST: '1',
        AMQP: '4',
        DEBUG: 'amqp:*',
      }
    }
  }
}
