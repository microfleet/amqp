import { pino } from 'pino'

// holy crap with stdout and good
const isTest = process.env.NODE_ENV === 'test'

export const PinoLogger = (name = '@microfleet/transport-amqp', settings: any = {}) => {
  const opts = {
    name,
    level: isTest ? 'debug' : 'info',
    ...settings,
  }

  return pino(opts, pino.destination(process.stdout.fd))
}
