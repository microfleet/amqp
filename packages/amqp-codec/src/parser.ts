import { Buffer } from 'buffer'
import {
  AMQPTypes,
  FrameType,
  INDICATOR_FRAME_END,
  kMissingFrame,
  kUnknownFrameType,
} from './constants'
import { FieldTypes } from './fixtures/typed-protocol'
import { 
  classes,
  isClassMethodId,
  isClassIndex,
  classMethodsTable,
  Protocol,
  MethodFrame,
  ContentHeader,
  Content,
  Heartbeat,
  Field,
} from './protocol'

export interface Configuration {
  handleResponse: HandleResponse;
}

export type ParsedResponse = Protocol | Error;
export type HandleResponse = (channel: number, datum: ParsedResponse) => void;

const HEADER_SIZE = 7
const FIELD_TYPE_SELECTOR = {
  bit(parser: Parser, buffer: Buffer, nextField?: Field): boolean {
    const value = (buffer[parser.offset] & (1 << parser.bitIndex))
      ? true
      : false

    if (nextField !== undefined && nextField.domain === FieldTypes.bit) {
      parser.bitIndex += 1
    } else {
      parser.bitIndex = 0
      parser.offset += 1
    }

    return value
  },
  octet: parseInt1,
  short: parseInt2,
  long: parseInt4,
  timestamp: parseInt8,
  longlong: parseInt8,
  shortstr: parseShortString,
  longstr: parseLongString,
  table: parseTable,
}
Object.setPrototypeOf(FIELD_TYPE_SELECTOR, null)

const TYPE_SELECTOR = {
  [AMQPTypes.STRING]: parseLongString,
  [AMQPTypes.INTEGER]: parseInt4,
  [AMQPTypes.TIME]: (parser: Parser, buffer: Buffer): Date => new Date(parseInt8(parser, buffer) * 1000),
  [AMQPTypes.HASH]: parseTable,
  [AMQPTypes.SIGNED_64BIT]: parseInt8,
  [AMQPTypes.BOOLEAN]: (parser: Parser, buffer: Buffer): boolean => parseInt1(parser, buffer) > 0,
  [AMQPTypes.DECIMAL](parser: Parser, buffer: Buffer): number {
    const dec = parseInt1(parser, buffer) * 10
    const num = parseInt4(parser, buffer)
    return num / dec
  },
  [AMQPTypes._64BIT_FLOAT](parser: Parser, buffer: Buffer): number {
    const offset = parser.offset
    const value = buffer.readDoubleBE(offset)
    parser.offset = offset + 8
    return value
  },
  [AMQPTypes._32BIT_FLOAT](parser: Parser, buffer: Buffer): number {
    const value = buffer.readFloatBE(parser.offset)
    parser.offset += 4
    return value
  },
  [AMQPTypes.BYTE_ARRAY](parser: Parser, buffer: Buffer): Buffer {
    const len = parseInt4(parser, buffer)
    const buf = Buffer.allocUnsafe(len)
    buffer.copy(buf, 0, parser.offset, parser.offset + len)
    parser.offset += len
    return buf
  },
  [AMQPTypes.ARRAY](parser: Parser, buffer: Buffer): unknown[] {
    const len = parseInt4(parser, buffer)
    const end = parser.offset + len
    const arr = []

    while (parser.offset < end) {
      arr.push(parseValue(parser, buffer))
    }

    return arr
  },
}
Object.setPrototypeOf(TYPE_SELECTOR, null)

function parseInt1(parser: Parser, buffer: Buffer): number {
  return buffer[parser.offset++]
}

function parseInt2(parser: Parser, buffer: Buffer): number {
  const offset = parser.offset
  parser.offset = offset + 2
  return (buffer[offset] << 8) + buffer[offset + 1]
}

function parseInt4(parser: Parser, buffer: Buffer): number {
  const offset = parser.offset
  parser.offset = offset + 4
  return (buffer[offset] << 24) + (buffer[offset + 1] << 16) +
         (buffer[offset + 2] << 8) + buffer[offset + 3]
}

