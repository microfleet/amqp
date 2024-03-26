const { basename } = require('path')
const dir = basename(__dirname)

const root = `/src/packages/${dir}/node_modules/.bin`

module.exports = {
  ...require('../../.mdeprc.js'),
  node: "20",
  auto_compose: true,
  services: ["rabbitmq"],
  tests: "./test/**/*.test.{ts,coffee}",
  test_framework: `c8 ${root}/mocha`,
  pre: 'rimraf ./coverage/tmp',
  post_exec: 'pnpm exec -- c8 report -r text -r lcov',
  root,
  extras: {
    rabbitmq: {
      ports: ['15672']
    },
    tester: {
      working_dir: `/src/packages/${dir}`,
      environment: {
        AMQP_TEST: '1', // this must be enable to have low reconnection timer
        AMQP: '4',
        DEBUG: 'amqp:*',
        SWC_NODE_PROJECT: './tsconfig.test.json',
        NODE_NO_WARNINGS: '1',
      }
    }
  }
}
