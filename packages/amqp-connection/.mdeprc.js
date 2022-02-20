module.exports = {
  node: '16',
  auto_compose: true,
  services: ['rabbitmq'],
  test_framework: 'jest',
  in_one: true,
  tests: './__tests__/**.spec.ts'
}