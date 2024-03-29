export type Constant = [number, string];

export interface Field {
  name: string;
  domain: string;
}

export interface Method {
  name: string;
  index: number;
  fields: Field[];
}

export interface Class {
  name: string;
  index: number;
  fields: Field[];
  methods: Method[];
}

export const constants: Constant[] = [
  [1, 'frameMethod'],
  [2, 'frameHeader'],
  [3, 'frameBody'],
  [8, 'frameHeartbeat'],
  [4096, 'frameMinSize'],
  [206, 'frameEnd'],
  [200, 'replySuccess'],
  [311, 'contentTooLarge'],
  [313, 'noConsumers'],
  [320, 'connectionForced'],
  [402, 'invalidPath'],
  [403, 'accessRefused'],
  [404, 'notFound'],
  [405, 'resourceLocked'],
  [406, 'preconditionFailed'],
  [501, 'frameError'],
  [502, 'syntaxError'],
  [503, 'commandInvalid'],
  [504, 'channelError'],
  [505, 'unexpectedFrame'],
  [506, 'resourceError'],
  [530, 'notAllowed'],
  [540, 'notImplemented'],
  [541, 'internalError'],
]

export const classes: Class[] = [
  {
    name: 'connection',
    index: 10,
    fields: [],
    methods: [
      {
        name: 'start',
        index: 10,
        fields: [
          { name: 'versionMajor', domain: 'octet' },
          { name: 'versionMinor', domain: 'octet' },
          { name: 'serverProperties', domain: 'table' },
          { name: 'mechanisms', domain: 'longstr' },
          { name: 'locales', domain: 'longstr' },
        ],
      },
      {
        name: 'startOk',
        index: 11,
        fields: [
          { name: 'clientProperties', domain: 'table' },
          { name: 'mechanism', domain: 'shortstr' },
          { name: 'response', domain: 'longstr' },
          { name: 'locale', domain: 'shortstr' },
        ],
      },
      {
        name: 'secure',
        index: 20,
        fields: [{ name: 'challenge', domain: 'longstr' }],
      },
      {
        name: 'secureOk',
        index: 21,
        fields: [{ name: 'response', domain: 'longstr' }],
      },
      {
        name: 'tune',
        index: 30,
        fields: [
          { name: 'channelMax', domain: 'short' },
          { name: 'frameMax', domain: 'long' },
          { name: 'heartbeat', domain: 'short' },
        ],
      },
      {
        name: 'tuneOk',
        index: 31,
        fields: [
          { name: 'channelMax', domain: 'short' },
          { name: 'frameMax', domain: 'long' },
          { name: 'heartbeat', domain: 'short' },
        ],
      },
      {
        name: 'open',
        index: 40,
        fields: [
          { name: 'virtualHost', domain: 'shortstr' },
          { name: 'reserved1', domain: 'shortstr' },
          { name: 'reserved2', domain: 'bit' },
        ],
      },
      {
        name: 'openOk',
        index: 41,
        fields: [{ name: 'reserved1', domain: 'shortstr' }],
      },
      {
        name: 'close',
        index: 50,
        fields: [
          { name: 'replyCode', domain: 'short' },
          { name: 'replyText', domain: 'shortstr' },
          { name: 'classId', domain: 'short' },
          { name: 'methodId', domain: 'short' },
        ],
      },
      { name: 'closeOk', index: 51, fields: [] },
      {
        name: 'blocked',
        index: 60,
        fields: [{ name: 'reason', domain: 'shortstr' }],
      },
      { name: 'unblocked', index: 61, fields: [] },
    ],
  },
  {
    name: 'channel',
    index: 20,
    fields: [],
    methods: [
      {
        name: 'open',
        index: 10,
        fields: [{ name: 'reserved1', domain: 'shortstr' }],
      },
      {
        name: 'openOk',
        index: 11,
        fields: [{ name: 'reserved1', domain: 'longstr' }],
      },
      { name: 'flow', index: 20, fields: [{ name: 'active', domain: 'bit' }] },
      {
        name: 'flowOk',
        index: 21,
        fields: [{ name: 'active', domain: 'bit' }],
      },
      {
        name: 'close',
        index: 40,
        fields: [
          { name: 'replyCode', domain: 'short' },
          { name: 'replyText', domain: 'shortstr' },
          { name: 'classId', domain: 'short' },
          { name: 'methodId', domain: 'short' },
        ],
      },
      { name: 'closeOk', index: 41, fields: [] },
    ],
  },
  {
    name: 'exchange',
    index: 40,
    fields: [],
    methods: [
      {
        name: 'declare',
        index: 10,
        fields: [
          { name: 'reserved1', domain: 'short' },
          { name: 'exchange', domain: 'shortstr' },
          { name: 'type', domain: 'shortstr' },
          { name: 'passive', domain: 'bit' },
          { name: 'durable', domain: 'bit' },
          { name: 'autoDelete', domain: 'bit' },
          { name: 'internal', domain: 'bit' },
          { name: 'noWait', domain: 'bit' },
          { name: 'arguments', domain: 'table' },
        ],
      },
      { name: 'declareOk', index: 11, fields: [] },
      {
        name: 'delete',
        index: 20,
        fields: [
          { name: 'reserved1', domain: 'short' },
          { name: 'exchange', domain: 'shortstr' },
          { name: 'ifUnused', domain: 'bit' },
          { name: 'noWait', domain: 'bit' },
        ],
      },
      { name: 'deleteOk', index: 21, fields: [] },
      {
        name: 'bind',
        index: 30,
        fields: [
          { name: 'reserved1', domain: 'short' },
          { name: 'destination', domain: 'shortstr' },
          { name: 'source', domain: 'shortstr' },
          { name: 'routingKey', domain: 'shortstr' },
          { name: 'noWait', domain: 'bit' },
          { name: 'arguments', domain: 'table' },
        ],
      },
      { name: 'bindOk', index: 31, fields: [] },
      {
        name: 'unbind',
        index: 40,
        fields: [
          { name: 'reserved1', domain: 'short' },
          { name: 'destination', domain: 'shortstr' },
          { name: 'source', domain: 'shortstr' },
          { name: 'routingKey', domain: 'shortstr' },
          { name: 'noWait', domain: 'bit' },
          { name: 'arguments', domain: 'table' },
        ],
      },
      { name: 'unbindOk', index: 51, fields: [] },
    ],
  },
  {
    name: 'queue',
    index: 50,
    fields: [],
    methods: [
      {
        name: 'declare',
        index: 10,
        fields: [
          { name: 'reserved1', domain: 'short' },
          { name: 'queue', domain: 'shortstr' },
          { name: 'passive', domain: 'bit' },
          { name: 'durable', domain: 'bit' },
          { name: 'exclusive', domain: 'bit' },
          { name: 'autoDelete', domain: 'bit' },
          { name: 'noWait', domain: 'bit' },
          { name: 'arguments', domain: 'table' },
        ],
      },
      {
        name: 'declareOk',
        index: 11,
        fields: [
          { name: 'queue', domain: 'shortstr' },
          { name: 'messageCount', domain: 'long' },
          { name: 'consumerCount', domain: 'long' },
        ],
      },
      {
        name: 'bind',
        index: 20,
        fields: [
          { name: 'reserved1', domain: 'short' },
          { name: 'queue', domain: 'shortstr' },
          { name: 'exchange', domain: 'shortstr' },
          { name: 'routingKey', domain: 'shortstr' },
          { name: 'noWait', domain: 'bit' },
          { name: 'arguments', domain: 'table' },
        ],
      },
      { name: 'bindOk', index: 21, fields: [] },
      {
        name: 'unbind',
        index: 50,
        fields: [
          { name: 'reserved1', domain: 'short' },
          { name: 'queue', domain: 'shortstr' },
          { name: 'exchange', domain: 'shortstr' },
          { name: 'routingKey', domain: 'shortstr' },
          { name: 'arguments', domain: 'table' },
        ],
      },
      { name: 'unbindOk', index: 51, fields: [] },
      {
        name: 'purge',
        index: 30,
        fields: [
          { name: 'reserved1', domain: 'short' },
          { name: 'queue', domain: 'shortstr' },
          { name: 'noWait', domain: 'bit' },
        ],
      },
      {
        name: 'purgeOk',
        index: 31,
        fields: [{ name: 'messageCount', domain: 'long' }],
      },
      {
        name: 'delete',
        index: 40,
        fields: [
          { name: 'reserved1', domain: 'short' },
          { name: 'queue', domain: 'shortstr' },
          { name: 'ifUnused', domain: 'bit' },
          { name: 'ifEmpty', domain: 'bit' },
          { name: 'noWait', domain: 'bit' },
        ],
      },
      {
        name: 'deleteOk',
        index: 41,
        fields: [{ name: 'messageCount', domain: 'long' }],
      },
    ],
  },
  {
    name: 'basic',
    index: 60,
    fields: [
      { name: 'contentType', domain: 'shortstr' },
      { name: 'contentEncoding', domain: 'shortstr' },
      { name: 'headers', domain: 'table' },
      { name: 'deliveryMode', domain: 'octet' },
      { name: 'priority', domain: 'octet' },
      { name: 'correlationId', domain: 'shortstr' },
      { name: 'replyTo', domain: 'shortstr' },
      { name: 'expiration', domain: 'shortstr' },
      { name: 'messageId', domain: 'shortstr' },
      { name: 'timestamp', domain: 'timestamp' },
      { name: 'type', domain: 'shortstr' },
      { name: 'userId', domain: 'shortstr' },
      { name: 'appId', domain: 'shortstr' },
      { name: 'reserved', domain: 'shortstr' },
    ],
    methods: [
      {
        name: 'qos',
        index: 10,
        fields: [
          { name: 'prefetchSize', domain: 'long' },
          { name: 'prefetchCount', domain: 'short' },
          { name: 'global', domain: 'bit' },
        ],
      },
      { name: 'qosOk', index: 11, fields: [] },
      {
        name: 'consume',
        index: 20,
        fields: [
          { name: 'reserved1', domain: 'short' },
          { name: 'queue', domain: 'shortstr' },
          { name: 'consumerTag', domain: 'shortstr' },
          { name: 'noLocal', domain: 'bit' },
          { name: 'noAck', domain: 'bit' },
          { name: 'exclusive', domain: 'bit' },
          { name: 'noWait', domain: 'bit' },
          { name: 'arguments', domain: 'table' },
        ],
      },
      {
        name: 'consumeOk',
        index: 21,
        fields: [{ name: 'consumerTag', domain: 'shortstr' }],
      },
      {
        name: 'cancel',
        index: 30,
        fields: [
          { name: 'consumerTag', domain: 'shortstr' },
          { name: 'noWait', domain: 'bit' },
        ],
      },
      {
        name: 'cancelOk',
        index: 31,
        fields: [{ name: 'consumerTag', domain: 'shortstr' }],
      },
      {
        name: 'publish',
        index: 40,
        fields: [
          { name: 'reserved1', domain: 'short' },
          { name: 'exchange', domain: 'shortstr' },
          { name: 'routingKey', domain: 'shortstr' },
          { name: 'mandatory', domain: 'bit' },
          { name: 'immediate', domain: 'bit' },
        ],
      },
      {
        name: 'return',
        index: 50,
        fields: [
          { name: 'replyCode', domain: 'short' },
          { name: 'replyText', domain: 'shortstr' },
          { name: 'exchange', domain: 'shortstr' },
          { name: 'routingKey', domain: 'shortstr' },
        ],
      },
      {
        name: 'deliver',
        index: 60,
        fields: [
          { name: 'consumerTag', domain: 'shortstr' },
          { name: 'deliveryTag', domain: 'longlong' },
          { name: 'redelivered', domain: 'bit' },
          { name: 'exchange', domain: 'shortstr' },
          { name: 'routingKey', domain: 'shortstr' },
        ],
      },
      {
        name: 'get',
        index: 70,
        fields: [
          { name: 'reserved1', domain: 'short' },
          { name: 'queue', domain: 'shortstr' },
          { name: 'noAck', domain: 'bit' },
        ],
      },
      {
        name: 'getOk',
        index: 71,
        fields: [
          { name: 'deliveryTag', domain: 'longlong' },
          { name: 'redelivered', domain: 'bit' },
          { name: 'exchange', domain: 'shortstr' },
          { name: 'routingKey', domain: 'shortstr' },
          { name: 'messageCount', domain: 'long' },
        ],
      },
      {
        name: 'getEmpty',
        index: 72,
        fields: [{ name: 'reserved1', domain: 'shortstr' }],
      },
      {
        name: 'ack',
        index: 80,
        fields: [
          { name: 'deliveryTag', domain: 'longlong' },
          { name: 'multiple', domain: 'bit' },
        ],
      },
      {
        name: 'reject',
        index: 90,
        fields: [
          { name: 'deliveryTag', domain: 'longlong' },
          { name: 'requeue', domain: 'bit' },
        ],
      },
      {
        name: 'recoverAsync',
        index: 100,
        fields: [{ name: 'requeue', domain: 'bit' }],
      },
      {
        name: 'recover',
        index: 110,
        fields: [{ name: 'requeue', domain: 'bit' }],
      },
      { name: 'recoverOk', index: 111, fields: [] },
      {
        name: 'nack',
        index: 120,
        fields: [
          { name: 'deliveryTag', domain: 'longlong' },
          { name: 'multiple', domain: 'bit' },
          { name: 'requeue', domain: 'bit' },
        ],
      },
    ],
  },
  {
    name: 'tx',
    index: 90,
    fields: [],
    methods: [
      { name: 'select', index: 10, fields: [] },
      { name: 'selectOk', index: 11, fields: [] },
      { name: 'commit', index: 20, fields: [] },
      { name: 'commitOk', index: 21, fields: [] },
      { name: 'rollback', index: 30, fields: [] },
      { name: 'rollbackOk', index: 31, fields: [] },
    ],
  },
  {
    name: 'confirm',
    index: 85,
    fields: [],
    methods: [
      {
        name: 'select',
        index: 10,
        fields: [{ name: 'noWait', domain: 'bit' }],
      },
      { name: 'selectOk', index: 11, fields: [] },
    ],
  },
]
