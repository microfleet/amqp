module.exports = {
  node: "16",
  auto_compose: true,
  services: ["rabbitmq"],
  tests: "./test/**/*.test.coffee",
  test_framework: "c8 /src/node_modules/.bin/mocha",
  nycCoverage: false,
  nycReport: false,
  pre: 'rimraf ./coverage/tmp',
  post_exec: 'pnpm exec -- c8 report -r text -r lcov',
  extras: {
    tester: {
      environment: {
        AMQP_TEST: '1',
      }
    }
  }
}