function parseInt8(parser: Parser, buffer: Buffer): number {
  const offset = parser.offset
  parser.offset = offset + 8
  return (buffer[offset] << 56) + (buffer[offset + 1] << 48) +
         (buffer[offset + 2] << 40) + (buffer[offset + 3] << 32) +
         (buffer[offset + 4] << 24) + (buffer[offset + 5] << 16) +
         (buffer[offset + 6] << 8)  + buffer[offset + 7]
}

function parseShortString(parser: Parser, buffer: Buffer): string {
  const length = buffer[parser.offset++]
  const offset = parser.offset
  const nextOffset = offset + length
  const s = buffer.toString('utf8', offset, nextOffset)
  parser.offset = nextOffset
  return s
}

function parseLongString(parser: Parser, buffer: Buffer): string {
  const length = parseInt4(parser, buffer)
  const offset = parser.offset
  const nextOffset = offset + length
  const s = buffer.toString('utf8', offset, nextOffset)
  parser.offset = nextOffset
  return s
}

function parseValue(parser: Parser, buffer: Buffer): string | number | boolean | Buffer | Date | unknown[] | Record<string, unknown> {
  return TYPE_SELECTOR[buffer[parser.offset++]](parser, buffer)
}

function parseTable(parser: Parser, buffer: Buffer): Record<string, unknown> {
  const length = parseInt4(parser, buffer)
  const endOfTable = parser.offset + length - 4

  const entries = []
  while (parser.offset < endOfTable) {
    entries.push([
      parseShortString(parser, buffer),
      parseValue(parser, buffer)
    ])
  }

  return Object.fromEntries(entries)
}

function parseFields(parser: Parser, buffer: Buffer, fields: Field[]): Record<string, any> {
  const args = Object.create(null)

  // reset bit index
  parser.bitIndex = 0

  for (const [i, field] of fields.entries()) {
    args[field.name] = FIELD_TYPE_SELECTOR[field.domain](parser, buffer, fields[i + 1])
  }

  return args
}

function parseMethodFrame(parser: Parser, buffer: Buffer): MethodFrame | Error {
  const classId = parseInt2(parser, buffer)
  const methodId = parseInt2(parser, buffer)
  const classMethodId = `${classId}_${methodId}`

  if (!isClassMethodId(classMethodId)) {
    return new Error(`bad classId, methodId pair: ${classId}, ${methodId}`)
  }

  const method = classMethodsTable[classMethodId]
  const args = parseFields(parser, buffer, method.fields)

  // NOTE: name is only used for type narrowing in the code
  return { type: FrameType.METHOD, name: method.name, method, args } as MethodFrame
}

function parseHeaderFrame(parser: Parser, buffer: Buffer): ContentHeader | Error {
  const classIndex = parseInt2(parser, buffer)
  const weight = parseInt2(parser, buffer)
  const size = parseInt8(parser, buffer)

  if (!isClassIndex(classIndex)) {
    return new Error(`bad classId, methodId pair: ${classIndex}`)
  }

  const classInfo = classes[classIndex]
  const propertyFlags = parseInt2(parser, buffer)
  const fields: Field[] = []
  for (const [i, field] of classInfo.fields.entries()) {
    if ((i + 1) % 15 === 0) {
      parseInt2(parser, buffer)
    }

    if (propertyFlags & (1 << (15 - (i % 15)))) {
      fields.push(field)
    }
  }

  const properties = parseFields(parser, buffer, fields)
  return { type: FrameType.HEADER, classInfo, weight, properties, size }
}

function parseBodyFrame(parser: Parser, buffer: Buffer, frameSize: number): Content {
  const frameEnd = parser.offset + frameSize
  const data = buffer.slice(parser.offset, frameEnd)
  parser.offset = frameEnd
  return { type: FrameType.BODY, data }
}

function parseHeartbeatFrame(): Heartbeat {
  return { type: FrameType.HEARTBEAT }
}

/**
 * Called the appropriate parser for the specified type.
 */
