module.exports = {
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc-node/jest'],
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@microfleet/(amqp-.*)$': '<rootDir>/packages/$1/src'
  }
}