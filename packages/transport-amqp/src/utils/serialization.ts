import is from 'is'
import flatstr from 'flatstr'
import stringify from 'json-stringify-safe'
import { ValidationError } from 'common-errors'
import { gunzip as _gunzip, gzip as _gzip, brotliCompress as _brotliCompress, brotliDecompress as _brotliDecompress } from 'node:zlib'
import { promisify } from 'util'
import { MessageProperties } from '@microfleet/amqp-coffee'

// generate internal error class for passing between amqp
export type SerializedError = {
  message: string
  name?: string
  code?: string | number
  errors?: SerializedError[]
  field?: string
  reason?: string
  stack?: string
}

const PARSE_ERR = new ValidationError('couldn\'t deserialize input', '500', 'message.raw')
const gunzip = promisify(_gunzip)
const gzip = promisify(_gzip)
const brotliCompress = promisify(_brotliCompress)
const brotliDecompress = promisify(_brotliDecompress)

// error data that is going to be copied
const copyErrorData = [
  'code',
  'name',
  'errors',
  'field',
  'reason',
] as const

export class MSError extends Error {
  public name = 'MSError'
  public code?: string
  public errors?: SerializedError[]
  public field?: string
  public reason?: string
  public stack!: string
  [key: string]: any

  constructor(message = '', stack?: string) {
    super(message)

    Error.captureStackTrace(this, MSError)
    if (stack) {
      this.stack = `${stack}\n${this.stack}`
    }
  }

  static from(originalError: SerializedError): MSError {
    const error = new MSError(originalError.message, originalError.stack)

    for (const fieldName of copyErrorData) {
      const mixedData = originalError[fieldName]
      if (mixedData !== undefined && mixedData !== null) {
        // @ts-expect-error - it cant narrow down type, its fine
        error[fieldName] = mixedData
      }
    }

    return error
  }

  static fromDeserialized(errProps: { key: string, value: any }[]): MSError {
    const err = new MSError()
    for (const { key, value } of errProps.values()) {
      if (key === 'stack') {
        err[key] = `${value}\n${err[key]}`
      } else {
        err[key] = value
      }
    }
    return err
  }
}

/**
 * Serializes Own Properties of Error
 * @param key
 */
function serializeOwnProperties(this: Record<string, any>, key: string) {
  return {
    key,
    value: this[key],
  }
}

/**
 * Make sure we can transfer errors via rabbitmq through toJSON() call
 * @param error
 */
function serializeError<
  T extends Record<string, any>
>(error: T): { type: 'ms-error', data: { key: string, value: any }[] } {
  // serialized output
  return {
    type: 'ms-error',
    data: Object
      .getOwnPropertyNames(error)
      .filter((prop) => typeof error[prop] !== 'function')
      .map(serializeOwnProperties, error),
  }
}

/**
 * Make sure we get a valid JS error
 * @param  error
 */
function deserializeError(error: { key: string, value: any }[]): InstanceType<typeof MSError> {
  return MSError.fromDeserialized(error)
}

/**
 * @param key
 * @param value
 */
export function jsonSerializer(_: string, value: any) {
  if (value instanceof Error) {
    return serializeError(value)
  }

  if (value && value.error instanceof Error) {
    value.error = serializeError(value.error)
  }

  if (value instanceof Map) {
    return { type: 'map', data: Object.fromEntries(value) }
  }

  if (value instanceof Set) {
    return { type: 'set', data: Array.from(value) }
  }

  return value
}

export function jsonDeserializer(_: string, value: any) {
  if (!is.object(value)) {
    return value
  }

  const { data } = value
  if (!data) {
    return value
  }

  const { type } = value
  switch (type) {
    case 'ms-error':
      return deserializeError(data)

    case 'Buffer':
    case 'buffer':
      return Buffer.from(data)

    case 'ms-set':
      return new Set(data)

    case 'ms-map':
      return new Map(Object.entries(data))

    default:
      return value
  }
}

/**
 *
 * @param {any} message
 * @param publishOptions
 */
export const serialize = (message: any, messageProperties: MessageProperties): Promise<Buffer> | Buffer => {
  const { contentType, contentEncoding } = messageProperties

  let serialized: Buffer
  if (!Buffer.isBuffer(message)) {
    switch (contentType) {
      case 'application/json':
      case 'string/utf8':
        serialized = Buffer.from(flatstr(stringify(message, jsonSerializer)), 'utf-8')
        break

      default:
        return Promise.reject(new Error('invalid content-type'))
    }
  } else {
    serialized = message
  }

  if (contentEncoding === 'gzip') {
    return gzip(serialized)
  } else if (contentEncoding === 'br') {
    return brotliCompress(serialized)
  }

  return serialized
}

const toUTF8 = (x: Buffer) => x.toString('utf8')
const toObj = (x: Buffer) => JSON.parse(x.toString('utf8'), jsonDeserializer)
/**
 * Parses AMQP message
 * @param  _data
 * @param  [contentType='application/json']
 * @param  [contentEncoding='plain']
 */
export const deserialize = (_data: Buffer, contentType = 'application/json', contentEncoding = 'plain'): any | Promise<any> => {
  let data: Promise<any> | null = null

  if (contentEncoding === 'gzip')  {
    data = gunzip(_data)
  } else if (contentEncoding === 'br') {
    data = brotliDecompress(_data)
  } else if (contentEncoding !== 'plain') {
    return Promise.reject(PARSE_ERR)
  }

  if (contentType === 'string/utf8') {
    // default encoding when we were pre-stringifying and sending str
    // and our updated encoding when we send buffer now
    return data !== null ? data.then(toUTF8) : toUTF8(_data)
  } else if (contentType === 'application/json') {
    return data !== null ? data.then(toObj) : toObj(_data)
  }
  
  return data !== null ? data : _data
}