function parseType(parser: Parser, buffer: Buffer, type: FrameType, frameSize: number): Protocol | Error {
  switch (type) {
    case FrameType.METHOD: return parseMethodFrame(parser, buffer)
    case FrameType.HEADER: return parseHeaderFrame(parser, buffer)
    case FrameType.BODY: return parseBodyFrame(parser, buffer, frameSize)
    case FrameType.HEARTBEAT: return parseHeartbeatFrame()
    default: return new Error(kUnknownFrameType)
  }
}

export class Parser {
  public offset = 0
  public buffer: Buffer | null = null
  public bitIndex = 0
  private handleResponse: HandleResponse

  constructor(options: Configuration) {
    if (!options) {
      throw new TypeError('Options are mandatory.')
    }

    if (typeof options.handleResponse !== 'function') {
      throw new TypeError('options.handleResponse must be defined')
    }

    this.handleResponse = options.handleResponse
    this.execute = this.execute.bind(this)
    this.processChunk = this.processChunk.bind(this)
  }

  /**
   * Make sure it is possible to reset data we are getting
   */
  public reset(): void {
    this.offset = 0
    this.bitIndex = 0
    this.buffer = null
  }

  /**
   * Handling data chunks
   * @param buffer
   * @returns 
   */
  public processChunk(buffer: Buffer): number | undefined {
    if (this.buffer === null) {
      this.buffer = buffer
      this.offset = 0
    } else {
      // if we already have some sort of buffer -> create a new buffer
      // with unused data from old one & new data
      const oldLength = this.buffer.length
      const remainingLength = oldLength - this.offset
      const newBuffer = Buffer.allocUnsafe(remainingLength + buffer.length)
      this.buffer.copy(newBuffer, 0, this.offset, oldLength)
      buffer.copy(newBuffer, remainingLength, 0, buffer.length)
      this.buffer = newBuffer
      this.offset = 0
    }

    // ensure that we have at least 8 bytes to read in the buffer
    // so that there is a chance we can parse a complete header + frame
    if (this.offset + HEADER_SIZE >= this.buffer.length) {
      return undefined
    }

    while (this.offset < this.buffer.length) {
      const offset = this.offset

      // Header
      const frameType = parseInt1(this, this.buffer)
      const frameChannel = parseInt2(this, this.buffer)
      const frameSize = parseInt4(this, this.buffer)

      // verify that we had collected enough data to parse the whole frame
      // we need to have FRAME_SIZE (dynamic) + FRAME_END (1 byte)
      // that is why its > and not just >=
      if (this.offset + frameSize > this.buffer.length) {
        this.offset = offset
        return frameSize - (this.buffer.length - 7 - this.offset)
      }

      // Frame
      const response = parseType(this, this.buffer, frameType, frameSize)

      // NOTE: probably not a good idea to crash the process, rather do an error emit
      // Verify that we've correctly parsed everything
      if (this.buffer[this.offset++] !== INDICATOR_FRAME_END) {
        this.offset = 0 // reset offset
        process.nextTick(this.handleResponse, frameChannel, kMissingFrame)
      } else {
        // pass the response on to the client library
        process.nextTick(this.handleResponse, frameChannel, response)
      }
    }

    // once we've parsed the buffer completely -> remove ref to it
    this.buffer = null
    return undefined
  }

  /**
   * Parse the redis buffer
   *
   * Data flows in the following fashion:
   *  |-------------------------------|-----------|
   *  | frameType [1 byte]            |           |
   *  | frameChannel [2 bytes]        |   Header  |
   *  | frameSize [4 bytes]           |           |
   *  |-------------------------------|-----------|
   *  | Frame - <frameSize> bytes     |   Frame   |
   *  |-------------------------------|-----------|
   *  | FrameEnd - 1 byte [206]       |    End    |
   *  --------------------------------------------|
   */
  public execute(readbleStream: NodeJS.ReadStream): void {
    // There is some data to read now.
    let data
    let size: number | undefined = undefined
    while ((data = readbleStream.read(size)) !== null) {
      size = this.processChunk(data)
    }
  }
}
