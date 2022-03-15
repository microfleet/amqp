const { basename } = require('path')
const dir = basename(__dirname)

const root = `/src/packages/${dir}/node_modules/.bin`

module.exports = {
  ...require('../../.mdeprc.js'),
  node: "16",
  auto_compose: true,
  services: ['rabbitmq'],
  nycCoverage: false,
  nycReport: false,
  tests: "./test/*.spec.ts",
  test_framework: `c8 ${root}/mocha`,
  extras: {
    tester: {
      working_dir: `/src/packages/${dir}`,
      environment: {
        NODE_ENV: 'test',
        RABBITMQ_PORT_5672_TCP_ADDR: 'rabbitmq',
        SWC_NODE_PROJECT: './tsconfig.test.json'
      }
    }
  },
  root,
  rebuild: ["microtime"],
  pre: "rimraf ./coverage/tmp || true",
  post_exec: "pnpm exec -- c8 report -r text -r lcov"
}
