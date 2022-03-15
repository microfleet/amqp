import { pino } from 'pino'

// holy crap with stdout and good
const isProduction = process.env.NODE_ENV === 'production'

export const PinoLogger = (name = '@microfleet/transport-amqp', settings = {}) => {
  const opts = {
    name,
    level: isProduction ? 'info' : 'trace',
    ...settings,
  }

  return pino(opts, pino.destination(process.stdout.fd))
}
