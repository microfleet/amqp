/* eslint-disable semi */
export const enum FrameType {
    METHOD = 1,
    HEADER = 2,
    BODY = 3,
    HEARTBEAT = 8
}
export type FieldTypeEquality = {
    [FieldTypes.bit]: boolean;
    [FieldTypes.long]: number;
    [FieldTypes.longlong]: number;
    [FieldTypes.longstr]: string | Record<string, any>;
    [FieldTypes.octet]: number;
    [FieldTypes.short]: number;
    [FieldTypes.shortstr]: string;
    [FieldTypes.table]: Record<string, any>;
    [FieldTypes.timestamp]: Date;
};
export const enum FieldTypes {
    octet = "octet",
    table = "table",
    longstr = "longstr",
    shortstr = "shortstr",
    short = "short",
    long = "long",
    bit = "bit",
    timestamp = "timestamp",
    longlong = "longlong"
}
export const enum FieldNames {
    versionMajor = "versionMajor",
    versionMinor = "versionMinor",
    serverProperties = "serverProperties",
    mechanisms = "mechanisms",
    locales = "locales",
    clientProperties = "clientProperties",
    mechanism = "mechanism",
    response = "response",
    locale = "locale",
    challenge = "challenge",
    channelMax = "channelMax",
    frameMax = "frameMax",
    heartbeat = "heartbeat",
    virtualHost = "virtualHost",
    reserved1 = "reserved1",
    reserved2 = "reserved2",
    replyCode = "replyCode",
    replyText = "replyText",
    classId = "classId",
    methodId = "methodId",
    reason = "reason",
    active = "active",
    exchange = "exchange",
    type = "type",
    passive = "passive",
    durable = "durable",
    autoDelete = "autoDelete",
    internal = "internal",
    noWait = "noWait",
    arguments = "arguments",
    ifUnused = "ifUnused",
    destination = "destination",
    source = "source",
    routingKey = "routingKey",
    queue = "queue",
    exclusive = "exclusive",
    messageCount = "messageCount",
    consumerCount = "consumerCount",
    ifEmpty = "ifEmpty",
    contentType = "contentType",
    contentEncoding = "contentEncoding",
    headers = "headers",
    deliveryMode = "deliveryMode",
    priority = "priority",
    correlationId = "correlationId",
    replyTo = "replyTo",
    expiration = "expiration",
    messageId = "messageId",
    timestamp = "timestamp",
    userId = "userId",
    appId = "appId",
    reserved = "reserved",
    prefetchSize = "prefetchSize",
    prefetchCount = "prefetchCount",
    global = "global",
    consumerTag = "consumerTag",
    noLocal = "noLocal",
    noAck = "noAck",
    mandatory = "mandatory",
    immediate = "immediate",
    deliveryTag = "deliveryTag",
    redelivered = "redelivered",
    multiple = "multiple",
    requeue = "requeue"
}
export type MethodNames = "connectionStart" | "connectionStartOk" | "connectionSecure" | "connectionSecureOk" | "connectionTune" | "connectionTuneOk" | "connectionOpen" | "connectionOpenOk" | "connectionClose" | "connectionCloseOk" | "connectionBlocked" | "connectionUnblocked" | "channelOpen" | "channelOpenOk" | "channelFlow" | "channelFlowOk" | "channelClose" | "channelCloseOk" | "exchangeDeclare" | "exchangeDeclareOk" | "exchangeDelete" | "exchangeDeleteOk" | "exchangeBind" | "exchangeBindOk" | "exchangeUnbind" | "exchangeUnbindOk" | "queueDeclare" | "queueDeclareOk" | "queueBind" | "queueBindOk" | "queueUnbind" | "queueUnbindOk" | "queuePurge" | "queuePurgeOk" | "queueDelete" | "queueDeleteOk" | "basicQos" | "basicQosOk" | "basicConsume" | "basicConsumeOk" | "basicCancel" | "basicCancelOk" | "basicPublish" | "basicReturn" | "basicDeliver" | "basicGet" | "basicGetOk" | "basicGetEmpty" | "basicAck" | "basicReject" | "basicRecoverAsync" | "basicRecover" | "basicRecoverOk" | "basicNack" | "txSelect" | "txSelectOk" | "txCommit" | "txCommitOk" | "txRollback" | "txRollbackOk" | "confirmSelect" | "confirmSelectOk";
export const enum ClassNames {
    connection = "connection",
    channel = "channel",
    exchange = "exchange",
    queue = "queue",
    basic = "basic",
    tx = "tx",
    confirm = "confirm"
}
export const enum ClassIds {
    connection = 10,
    channel = 20,
    exchange = 40,
    queue = 50,
    basic = 60,
    tx = 90,
    confirm = 85
}
export type ClassMethodIds = "10_10" | "10_11" | "10_20" | "10_21" | "10_30" | "10_31" | "10_40" | "10_41" | "10_50" | "10_51" | "10_60" | "10_61" | "20_10" | "20_11" | "20_20" | "20_21" | "20_40" | "20_41" | "40_10" | "40_11" | "40_20" | "40_21" | "40_30" | "40_31" | "40_40" | "40_51" | "50_10" | "50_11" | "50_20" | "50_21" | "50_50" | "50_51" | "50_30" | "50_31" | "50_40" | "50_41" | "60_10" | "60_11" | "60_20" | "60_21" | "60_30" | "60_31" | "60_40" | "60_50" | "60_60" | "60_70" | "60_71" | "60_72" | "60_80" | "60_90" | "60_100" | "60_110" | "60_111" | "60_120" | "90_10" | "90_11" | "90_20" | "90_21" | "90_30" | "90_31" | "85_10" | "85_11";
export type Field = {
    name: FieldNames;
    domain: FieldTypes;
};
export type MethodArgTypes = {
    "connectionStart": {
        [FieldNames.versionMajor]: number;
        [FieldNames.versionMinor]: number;
        [FieldNames.serverProperties]: Record<string, any>;
        [FieldNames.mechanisms]: string | Record<string, any>;
        [FieldNames.locales]: string | Record<string, any>;
    };
    "connectionStartOk": {
        [FieldNames.clientProperties]: Record<string, any>;
        [FieldNames.mechanism]: string;
        [FieldNames.response]: string | Record<string, any>;
        [FieldNames.locale]: string;
    };
    "connectionSecure": {
        [FieldNames.challenge]: string | Record<string, any>;
    };
    "connectionSecureOk": {
        [FieldNames.response]: string | Record<string, any>;
    };
    "connectionTune": {
        [FieldNames.channelMax]: number;
        [FieldNames.frameMax]: number;
        [FieldNames.heartbeat]: number;
    };
    "connectionTuneOk": {
        [FieldNames.channelMax]: number;
        [FieldNames.frameMax]: number;
        [FieldNames.heartbeat]: number;
    };
    "connectionOpen": {
        [FieldNames.virtualHost]: string;
        [FieldNames.reserved1]?: string;
        [FieldNames.reserved2]?: boolean;
    };
    "connectionOpenOk"?: {
        [FieldNames.reserved1]?: string;
    };
    "connectionClose": {
        [FieldNames.replyCode]: number;
        [FieldNames.replyText]: string;
        [FieldNames.classId]: number;
        [FieldNames.methodId]: number;
    };
    "connectionCloseOk"?: Record<string, never>;
    "connectionBlocked": {
        [FieldNames.reason]: string;
    };
    "connectionUnblocked"?: Record<string, never>;
    "channelOpen"?: {
        [FieldNames.reserved1]?: string;
    };
    "channelOpenOk"?: {
        [FieldNames.reserved1]?: string | Record<string, any>;
    };
    "channelFlow": {
        [FieldNames.active]: boolean;
    };
    "channelFlowOk": {
        [FieldNames.active]: boolean;
    };
    "channelClose": {
        [FieldNames.replyCode]: number;
        [FieldNames.replyText]: string;
        [FieldNames.classId]: number;
        [FieldNames.methodId]: number;
    };
    "channelCloseOk"?: Record<string, never>;
    "exchangeDeclare": {
        [FieldNames.reserved1]?: number;
        [FieldNames.exchange]: string;
        [FieldNames.type]: string;
        [FieldNames.passive]: boolean;
        [FieldNames.durable]: boolean;
        [FieldNames.autoDelete]: boolean;
        [FieldNames.internal]: boolean;
        [FieldNames.noWait]?: boolean;
        [FieldNames.arguments]: Record<string, any>;
    };
    "exchangeDeclareOk"?: Record<string, never>;
    "exchangeDelete": {
        [FieldNames.reserved1]?: number;
        [FieldNames.exchange]: string;
        [FieldNames.ifUnused]: boolean;
        [FieldNames.noWait]?: boolean;
    };
    "exchangeDeleteOk"?: Record<string, never>;
    "exchangeBind": {
        [FieldNames.reserved1]?: number;
        [FieldNames.destination]: string;
        [FieldNames.source]: string;
        [FieldNames.routingKey]: string;
        [FieldNames.noWait]?: boolean;
        [FieldNames.arguments]: Record<string, any>;
    };
    "exchangeBindOk"?: Record<string, never>;
    "exchangeUnbind": {
        [FieldNames.reserved1]?: number;
        [FieldNames.destination]: string;
        [FieldNames.source]: string;
        [FieldNames.routingKey]: string;
        [FieldNames.noWait]?: boolean;
        [FieldNames.arguments]: Record<string, any>;
    };
    "exchangeUnbindOk"?: Record<string, never>;
    "queueDeclare": {
        [FieldNames.reserved1]?: number;
        [FieldNames.queue]: string;
        [FieldNames.passive]: boolean;
        [FieldNames.durable]: boolean;
        [FieldNames.exclusive]: boolean;
        [FieldNames.autoDelete]: boolean;
        [FieldNames.noWait]?: boolean;
        [FieldNames.arguments]: Record<string, any>;
    };
    "queueDeclareOk": {
        [FieldNames.queue]: string;
        [FieldNames.messageCount]: number;
        [FieldNames.consumerCount]: number;
    };
    "queueBind": {
        [FieldNames.reserved1]?: number;
        [FieldNames.queue]: string;
        [FieldNames.exchange]: string;
        [FieldNames.routingKey]: string;
        [FieldNames.noWait]?: boolean;
        [FieldNames.arguments]: Record<string, any>;
    };
    "queueBindOk"?: Record<string, never>;
    "queueUnbind": {
        [FieldNames.reserved1]?: number;
        [FieldNames.queue]: string;
        [FieldNames.exchange]: string;
        [FieldNames.routingKey]: string;
        [FieldNames.arguments]: Record<string, any>;
    };
    "queueUnbindOk"?: Record<string, never>;
    "queuePurge": {
        [FieldNames.reserved1]?: number;
        [FieldNames.queue]: string;
        [FieldNames.noWait]?: boolean;
    };
    "queuePurgeOk": {
        [FieldNames.messageCount]: number;
    };
    "queueDelete": {
        [FieldNames.reserved1]?: number;
        [FieldNames.queue]: string;
        [FieldNames.ifUnused]: boolean;
        [FieldNames.ifEmpty]: boolean;
        [FieldNames.noWait]?: boolean;
    };
    "queueDeleteOk": {
        [FieldNames.messageCount]: number;
    };
    "basicQos": {
        [FieldNames.prefetchSize]: number;
        [FieldNames.prefetchCount]: number;
        [FieldNames.global]: boolean;
    };
    "basicQosOk"?: Record<string, never>;
    "basicConsume": {
        [FieldNames.reserved1]?: number;
        [FieldNames.queue]: string;
        [FieldNames.consumerTag]: string;
        [FieldNames.noLocal]: boolean;
        [FieldNames.noAck]: boolean;
        [FieldNames.exclusive]: boolean;
        [FieldNames.noWait]?: boolean;
        [FieldNames.arguments]: Record<string, any>;
    };
    "basicConsumeOk": {
        [FieldNames.consumerTag]: string;
    };
    "basicCancel": {
        [FieldNames.consumerTag]: string;
        [FieldNames.noWait]?: boolean;
    };
    "basicCancelOk": {
        [FieldNames.consumerTag]: string;
    };
    "basicPublish": {
        [FieldNames.reserved1]?: number;
        [FieldNames.exchange]: string;
        [FieldNames.routingKey]: string;
        [FieldNames.mandatory]: boolean;
        [FieldNames.immediate]: boolean;
    };
    "basicReturn": {
        [FieldNames.replyCode]: number;
        [FieldNames.replyText]: string;
        [FieldNames.exchange]: string;
        [FieldNames.routingKey]: string;
    };
    "basicDeliver": {
        [FieldNames.consumerTag]: string;
        [FieldNames.deliveryTag]: number;
        [FieldNames.redelivered]: boolean;
        [FieldNames.exchange]: string;
        [FieldNames.routingKey]: string;
    };
    "basicGet": {
        [FieldNames.reserved1]?: number;
        [FieldNames.queue]: string;
        [FieldNames.noAck]: boolean;
    };
    "basicGetOk": {
        [FieldNames.deliveryTag]: number;
        [FieldNames.redelivered]: boolean;
        [FieldNames.exchange]: string;
        [FieldNames.routingKey]: string;
        [FieldNames.messageCount]: number;
    };
    "basicGetEmpty"?: {
        [FieldNames.reserved1]?: string;
    };
    "basicAck": {
        [FieldNames.deliveryTag]: number;
        [FieldNames.multiple]: boolean;
    };
    "basicReject": {
        [FieldNames.deliveryTag]: number;
        [FieldNames.requeue]: boolean;
    };
    "basicRecoverAsync": {
        [FieldNames.requeue]: boolean;
    };
    "basicRecover": {
        [FieldNames.requeue]: boolean;
    };
    "basicRecoverOk"?: Record<string, never>;
    "basicNack": {
        [FieldNames.deliveryTag]: number;
        [FieldNames.multiple]: boolean;
        [FieldNames.requeue]: boolean;
    };
    "txSelect"?: Record<string, never>;
    "txSelectOk"?: Record<string, never>;
    "txCommit"?: Record<string, never>;
    "txCommitOk"?: Record<string, never>;
    "txRollback"?: Record<string, never>;
    "txRollbackOk"?: Record<string, never>;
    "confirmSelect"?: {
        [FieldNames.noWait]?: boolean;
    };
    "confirmSelectOk"?: Record<string, never>;
};
export type connectionStart = {
    name: "connectionStart";
    classIndex: ClassIds.connection;
    methodIndex: 10;
    fields: [
        {
            name: FieldNames.versionMajor;
            domain: FieldTypes.octet;
        },
        {
            name: FieldNames.versionMinor;
            domain: FieldTypes.octet;
        },
        {
            name: FieldNames.serverProperties;
            domain: FieldTypes.table;
        },
        {
            name: FieldNames.mechanisms;
            domain: FieldTypes.longstr;
        },
        {
            name: FieldNames.locales;
            domain: FieldTypes.longstr;
        }
    ];
};
export type connectionStartOk = {
    name: "connectionStartOk";
    classIndex: ClassIds.connection;
    methodIndex: 11;
    fields: [
        {
            name: FieldNames.clientProperties;
            domain: FieldTypes.table;
        },
        {
            name: FieldNames.mechanism;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.response;
            domain: FieldTypes.longstr;
        },
        {
            name: FieldNames.locale;
            domain: FieldTypes.shortstr;
        }
    ];
};
export type connectionSecure = {
    name: "connectionSecure";
    classIndex: ClassIds.connection;
    methodIndex: 20;
    fields: [
        {
            name: FieldNames.challenge;
            domain: FieldTypes.longstr;
        }
    ];
};
export type connectionSecureOk = {
    name: "connectionSecureOk";
    classIndex: ClassIds.connection;
    methodIndex: 21;
    fields: [
        {
            name: FieldNames.response;
            domain: FieldTypes.longstr;
        }
    ];
};
export type connectionTune = {
    name: "connectionTune";
    classIndex: ClassIds.connection;
    methodIndex: 30;
    fields: [
        {
            name: FieldNames.channelMax;
            domain: FieldTypes.short;
        },
        {
            name: FieldNames.frameMax;
            domain: FieldTypes.long;
        },
        {
            name: FieldNames.heartbeat;
            domain: FieldTypes.short;
        }
    ];
};
export type connectionTuneOk = {
    name: "connectionTuneOk";
    classIndex: ClassIds.connection;
    methodIndex: 31;
    fields: [
        {
            name: FieldNames.channelMax;
            domain: FieldTypes.short;
        },
        {
            name: FieldNames.frameMax;
            domain: FieldTypes.long;
        },
        {
            name: FieldNames.heartbeat;
            domain: FieldTypes.short;
        }
    ];
};
export type connectionOpen = {
    name: "connectionOpen";
    classIndex: ClassIds.connection;
    methodIndex: 40;
    fields: [
        {
            name: FieldNames.virtualHost;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.reserved1;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.reserved2;
            domain: FieldTypes.bit;
        }
    ];
};
export type connectionOpenOk = {
    name: "connectionOpenOk";
    classIndex: ClassIds.connection;
    methodIndex: 41;
    fields: [
        {
            name: FieldNames.reserved1;
            domain: FieldTypes.shortstr;
        }
    ];
};
export type connectionClose = {
    name: "connectionClose";
    classIndex: ClassIds.connection;
    methodIndex: 50;
    fields: [
        {
            name: FieldNames.replyCode;
            domain: FieldTypes.short;
        },
        {
            name: FieldNames.replyText;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.classId;
            domain: FieldTypes.short;
        },
        {
            name: FieldNames.methodId;
            domain: FieldTypes.short;
        }
    ];
};
export type connectionCloseOk = {
    name: "connectionCloseOk";
    classIndex: ClassIds.connection;
    methodIndex: 51;
    fields: [
    ];
};
export type connectionBlocked = {
    name: "connectionBlocked";
    classIndex: ClassIds.connection;
    methodIndex: 60;
    fields: [
        {
            name: FieldNames.reason;
            domain: FieldTypes.shortstr;
        }
    ];
};
export type connectionUnblocked = {
    name: "connectionUnblocked";
    classIndex: ClassIds.connection;
    methodIndex: 61;
    fields: [
    ];
};
export type channelOpen = {
    name: "channelOpen";
    classIndex: ClassIds.channel;
    methodIndex: 10;
    fields: [
        {
            name: FieldNames.reserved1;
            domain: FieldTypes.shortstr;
        }
    ];
};
export type channelOpenOk = {
    name: "channelOpenOk";
    classIndex: ClassIds.channel;
    methodIndex: 11;
    fields: [
        {
            name: FieldNames.reserved1;
            domain: FieldTypes.longstr;
        }
    ];
};
export type channelFlow = {
    name: "channelFlow";
    classIndex: ClassIds.channel;
    methodIndex: 20;
    fields: [
        {
            name: FieldNames.active;
            domain: FieldTypes.bit;
        }
    ];
};
export type channelFlowOk = {
    name: "channelFlowOk";
    classIndex: ClassIds.channel;
    methodIndex: 21;
    fields: [
        {
            name: FieldNames.active;
            domain: FieldTypes.bit;
        }
    ];
};
export type channelClose = {
    name: "channelClose";
    classIndex: ClassIds.channel;
    methodIndex: 40;
    fields: [
        {
            name: FieldNames.replyCode;
            domain: FieldTypes.short;
        },
        {
            name: FieldNames.replyText;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.classId;
            domain: FieldTypes.short;
        },
        {
            name: FieldNames.methodId;
            domain: FieldTypes.short;
        }
    ];
};
export type channelCloseOk = {
    name: "channelCloseOk";
    classIndex: ClassIds.channel;
    methodIndex: 41;
    fields: [
    ];
};
export type exchangeDeclare = {
    name: "exchangeDeclare";
    classIndex: ClassIds.exchange;
    methodIndex: 10;
    fields: [
        {
            name: FieldNames.reserved1;
            domain: FieldTypes.short;
        },
        {
            name: FieldNames.exchange;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.type;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.passive;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.durable;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.autoDelete;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.internal;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.noWait;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.arguments;
            domain: FieldTypes.table;
        }
    ];
};
export type exchangeDeclareOk = {
    name: "exchangeDeclareOk";
    classIndex: ClassIds.exchange;
    methodIndex: 11;
    fields: [
    ];
};
export type exchangeDelete = {
    name: "exchangeDelete";
    classIndex: ClassIds.exchange;
    methodIndex: 20;
    fields: [
        {
            name: FieldNames.reserved1;
            domain: FieldTypes.short;
        },
        {
            name: FieldNames.exchange;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.ifUnused;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.noWait;
            domain: FieldTypes.bit;
        }
    ];
};
export type exchangeDeleteOk = {
    name: "exchangeDeleteOk";
    classIndex: ClassIds.exchange;
    methodIndex: 21;
    fields: [
    ];
};
export type exchangeBind = {
    name: "exchangeBind";
    classIndex: ClassIds.exchange;
    methodIndex: 30;
    fields: [
        {
            name: FieldNames.reserved1;
            domain: FieldTypes.short;
        },
        {
            name: FieldNames.destination;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.source;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.routingKey;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.noWait;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.arguments;
            domain: FieldTypes.table;
        }
    ];
};
export type exchangeBindOk = {
    name: "exchangeBindOk";
    classIndex: ClassIds.exchange;
    methodIndex: 31;
    fields: [
    ];
};
export type exchangeUnbind = {
    name: "exchangeUnbind";
    classIndex: ClassIds.exchange;
    methodIndex: 40;
    fields: [
        {
            name: FieldNames.reserved1;
            domain: FieldTypes.short;
        },
        {
            name: FieldNames.destination;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.source;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.routingKey;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.noWait;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.arguments;
            domain: FieldTypes.table;
        }
    ];
};
export type exchangeUnbindOk = {
    name: "exchangeUnbindOk";
    classIndex: ClassIds.exchange;
    methodIndex: 51;
    fields: [
    ];
};
export type queueDeclare = {
    name: "queueDeclare";
    classIndex: ClassIds.queue;
    methodIndex: 10;
    fields: [
        {
            name: FieldNames.reserved1;
            domain: FieldTypes.short;
        },
        {
            name: FieldNames.queue;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.passive;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.durable;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.exclusive;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.autoDelete;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.noWait;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.arguments;
            domain: FieldTypes.table;
        }
    ];
};
export type queueDeclareOk = {
    name: "queueDeclareOk";
    classIndex: ClassIds.queue;
    methodIndex: 11;
    fields: [
        {
            name: FieldNames.queue;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.messageCount;
            domain: FieldTypes.long;
        },
        {
            name: FieldNames.consumerCount;
            domain: FieldTypes.long;
        }
    ];
};
export type queueBind = {
    name: "queueBind";
    classIndex: ClassIds.queue;
    methodIndex: 20;
    fields: [
        {
            name: FieldNames.reserved1;
            domain: FieldTypes.short;
        },
        {
            name: FieldNames.queue;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.exchange;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.routingKey;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.noWait;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.arguments;
            domain: FieldTypes.table;
        }
    ];
};
export type queueBindOk = {
    name: "queueBindOk";
    classIndex: ClassIds.queue;
    methodIndex: 21;
    fields: [
    ];
};
export type queueUnbind = {
    name: "queueUnbind";
    classIndex: ClassIds.queue;
    methodIndex: 50;
    fields: [
        {
            name: FieldNames.reserved1;
            domain: FieldTypes.short;
        },
        {
            name: FieldNames.queue;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.exchange;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.routingKey;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.arguments;
            domain: FieldTypes.table;
        }
    ];
};
export type queueUnbindOk = {
    name: "queueUnbindOk";
    classIndex: ClassIds.queue;
    methodIndex: 51;
    fields: [
    ];
};
export type queuePurge = {
    name: "queuePurge";
    classIndex: ClassIds.queue;
    methodIndex: 30;
    fields: [
        {
            name: FieldNames.reserved1;
            domain: FieldTypes.short;
        },
        {
            name: FieldNames.queue;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.noWait;
            domain: FieldTypes.bit;
        }
    ];
};
export type queuePurgeOk = {
    name: "queuePurgeOk";
    classIndex: ClassIds.queue;
    methodIndex: 31;
    fields: [
        {
            name: FieldNames.messageCount;
            domain: FieldTypes.long;
        }
    ];
};
export type queueDelete = {
    name: "queueDelete";
    classIndex: ClassIds.queue;
    methodIndex: 40;
    fields: [
        {
            name: FieldNames.reserved1;
            domain: FieldTypes.short;
        },
        {
            name: FieldNames.queue;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.ifUnused;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.ifEmpty;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.noWait;
            domain: FieldTypes.bit;
        }
    ];
};
export type queueDeleteOk = {
    name: "queueDeleteOk";
    classIndex: ClassIds.queue;
    methodIndex: 41;
    fields: [
        {
            name: FieldNames.messageCount;
            domain: FieldTypes.long;
        }
    ];
};
export type basicQos = {
    name: "basicQos";
    classIndex: ClassIds.basic;
    methodIndex: 10;
    fields: [
        {
            name: FieldNames.prefetchSize;
            domain: FieldTypes.long;
        },
        {
            name: FieldNames.prefetchCount;
            domain: FieldTypes.short;
        },
        {
            name: FieldNames.global;
            domain: FieldTypes.bit;
        }
    ];
};
export type basicQosOk = {
    name: "basicQosOk";
    classIndex: ClassIds.basic;
    methodIndex: 11;
    fields: [
    ];
};
export type basicConsume = {
    name: "basicConsume";
    classIndex: ClassIds.basic;
    methodIndex: 20;
    fields: [
        {
            name: FieldNames.reserved1;
            domain: FieldTypes.short;
        },
        {
            name: FieldNames.queue;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.consumerTag;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.noLocal;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.noAck;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.exclusive;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.noWait;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.arguments;
            domain: FieldTypes.table;
        }
    ];
};
export type basicConsumeOk = {
    name: "basicConsumeOk";
    classIndex: ClassIds.basic;
    methodIndex: 21;
    fields: [
        {
            name: FieldNames.consumerTag;
            domain: FieldTypes.shortstr;
        }
    ];
};
export type basicCancel = {
    name: "basicCancel";
    classIndex: ClassIds.basic;
    methodIndex: 30;
    fields: [
        {
            name: FieldNames.consumerTag;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.noWait;
            domain: FieldTypes.bit;
        }
    ];
};
export type basicCancelOk = {
    name: "basicCancelOk";
    classIndex: ClassIds.basic;
    methodIndex: 31;
    fields: [
        {
            name: FieldNames.consumerTag;
            domain: FieldTypes.shortstr;
        }
    ];
};
export type basicPublish = {
    name: "basicPublish";
    classIndex: ClassIds.basic;
    methodIndex: 40;
    fields: [
        {
            name: FieldNames.reserved1;
            domain: FieldTypes.short;
        },
        {
            name: FieldNames.exchange;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.routingKey;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.mandatory;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.immediate;
            domain: FieldTypes.bit;
        }
    ];
};
export type basicReturn = {
    name: "basicReturn";
    classIndex: ClassIds.basic;
    methodIndex: 50;
    fields: [
        {
            name: FieldNames.replyCode;
            domain: FieldTypes.short;
        },
        {
            name: FieldNames.replyText;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.exchange;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.routingKey;
            domain: FieldTypes.shortstr;
        }
    ];
};
export type basicDeliver = {
    name: "basicDeliver";
    classIndex: ClassIds.basic;
    methodIndex: 60;
    fields: [
        {
            name: FieldNames.consumerTag;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.deliveryTag;
            domain: FieldTypes.longlong;
        },
        {
            name: FieldNames.redelivered;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.exchange;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.routingKey;
            domain: FieldTypes.shortstr;
        }
    ];
};
export type basicGet = {
    name: "basicGet";
    classIndex: ClassIds.basic;
    methodIndex: 70;
    fields: [
        {
            name: FieldNames.reserved1;
            domain: FieldTypes.short;
        },
        {
            name: FieldNames.queue;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.noAck;
            domain: FieldTypes.bit;
        }
    ];
};
export type basicGetOk = {
    name: "basicGetOk";
    classIndex: ClassIds.basic;
    methodIndex: 71;
    fields: [
        {
            name: FieldNames.deliveryTag;
            domain: FieldTypes.longlong;
        },
        {
            name: FieldNames.redelivered;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.exchange;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.routingKey;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.messageCount;
            domain: FieldTypes.long;
        }
    ];
};
export type basicGetEmpty = {
    name: "basicGetEmpty";
    classIndex: ClassIds.basic;
    methodIndex: 72;
    fields: [
        {
            name: FieldNames.reserved1;
            domain: FieldTypes.shortstr;
        }
    ];
};
export type basicAck = {
    name: "basicAck";
    classIndex: ClassIds.basic;
    methodIndex: 80;
    fields: [
        {
            name: FieldNames.deliveryTag;
            domain: FieldTypes.longlong;
        },
        {
            name: FieldNames.multiple;
            domain: FieldTypes.bit;
        }
    ];
};
export type basicReject = {
    name: "basicReject";
    classIndex: ClassIds.basic;
    methodIndex: 90;
    fields: [
        {
            name: FieldNames.deliveryTag;
            domain: FieldTypes.longlong;
        },
        {
            name: FieldNames.requeue;
            domain: FieldTypes.bit;
        }
    ];
};
export type basicRecoverAsync = {
    name: "basicRecoverAsync";
    classIndex: ClassIds.basic;
    methodIndex: 100;
    fields: [
        {
            name: FieldNames.requeue;
            domain: FieldTypes.bit;
        }
    ];
};
export type basicRecover = {
    name: "basicRecover";
    classIndex: ClassIds.basic;
    methodIndex: 110;
    fields: [
        {
            name: FieldNames.requeue;
            domain: FieldTypes.bit;
        }
    ];
};
export type basicRecoverOk = {
    name: "basicRecoverOk";
    classIndex: ClassIds.basic;
    methodIndex: 111;
    fields: [
    ];
};
export type basicNack = {
    name: "basicNack";
    classIndex: ClassIds.basic;
    methodIndex: 120;
    fields: [
        {
            name: FieldNames.deliveryTag;
            domain: FieldTypes.longlong;
        },
        {
            name: FieldNames.multiple;
            domain: FieldTypes.bit;
        },
        {
            name: FieldNames.requeue;
            domain: FieldTypes.bit;
        }
    ];
};
export type txSelect = {
    name: "txSelect";
    classIndex: ClassIds.tx;
    methodIndex: 10;
    fields: [
    ];
};
export type txSelectOk = {
    name: "txSelectOk";
    classIndex: ClassIds.tx;
    methodIndex: 11;
    fields: [
    ];
};
export type txCommit = {
    name: "txCommit";
    classIndex: ClassIds.tx;
    methodIndex: 20;
    fields: [
    ];
};
export type txCommitOk = {
    name: "txCommitOk";
    classIndex: ClassIds.tx;
    methodIndex: 21;
    fields: [
    ];
};
export type txRollback = {
    name: "txRollback";
    classIndex: ClassIds.tx;
    methodIndex: 30;
    fields: [
    ];
};
export type txRollbackOk = {
    name: "txRollbackOk";
    classIndex: ClassIds.tx;
    methodIndex: 31;
    fields: [
    ];
};
export type confirmSelect = {
    name: "confirmSelect";
    classIndex: ClassIds.confirm;
    methodIndex: 10;
    fields: [
        {
            name: FieldNames.noWait;
            domain: FieldTypes.bit;
        }
    ];
};
export type confirmSelectOk = {
    name: "confirmSelectOk";
    classIndex: ClassIds.confirm;
    methodIndex: 11;
    fields: [
    ];
};
export type connection = {
    name: ClassNames.connection;
    index: ClassIds.connection;
    fields: [
    ];
    methods: [
        connectionStart,
        connectionStartOk,
        connectionSecure,
        connectionSecureOk,
        connectionTune,
        connectionTuneOk,
        connectionOpen,
        connectionOpenOk,
        connectionClose,
        connectionCloseOk,
        connectionBlocked,
        connectionUnblocked
    ];
};
export type channel = {
    name: ClassNames.channel;
    index: ClassIds.channel;
    fields: [
    ];
    methods: [
        channelOpen,
        channelOpenOk,
        channelFlow,
        channelFlowOk,
        channelClose,
        channelCloseOk
    ];
};
export type exchange = {
    name: ClassNames.exchange;
    index: ClassIds.exchange;
    fields: [
    ];
    methods: [
        exchangeDeclare,
        exchangeDeclareOk,
        exchangeDelete,
        exchangeDeleteOk,
        exchangeBind,
        exchangeBindOk,
        exchangeUnbind,
        exchangeUnbindOk
    ];
};
export type queue = {
    name: ClassNames.queue;
    index: ClassIds.queue;
    fields: [
    ];
    methods: [
        queueDeclare,
        queueDeclareOk,
        queueBind,
        queueBindOk,
        queueUnbind,
        queueUnbindOk,
        queuePurge,
        queuePurgeOk,
        queueDelete,
        queueDeleteOk
    ];
};
export type basic = {
    name: ClassNames.basic;
    index: ClassIds.basic;
    fields: [
        {
            name: FieldNames.contentType;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.contentEncoding;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.headers;
            domain: FieldTypes.table;
        },
        {
            name: FieldNames.deliveryMode;
            domain: FieldTypes.octet;
        },
        {
            name: FieldNames.priority;
            domain: FieldTypes.octet;
        },
        {
            name: FieldNames.correlationId;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.replyTo;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.expiration;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.messageId;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.timestamp;
            domain: FieldTypes.timestamp;
        },
        {
            name: FieldNames.type;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.userId;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.appId;
            domain: FieldTypes.shortstr;
        },
        {
            name: FieldNames.reserved;
            domain: FieldTypes.shortstr;
        }
    ];
    methods: [
        basicQos,
        basicQosOk,
        basicConsume,
        basicConsumeOk,
        basicCancel,
        basicCancelOk,
        basicPublish,
        basicReturn,
        basicDeliver,
        basicGet,
        basicGetOk,
        basicGetEmpty,
        basicAck,
        basicReject,
        basicRecoverAsync,
        basicRecover,
        basicRecoverOk,
        basicNack
    ];
};
export type confirm = {
    name: ClassNames.confirm;
    index: ClassIds.confirm;
    fields: [
    ];
    methods: [
        confirmSelect,
        confirmSelectOk
    ];
};
export type tx = {
    name: ClassNames.tx;
    index: ClassIds.tx;
    fields: [
    ];
    methods: [
        txSelect,
        txSelectOk,
        txCommit,
        txCommitOk,
        txRollback,
        txRollbackOk
    ];
};
export type MethodsTable = {
    connectionStart: connectionStart;
    connectionStartOk: connectionStartOk;
    connectionSecure: connectionSecure;
    connectionSecureOk: connectionSecureOk;
    connectionTune: connectionTune;
    connectionTuneOk: connectionTuneOk;
    connectionOpen: connectionOpen;
    connectionOpenOk: connectionOpenOk;
    connectionClose: connectionClose;
    connectionCloseOk: connectionCloseOk;
    connectionBlocked: connectionBlocked;
    connectionUnblocked: connectionUnblocked;
    channelOpen: channelOpen;
    channelOpenOk: channelOpenOk;
    channelFlow: channelFlow;
    channelFlowOk: channelFlowOk;
    channelClose: channelClose;
    channelCloseOk: channelCloseOk;
    exchangeDeclare: exchangeDeclare;
    exchangeDeclareOk: exchangeDeclareOk;
    exchangeDelete: exchangeDelete;
    exchangeDeleteOk: exchangeDeleteOk;
    exchangeBind: exchangeBind;
    exchangeBindOk: exchangeBindOk;
    exchangeUnbind: exchangeUnbind;
    exchangeUnbindOk: exchangeUnbindOk;
    queueDeclare: queueDeclare;
    queueDeclareOk: queueDeclareOk;
    queueBind: queueBind;
    queueBindOk: queueBindOk;
    queueUnbind: queueUnbind;
    queueUnbindOk: queueUnbindOk;
    queuePurge: queuePurge;
    queuePurgeOk: queuePurgeOk;
    queueDelete: queueDelete;
    queueDeleteOk: queueDeleteOk;
    basicQos: basicQos;
    basicQosOk: basicQosOk;
    basicConsume: basicConsume;
    basicConsumeOk: basicConsumeOk;
    basicCancel: basicCancel;
    basicCancelOk: basicCancelOk;
    basicPublish: basicPublish;
    basicReturn: basicReturn;
    basicDeliver: basicDeliver;
    basicGet: basicGet;
    basicGetOk: basicGetOk;
    basicGetEmpty: basicGetEmpty;
    basicAck: basicAck;
    basicReject: basicReject;
    basicRecoverAsync: basicRecoverAsync;
    basicRecover: basicRecover;
    basicRecoverOk: basicRecoverOk;
    basicNack: basicNack;
    txSelect: txSelect;
    txSelectOk: txSelectOk;
    txCommit: txCommit;
    txCommitOk: txCommitOk;
    txRollback: txRollback;
    txRollbackOk: txRollbackOk;
    confirmSelect: confirmSelect;
    confirmSelectOk: confirmSelectOk;
};
export const methods: MethodsTable = {
    connectionStart: { name: "connectionStart", classIndex: 10, methodIndex: 10, fields: [{ domain: FieldTypes.octet, name: FieldNames.versionMajor }, { domain: FieldTypes.octet, name: FieldNames.versionMinor }, { domain: FieldTypes.table, name: FieldNames.serverProperties }, { domain: FieldTypes.longstr, name: FieldNames.mechanisms }, { domain: FieldTypes.longstr, name: FieldNames.locales }] },
    connectionStartOk: { name: "connectionStartOk", classIndex: 10, methodIndex: 11, fields: [{ domain: FieldTypes.table, name: FieldNames.clientProperties }, { domain: FieldTypes.shortstr, name: FieldNames.mechanism }, { domain: FieldTypes.longstr, name: FieldNames.response }, { domain: FieldTypes.shortstr, name: FieldNames.locale }] },
    connectionSecure: { name: "connectionSecure", classIndex: 10, methodIndex: 20, fields: [{ domain: FieldTypes.longstr, name: FieldNames.challenge }] },
    connectionSecureOk: { name: "connectionSecureOk", classIndex: 10, methodIndex: 21, fields: [{ domain: FieldTypes.longstr, name: FieldNames.response }] },
    connectionTune: { name: "connectionTune", classIndex: 10, methodIndex: 30, fields: [{ domain: FieldTypes.short, name: FieldNames.channelMax }, { domain: FieldTypes.long, name: FieldNames.frameMax }, { domain: FieldTypes.short, name: FieldNames.heartbeat }] },
    connectionTuneOk: { name: "connectionTuneOk", classIndex: 10, methodIndex: 31, fields: [{ domain: FieldTypes.short, name: FieldNames.channelMax }, { domain: FieldTypes.long, name: FieldNames.frameMax }, { domain: FieldTypes.short, name: FieldNames.heartbeat }] },
    connectionOpen: { name: "connectionOpen", classIndex: 10, methodIndex: 40, fields: [{ domain: FieldTypes.shortstr, name: FieldNames.virtualHost }, { domain: FieldTypes.shortstr, name: FieldNames.reserved1 }, { domain: FieldTypes.bit, name: FieldNames.reserved2 }] },
    connectionOpenOk: { name: "connectionOpenOk", classIndex: 10, methodIndex: 41, fields: [{ domain: FieldTypes.shortstr, name: FieldNames.reserved1 }] },
    connectionClose: { name: "connectionClose", classIndex: 10, methodIndex: 50, fields: [{ domain: FieldTypes.short, name: FieldNames.replyCode }, { domain: FieldTypes.shortstr, name: FieldNames.replyText }, { domain: FieldTypes.short, name: FieldNames.classId }, { domain: FieldTypes.short, name: FieldNames.methodId }] },
    connectionCloseOk: { name: "connectionCloseOk", classIndex: 10, methodIndex: 51, fields: [] },
    connectionBlocked: { name: "connectionBlocked", classIndex: 10, methodIndex: 60, fields: [{ domain: FieldTypes.shortstr, name: FieldNames.reason }] },
    connectionUnblocked: { name: "connectionUnblocked", classIndex: 10, methodIndex: 61, fields: [] },
    channelOpen: { name: "channelOpen", classIndex: 20, methodIndex: 10, fields: [{ domain: FieldTypes.shortstr, name: FieldNames.reserved1 }] },
    channelOpenOk: { name: "channelOpenOk", classIndex: 20, methodIndex: 11, fields: [{ domain: FieldTypes.longstr, name: FieldNames.reserved1 }] },
    channelFlow: { name: "channelFlow", classIndex: 20, methodIndex: 20, fields: [{ domain: FieldTypes.bit, name: FieldNames.active }] },
    channelFlowOk: { name: "channelFlowOk", classIndex: 20, methodIndex: 21, fields: [{ domain: FieldTypes.bit, name: FieldNames.active }] },
    channelClose: { name: "channelClose", classIndex: 20, methodIndex: 40, fields: [{ domain: FieldTypes.short, name: FieldNames.replyCode }, { domain: FieldTypes.shortstr, name: FieldNames.replyText }, { domain: FieldTypes.short, name: FieldNames.classId }, { domain: FieldTypes.short, name: FieldNames.methodId }] },
    channelCloseOk: { name: "channelCloseOk", classIndex: 20, methodIndex: 41, fields: [] },
    exchangeDeclare: { name: "exchangeDeclare", classIndex: 40, methodIndex: 10, fields: [{ domain: FieldTypes.short, name: FieldNames.reserved1 }, { domain: FieldTypes.shortstr, name: FieldNames.exchange }, { domain: FieldTypes.shortstr, name: FieldNames.type }, { domain: FieldTypes.bit, name: FieldNames.passive }, { domain: FieldTypes.bit, name: FieldNames.durable }, { domain: FieldTypes.bit, name: FieldNames.autoDelete }, { domain: FieldTypes.bit, name: FieldNames.internal }, { domain: FieldTypes.bit, name: FieldNames.noWait }, { domain: FieldTypes.table, name: FieldNames.arguments }] },
    exchangeDeclareOk: { name: "exchangeDeclareOk", classIndex: 40, methodIndex: 11, fields: [] },
    exchangeDelete: { name: "exchangeDelete", classIndex: 40, methodIndex: 20, fields: [{ domain: FieldTypes.short, name: FieldNames.reserved1 }, { domain: FieldTypes.shortstr, name: FieldNames.exchange }, { domain: FieldTypes.bit, name: FieldNames.ifUnused }, { domain: FieldTypes.bit, name: FieldNames.noWait }] },
    exchangeDeleteOk: { name: "exchangeDeleteOk", classIndex: 40, methodIndex: 21, fields: [] },
    exchangeBind: { name: "exchangeBind", classIndex: 40, methodIndex: 30, fields: [{ domain: FieldTypes.short, name: FieldNames.reserved1 }, { domain: FieldTypes.shortstr, name: FieldNames.destination }, { domain: FieldTypes.shortstr, name: FieldNames.source }, { domain: FieldTypes.shortstr, name: FieldNames.routingKey }, { domain: FieldTypes.bit, name: FieldNames.noWait }, { domain: FieldTypes.table, name: FieldNames.arguments }] },
    exchangeBindOk: { name: "exchangeBindOk", classIndex: 40, methodIndex: 31, fields: [] },
    exchangeUnbind: { name: "exchangeUnbind", classIndex: 40, methodIndex: 40, fields: [{ domain: FieldTypes.short, name: FieldNames.reserved1 }, { domain: FieldTypes.shortstr, name: FieldNames.destination }, { domain: FieldTypes.shortstr, name: FieldNames.source }, { domain: FieldTypes.shortstr, name: FieldNames.routingKey }, { domain: FieldTypes.bit, name: FieldNames.noWait }, { domain: FieldTypes.table, name: FieldNames.arguments }] },
    exchangeUnbindOk: { name: "exchangeUnbindOk", classIndex: 40, methodIndex: 51, fields: [] },
    queueDeclare: { name: "queueDeclare", classIndex: 50, methodIndex: 10, fields: [{ domain: FieldTypes.short, name: FieldNames.reserved1 }, { domain: FieldTypes.shortstr, name: FieldNames.queue }, { domain: FieldTypes.bit, name: FieldNames.passive }, { domain: FieldTypes.bit, name: FieldNames.durable }, { domain: FieldTypes.bit, name: FieldNames.exclusive }, { domain: FieldTypes.bit, name: FieldNames.autoDelete }, { domain: FieldTypes.bit, name: FieldNames.noWait }, { domain: FieldTypes.table, name: FieldNames.arguments }] },
    queueDeclareOk: { name: "queueDeclareOk", classIndex: 50, methodIndex: 11, fields: [{ domain: FieldTypes.shortstr, name: FieldNames.queue }, { domain: FieldTypes.long, name: FieldNames.messageCount }, { domain: FieldTypes.long, name: FieldNames.consumerCount }] },
    queueBind: { name: "queueBind", classIndex: 50, methodIndex: 20, fields: [{ domain: FieldTypes.short, name: FieldNames.reserved1 }, { domain: FieldTypes.shortstr, name: FieldNames.queue }, { domain: FieldTypes.shortstr, name: FieldNames.exchange }, { domain: FieldTypes.shortstr, name: FieldNames.routingKey }, { domain: FieldTypes.bit, name: FieldNames.noWait }, { domain: FieldTypes.table, name: FieldNames.arguments }] },
    queueBindOk: { name: "queueBindOk", classIndex: 50, methodIndex: 21, fields: [] },
    queueUnbind: { name: "queueUnbind", classIndex: 50, methodIndex: 50, fields: [{ domain: FieldTypes.short, name: FieldNames.reserved1 }, { domain: FieldTypes.shortstr, name: FieldNames.queue }, { domain: FieldTypes.shortstr, name: FieldNames.exchange }, { domain: FieldTypes.shortstr, name: FieldNames.routingKey }, { domain: FieldTypes.table, name: FieldNames.arguments }] },
    queueUnbindOk: { name: "queueUnbindOk", classIndex: 50, methodIndex: 51, fields: [] },
    queuePurge: { name: "queuePurge", classIndex: 50, methodIndex: 30, fields: [{ domain: FieldTypes.short, name: FieldNames.reserved1 }, { domain: FieldTypes.shortstr, name: FieldNames.queue }, { domain: FieldTypes.bit, name: FieldNames.noWait }] },
    queuePurgeOk: { name: "queuePurgeOk", classIndex: 50, methodIndex: 31, fields: [{ domain: FieldTypes.long, name: FieldNames.messageCount }] },
    queueDelete: { name: "queueDelete", classIndex: 50, methodIndex: 40, fields: [{ domain: FieldTypes.short, name: FieldNames.reserved1 }, { domain: FieldTypes.shortstr, name: FieldNames.queue }, { domain: FieldTypes.bit, name: FieldNames.ifUnused }, { domain: FieldTypes.bit, name: FieldNames.ifEmpty }, { domain: FieldTypes.bit, name: FieldNames.noWait }] },
    queueDeleteOk: { name: "queueDeleteOk", classIndex: 50, methodIndex: 41, fields: [{ domain: FieldTypes.long, name: FieldNames.messageCount }] },
    basicQos: { name: "basicQos", classIndex: 60, methodIndex: 10, fields: [{ domain: FieldTypes.long, name: FieldNames.prefetchSize }, { domain: FieldTypes.short, name: FieldNames.prefetchCount }, { domain: FieldTypes.bit, name: FieldNames.global }] },
    basicQosOk: { name: "basicQosOk", classIndex: 60, methodIndex: 11, fields: [] },
    basicConsume: { name: "basicConsume", classIndex: 60, methodIndex: 20, fields: [{ domain: FieldTypes.short, name: FieldNames.reserved1 }, { domain: FieldTypes.shortstr, name: FieldNames.queue }, { domain: FieldTypes.shortstr, name: FieldNames.consumerTag }, { domain: FieldTypes.bit, name: FieldNames.noLocal }, { domain: FieldTypes.bit, name: FieldNames.noAck }, { domain: FieldTypes.bit, name: FieldNames.exclusive }, { domain: FieldTypes.bit, name: FieldNames.noWait }, { domain: FieldTypes.table, name: FieldNames.arguments }] },
    basicConsumeOk: { name: "basicConsumeOk", classIndex: 60, methodIndex: 21, fields: [{ domain: FieldTypes.shortstr, name: FieldNames.consumerTag }] },
    basicCancel: { name: "basicCancel", classIndex: 60, methodIndex: 30, fields: [{ domain: FieldTypes.shortstr, name: FieldNames.consumerTag }, { domain: FieldTypes.bit, name: FieldNames.noWait }] },
    basicCancelOk: { name: "basicCancelOk", classIndex: 60, methodIndex: 31, fields: [{ domain: FieldTypes.shortstr, name: FieldNames.consumerTag }] },
    basicPublish: { name: "basicPublish", classIndex: 60, methodIndex: 40, fields: [{ domain: FieldTypes.short, name: FieldNames.reserved1 }, { domain: FieldTypes.shortstr, name: FieldNames.exchange }, { domain: FieldTypes.shortstr, name: FieldNames.routingKey }, { domain: FieldTypes.bit, name: FieldNames.mandatory }, { domain: FieldTypes.bit, name: FieldNames.immediate }] },
    basicReturn: { name: "basicReturn", classIndex: 60, methodIndex: 50, fields: [{ domain: FieldTypes.short, name: FieldNames.replyCode }, { domain: FieldTypes.shortstr, name: FieldNames.replyText }, { domain: FieldTypes.shortstr, name: FieldNames.exchange }, { domain: FieldTypes.shortstr, name: FieldNames.routingKey }] },
    basicDeliver: { name: "basicDeliver", classIndex: 60, methodIndex: 60, fields: [{ domain: FieldTypes.shortstr, name: FieldNames.consumerTag }, { domain: FieldTypes.longlong, name: FieldNames.deliveryTag }, { domain: FieldTypes.bit, name: FieldNames.redelivered }, { domain: FieldTypes.shortstr, name: FieldNames.exchange }, { domain: FieldTypes.shortstr, name: FieldNames.routingKey }] },
    basicGet: { name: "basicGet", classIndex: 60, methodIndex: 70, fields: [{ domain: FieldTypes.short, name: FieldNames.reserved1 }, { domain: FieldTypes.shortstr, name: FieldNames.queue }, { domain: FieldTypes.bit, name: FieldNames.noAck }] },
    basicGetOk: { name: "basicGetOk", classIndex: 60, methodIndex: 71, fields: [{ domain: FieldTypes.longlong, name: FieldNames.deliveryTag }, { domain: FieldTypes.bit, name: FieldNames.redelivered }, { domain: FieldTypes.shortstr, name: FieldNames.exchange }, { domain: FieldTypes.shortstr, name: FieldNames.routingKey }, { domain: FieldTypes.long, name: FieldNames.messageCount }] },
    basicGetEmpty: { name: "basicGetEmpty", classIndex: 60, methodIndex: 72, fields: [{ domain: FieldTypes.shortstr, name: FieldNames.reserved1 }] },
    basicAck: { name: "basicAck", classIndex: 60, methodIndex: 80, fields: [{ domain: FieldTypes.longlong, name: FieldNames.deliveryTag }, { domain: FieldTypes.bit, name: FieldNames.multiple }] },
    basicReject: { name: "basicReject", classIndex: 60, methodIndex: 90, fields: [{ domain: FieldTypes.longlong, name: FieldNames.deliveryTag }, { domain: FieldTypes.bit, name: FieldNames.requeue }] },
    basicRecoverAsync: { name: "basicRecoverAsync", classIndex: 60, methodIndex: 100, fields: [{ domain: FieldTypes.bit, name: FieldNames.requeue }] },
    basicRecover: { name: "basicRecover", classIndex: 60, methodIndex: 110, fields: [{ domain: FieldTypes.bit, name: FieldNames.requeue }] },
    basicRecoverOk: { name: "basicRecoverOk", classIndex: 60, methodIndex: 111, fields: [] },
    basicNack: { name: "basicNack", classIndex: 60, methodIndex: 120, fields: [{ domain: FieldTypes.longlong, name: FieldNames.deliveryTag }, { domain: FieldTypes.bit, name: FieldNames.multiple }, { domain: FieldTypes.bit, name: FieldNames.requeue }] },
    txSelect: { name: "txSelect", classIndex: 90, methodIndex: 10, fields: [] },
    txSelectOk: { name: "txSelectOk", classIndex: 90, methodIndex: 11, fields: [] },
    txCommit: { name: "txCommit", classIndex: 90, methodIndex: 20, fields: [] },
    txCommitOk: { name: "txCommitOk", classIndex: 90, methodIndex: 21, fields: [] },
    txRollback: { name: "txRollback", classIndex: 90, methodIndex: 30, fields: [] },
    txRollbackOk: { name: "txRollbackOk", classIndex: 90, methodIndex: 31, fields: [] },
    confirmSelect: { name: "confirmSelect", classIndex: 85, methodIndex: 10, fields: [{ domain: FieldTypes.bit, name: FieldNames.noWait }] },
    confirmSelectOk: { name: "confirmSelectOk", classIndex: 85, methodIndex: 11, fields: [] }
};
export type MethodFrameConnectionStart = {
    type: FrameType.METHOD;
    name: "connectionStart";
    method: connectionStart;
    args: {
        [FieldNames.versionMajor]: number;
        [FieldNames.versionMinor]: number;
        [FieldNames.serverProperties]: Record<string, any>;
        [FieldNames.mechanisms]: string | Record<string, any>;
        [FieldNames.locales]: string | Record<string, any>;
    };
};
export type MethodFrameConnectionStartOk = {
    type: FrameType.METHOD;
    name: "connectionStartOk";
    method: connectionStartOk;
    args: {
        [FieldNames.clientProperties]: Record<string, any>;
        [FieldNames.mechanism]: string;
        [FieldNames.response]: string | Record<string, any>;
        [FieldNames.locale]: string;
    };
};
export type MethodFrameConnectionSecure = {
    type: FrameType.METHOD;
    name: "connectionSecure";
    method: connectionSecure;
    args: {
        [FieldNames.challenge]: string | Record<string, any>;
    };
};
export type MethodFrameConnectionSecureOk = {
    type: FrameType.METHOD;
    name: "connectionSecureOk";
    method: connectionSecureOk;
    args: {
        [FieldNames.response]: string | Record<string, any>;
    };
};
export type MethodFrameConnectionTune = {
    type: FrameType.METHOD;
    name: "connectionTune";
    method: connectionTune;
    args: {
        [FieldNames.channelMax]: number;
        [FieldNames.frameMax]: number;
        [FieldNames.heartbeat]: number;
    };
};
export type MethodFrameConnectionTuneOk = {
    type: FrameType.METHOD;
    name: "connectionTuneOk";
    method: connectionTuneOk;
    args: {
        [FieldNames.channelMax]: number;
        [FieldNames.frameMax]: number;
        [FieldNames.heartbeat]: number;
    };
};
export type MethodFrameConnectionOpen = {
    type: FrameType.METHOD;
    name: "connectionOpen";
    method: connectionOpen;
    args: {
        [FieldNames.virtualHost]: string;
        [FieldNames.reserved1]?: string;
        [FieldNames.reserved2]?: boolean;
    };
};
export type MethodFrameConnectionOpenOk = {
    type: FrameType.METHOD;
    name: "connectionOpenOk";
    method: connectionOpenOk;
    args?: {
        [FieldNames.reserved1]?: string;
    };
};
export type MethodFrameConnectionClose = {
    type: FrameType.METHOD;
    name: "connectionClose";
    method: connectionClose;
    args: {
        [FieldNames.replyCode]: number;
        [FieldNames.replyText]: string;
        [FieldNames.classId]: number;
        [FieldNames.methodId]: number;
    };
};
export type MethodFrameConnectionCloseOk = {
    type: FrameType.METHOD;
    name: "connectionCloseOk";
    method: connectionCloseOk;
    args?: Record<string, never>;
};
export type MethodFrameConnectionBlocked = {
    type: FrameType.METHOD;
    name: "connectionBlocked";
    method: connectionBlocked;
    args: {
        [FieldNames.reason]: string;
    };
};
export type MethodFrameConnectionUnblocked = {
    type: FrameType.METHOD;
    name: "connectionUnblocked";
    method: connectionUnblocked;
    args?: Record<string, never>;
};
export type MethodFrameChannelOpen = {
    type: FrameType.METHOD;
    name: "channelOpen";
    method: channelOpen;
    args?: {
        [FieldNames.reserved1]?: string;
    };
};
export type MethodFrameChannelOpenOk = {
    type: FrameType.METHOD;
    name: "channelOpenOk";
    method: channelOpenOk;
    args?: {
        [FieldNames.reserved1]?: string | Record<string, any>;
    };
};
export type MethodFrameChannelFlow = {
    type: FrameType.METHOD;
    name: "channelFlow";
    method: channelFlow;
    args: {
        [FieldNames.active]: boolean;
    };
};
export type MethodFrameChannelFlowOk = {
    type: FrameType.METHOD;
    name: "channelFlowOk";
    method: channelFlowOk;
    args: {
        [FieldNames.active]: boolean;
    };
};
export type MethodFrameChannelClose = {
    type: FrameType.METHOD;
    name: "channelClose";
    method: channelClose;
    args: {
        [FieldNames.replyCode]: number;
        [FieldNames.replyText]: string;
        [FieldNames.classId]: number;
        [FieldNames.methodId]: number;
    };
};
export type MethodFrameChannelCloseOk = {
    type: FrameType.METHOD;
    name: "channelCloseOk";
    method: channelCloseOk;
    args?: Record<string, never>;
};
export type MethodFrameExchangeDeclare = {
    type: FrameType.METHOD;
    name: "exchangeDeclare";
    method: exchangeDeclare;
    args: {
        [FieldNames.reserved1]?: number;
        [FieldNames.exchange]: string;
        [FieldNames.type]: string;
        [FieldNames.passive]: boolean;
        [FieldNames.durable]: boolean;
        [FieldNames.autoDelete]: boolean;
        [FieldNames.internal]: boolean;
        [FieldNames.noWait]?: boolean;
        [FieldNames.arguments]: Record<string, any>;
    };
};
export type MethodFrameExchangeDeclareOk = {
    type: FrameType.METHOD;
    name: "exchangeDeclareOk";
    method: exchangeDeclareOk;
    args?: Record<string, never>;
};
export type MethodFrameExchangeDelete = {
    type: FrameType.METHOD;
    name: "exchangeDelete";
    method: exchangeDelete;
    args: {
        [FieldNames.reserved1]?: number;
        [FieldNames.exchange]: string;
        [FieldNames.ifUnused]: boolean;
        [FieldNames.noWait]?: boolean;
    };
};
export type MethodFrameExchangeDeleteOk = {
    type: FrameType.METHOD;
    name: "exchangeDeleteOk";
    method: exchangeDeleteOk;
    args?: Record<string, never>;
};
export type MethodFrameExchangeBind = {
    type: FrameType.METHOD;
    name: "exchangeBind";
    method: exchangeBind;
    args: {
        [FieldNames.reserved1]?: number;
        [FieldNames.destination]: string;
        [FieldNames.source]: string;
        [FieldNames.routingKey]: string;
        [FieldNames.noWait]?: boolean;
        [FieldNames.arguments]: Record<string, any>;
    };
};
export type MethodFrameExchangeBindOk = {
    type: FrameType.METHOD;
    name: "exchangeBindOk";
    method: exchangeBindOk;
    args?: Record<string, never>;
};
export type MethodFrameExchangeUnbind = {
    type: FrameType.METHOD;
    name: "exchangeUnbind";
    method: exchangeUnbind;
    args: {
        [FieldNames.reserved1]?: number;
        [FieldNames.destination]: string;
        [FieldNames.source]: string;
        [FieldNames.routingKey]: string;
        [FieldNames.noWait]?: boolean;
        [FieldNames.arguments]: Record<string, any>;
    };
};
export type MethodFrameExchangeUnbindOk = {
    type: FrameType.METHOD;
    name: "exchangeUnbindOk";
    method: exchangeUnbindOk;
    args?: Record<string, never>;
};
export type MethodFrameQueueDeclare = {
    type: FrameType.METHOD;
    name: "queueDeclare";
    method: queueDeclare;
    args: {
        [FieldNames.reserved1]?: number;
        [FieldNames.queue]: string;
        [FieldNames.passive]: boolean;
        [FieldNames.durable]: boolean;
        [FieldNames.exclusive]: boolean;
        [FieldNames.autoDelete]: boolean;
        [FieldNames.noWait]?: boolean;
        [FieldNames.arguments]: Record<string, any>;
    };
};
export type MethodFrameQueueDeclareOk = {
    type: FrameType.METHOD;
    name: "queueDeclareOk";
    method: queueDeclareOk;
    args: {
        [FieldNames.queue]: string;
        [FieldNames.messageCount]: number;
        [FieldNames.consumerCount]: number;
    };
};
export type MethodFrameQueueBind = {
    type: FrameType.METHOD;
    name: "queueBind";
    method: queueBind;
    args: {
        [FieldNames.reserved1]?: number;
        [FieldNames.queue]: string;
        [FieldNames.exchange]: string;
        [FieldNames.routingKey]: string;
        [FieldNames.noWait]?: boolean;
        [FieldNames.arguments]: Record<string, any>;
    };
};
export type MethodFrameQueueBindOk = {
    type: FrameType.METHOD;
    name: "queueBindOk";
    method: queueBindOk;
    args?: Record<string, never>;
};
export type MethodFrameQueueUnbind = {
    type: FrameType.METHOD;
    name: "queueUnbind";
    method: queueUnbind;
    args: {
        [FieldNames.reserved1]?: number;
        [FieldNames.queue]: string;
        [FieldNames.exchange]: string;
        [FieldNames.routingKey]: string;
        [FieldNames.arguments]: Record<string, any>;
    };
};
export type MethodFrameQueueUnbindOk = {
    type: FrameType.METHOD;
    name: "queueUnbindOk";
    method: queueUnbindOk;
    args?: Record<string, never>;
};
export type MethodFrameQueuePurge = {
    type: FrameType.METHOD;
    name: "queuePurge";
    method: queuePurge;
    args: {
        [FieldNames.reserved1]?: number;
        [FieldNames.queue]: string;
        [FieldNames.noWait]?: boolean;
    };
};
export type MethodFrameQueuePurgeOk = {
    type: FrameType.METHOD;
    name: "queuePurgeOk";
    method: queuePurgeOk;
    args: {
        [FieldNames.messageCount]: number;
    };
};
export type MethodFrameQueueDelete = {
    type: FrameType.METHOD;
    name: "queueDelete";
    method: queueDelete;
    args: {
        [FieldNames.reserved1]?: number;
        [FieldNames.queue]: string;
        [FieldNames.ifUnused]: boolean;
        [FieldNames.ifEmpty]: boolean;
        [FieldNames.noWait]?: boolean;
    };
};
export type MethodFrameQueueDeleteOk = {
    type: FrameType.METHOD;
    name: "queueDeleteOk";
    method: queueDeleteOk;
    args: {
        [FieldNames.messageCount]: number;
    };
};
export type MethodFrameBasicQos = {
    type: FrameType.METHOD;
    name: "basicQos";
    method: basicQos;
    args: {
        [FieldNames.prefetchSize]: number;
        [FieldNames.prefetchCount]: number;
        [FieldNames.global]: boolean;
    };
};
export type MethodFrameBasicQosOk = {
    type: FrameType.METHOD;
    name: "basicQosOk";
    method: basicQosOk;
    args?: Record<string, never>;
};
export type MethodFrameBasicConsume = {
    type: FrameType.METHOD;
    name: "basicConsume";
    method: basicConsume;
    args: {
        [FieldNames.reserved1]?: number;
        [FieldNames.queue]: string;
        [FieldNames.consumerTag]: string;
        [FieldNames.noLocal]: boolean;
        [FieldNames.noAck]: boolean;
        [FieldNames.exclusive]: boolean;
        [FieldNames.noWait]?: boolean;
        [FieldNames.arguments]: Record<string, any>;
    };
};
export type MethodFrameBasicConsumeOk = {
    type: FrameType.METHOD;
    name: "basicConsumeOk";
    method: basicConsumeOk;
    args: {
        [FieldNames.consumerTag]: string;
    };
};
export type MethodFrameBasicCancel = {
    type: FrameType.METHOD;
    name: "basicCancel";
    method: basicCancel;
    args: {
        [FieldNames.consumerTag]: string;
        [FieldNames.noWait]?: boolean;
    };
};
export type MethodFrameBasicCancelOk = {
    type: FrameType.METHOD;
    name: "basicCancelOk";
    method: basicCancelOk;
    args: {
        [FieldNames.consumerTag]: string;
    };
};
export type MethodFrameBasicPublish = {
    type: FrameType.METHOD;
    name: "basicPublish";
    method: basicPublish;
    args: {
        [FieldNames.reserved1]?: number;
        [FieldNames.exchange]: string;
        [FieldNames.routingKey]: string;
        [FieldNames.mandatory]: boolean;
        [FieldNames.immediate]: boolean;
    };
};
export type MethodFrameBasicReturn = {
    type: FrameType.METHOD;
    name: "basicReturn";
    method: basicReturn;
    args: {
        [FieldNames.replyCode]: number;
        [FieldNames.replyText]: string;
        [FieldNames.exchange]: string;
        [FieldNames.routingKey]: string;
    };
};
export type MethodFrameBasicDeliver = {
    type: FrameType.METHOD;
    name: "basicDeliver";
    method: basicDeliver;
    args: {
        [FieldNames.consumerTag]: string;
        [FieldNames.deliveryTag]: number;
        [FieldNames.redelivered]: boolean;
        [FieldNames.exchange]: string;
        [FieldNames.routingKey]: string;
    };
};
export type MethodFrameBasicGet = {
    type: FrameType.METHOD;
    name: "basicGet";
    method: basicGet;
    args: {
        [FieldNames.reserved1]?: number;
        [FieldNames.queue]: string;
        [FieldNames.noAck]: boolean;
    };
};
export type MethodFrameBasicGetOk = {
    type: FrameType.METHOD;
    name: "basicGetOk";
    method: basicGetOk;
    args: {
        [FieldNames.deliveryTag]: number;
        [FieldNames.redelivered]: boolean;
        [FieldNames.exchange]: string;
        [FieldNames.routingKey]: string;
        [FieldNames.messageCount]: number;
    };
};
export type MethodFrameBasicGetEmpty = {
    type: FrameType.METHOD;
    name: "basicGetEmpty";
    method: basicGetEmpty;
    args?: {
        [FieldNames.reserved1]?: string;
    };
};
export type MethodFrameBasicAck = {
    type: FrameType.METHOD;
    name: "basicAck";
    method: basicAck;
    args: {
        [FieldNames.deliveryTag]: number;
        [FieldNames.multiple]: boolean;
    };
};
export type MethodFrameBasicReject = {
    type: FrameType.METHOD;
    name: "basicReject";
    method: basicReject;
    args: {
        [FieldNames.deliveryTag]: number;
        [FieldNames.requeue]: boolean;
    };
};
export type MethodFrameBasicRecoverAsync = {
    type: FrameType.METHOD;
    name: "basicRecoverAsync";
    method: basicRecoverAsync;
    args: {
        [FieldNames.requeue]: boolean;
    };
};
export type MethodFrameBasicRecover = {
    type: FrameType.METHOD;
    name: "basicRecover";
    method: basicRecover;
    args: {
        [FieldNames.requeue]: boolean;
    };
};
export type MethodFrameBasicRecoverOk = {
    type: FrameType.METHOD;
    name: "basicRecoverOk";
    method: basicRecoverOk;
    args?: Record<string, never>;
};
export type MethodFrameBasicNack = {
    type: FrameType.METHOD;
    name: "basicNack";
    method: basicNack;
    args: {
        [FieldNames.deliveryTag]: number;
        [FieldNames.multiple]: boolean;
        [FieldNames.requeue]: boolean;
    };
};
export type MethodFrameTxSelect = {
    type: FrameType.METHOD;
    name: "txSelect";
    method: txSelect;
    args?: Record<string, never>;
};
export type MethodFrameTxSelectOk = {
    type: FrameType.METHOD;
    name: "txSelectOk";
    method: txSelectOk;
    args?: Record<string, never>;
};
export type MethodFrameTxCommit = {
    type: FrameType.METHOD;
    name: "txCommit";
    method: txCommit;
    args?: Record<string, never>;
};
export type MethodFrameTxCommitOk = {
    type: FrameType.METHOD;
    name: "txCommitOk";
    method: txCommitOk;
    args?: Record<string, never>;
};
export type MethodFrameTxRollback = {
    type: FrameType.METHOD;
    name: "txRollback";
    method: txRollback;
    args?: Record<string, never>;
};
export type MethodFrameTxRollbackOk = {
    type: FrameType.METHOD;
    name: "txRollbackOk";
    method: txRollbackOk;
    args?: Record<string, never>;
};
export type MethodFrameConfirmSelect = {
    type: FrameType.METHOD;
    name: "confirmSelect";
    method: confirmSelect;
    args?: {
        [FieldNames.noWait]?: boolean;
    };
};
export type MethodFrameConfirmSelectOk = {
    type: FrameType.METHOD;
    name: "confirmSelectOk";
    method: confirmSelectOk;
    args?: Record<string, never>;
};
export type MethodFrame = MethodFrameConnectionStart | MethodFrameConnectionStartOk | MethodFrameConnectionSecure | MethodFrameConnectionSecureOk | MethodFrameConnectionTune | MethodFrameConnectionTuneOk | MethodFrameConnectionOpen | MethodFrameConnectionOpenOk | MethodFrameConnectionClose | MethodFrameConnectionCloseOk | MethodFrameConnectionBlocked | MethodFrameConnectionUnblocked | MethodFrameChannelOpen | MethodFrameChannelOpenOk | MethodFrameChannelFlow | MethodFrameChannelFlowOk | MethodFrameChannelClose | MethodFrameChannelCloseOk | MethodFrameExchangeDeclare | MethodFrameExchangeDeclareOk | MethodFrameExchangeDelete | MethodFrameExchangeDeleteOk | MethodFrameExchangeBind | MethodFrameExchangeBindOk | MethodFrameExchangeUnbind | MethodFrameExchangeUnbindOk | MethodFrameQueueDeclare | MethodFrameQueueDeclareOk | MethodFrameQueueBind | MethodFrameQueueBindOk | MethodFrameQueueUnbind | MethodFrameQueueUnbindOk | MethodFrameQueuePurge | MethodFrameQueuePurgeOk | MethodFrameQueueDelete | MethodFrameQueueDeleteOk | MethodFrameBasicQos | MethodFrameBasicQosOk | MethodFrameBasicConsume | MethodFrameBasicConsumeOk | MethodFrameBasicCancel | MethodFrameBasicCancelOk | MethodFrameBasicPublish | MethodFrameBasicReturn | MethodFrameBasicDeliver | MethodFrameBasicGet | MethodFrameBasicGetOk | MethodFrameBasicGetEmpty | MethodFrameBasicAck | MethodFrameBasicReject | MethodFrameBasicRecoverAsync | MethodFrameBasicRecover | MethodFrameBasicRecoverOk | MethodFrameBasicNack | MethodFrameTxSelect | MethodFrameTxSelectOk | MethodFrameTxCommit | MethodFrameTxCommitOk | MethodFrameTxRollback | MethodFrameTxRollbackOk | MethodFrameConfirmSelect | MethodFrameConfirmSelectOk;
export type MethodFrameOk = MethodFrameConnectionStartOk | MethodFrameConnectionSecureOk | MethodFrameConnectionTuneOk | MethodFrameConnectionOpenOk | MethodFrameConnectionCloseOk | MethodFrameChannelOpenOk | MethodFrameChannelFlowOk | MethodFrameChannelCloseOk | MethodFrameExchangeDeclareOk | MethodFrameExchangeDeleteOk | MethodFrameExchangeBindOk | MethodFrameExchangeUnbindOk | MethodFrameQueueDeclareOk | MethodFrameQueueBindOk | MethodFrameQueueUnbindOk | MethodFrameQueuePurgeOk | MethodFrameQueueDeleteOk | MethodFrameBasicQosOk | MethodFrameBasicConsumeOk | MethodFrameBasicCancelOk | MethodFrameBasicGetOk | MethodFrameBasicRecoverOk | MethodFrameTxSelectOk | MethodFrameTxCommitOk | MethodFrameTxRollbackOk | MethodFrameConfirmSelectOk;
export type ClassMethodsTable = {
    "10_10": connectionStart;
    "10_11": connectionStartOk;
    "10_20": connectionSecure;
    "10_21": connectionSecureOk;
    "10_30": connectionTune;
    "10_31": connectionTuneOk;
    "10_40": connectionOpen;
    "10_41": connectionOpenOk;
    "10_50": connectionClose;
    "10_51": connectionCloseOk;
    "10_60": connectionBlocked;
    "10_61": connectionUnblocked;
    "20_10": channelOpen;
    "20_11": channelOpenOk;
    "20_20": channelFlow;
    "20_21": channelFlowOk;
    "20_40": channelClose;
    "20_41": channelCloseOk;
    "40_10": exchangeDeclare;
    "40_11": exchangeDeclareOk;
    "40_20": exchangeDelete;
    "40_21": exchangeDeleteOk;
    "40_30": exchangeBind;
    "40_31": exchangeBindOk;
    "40_40": exchangeUnbind;
    "40_51": exchangeUnbindOk;
    "50_10": queueDeclare;
    "50_11": queueDeclareOk;
    "50_20": queueBind;
    "50_21": queueBindOk;
    "50_50": queueUnbind;
    "50_51": queueUnbindOk;
    "50_30": queuePurge;
    "50_31": queuePurgeOk;
    "50_40": queueDelete;
    "50_41": queueDeleteOk;
    "60_10": basicQos;
    "60_11": basicQosOk;
    "60_20": basicConsume;
    "60_21": basicConsumeOk;
    "60_30": basicCancel;
    "60_31": basicCancelOk;
    "60_40": basicPublish;
    "60_50": basicReturn;
    "60_60": basicDeliver;
    "60_70": basicGet;
    "60_71": basicGetOk;
    "60_72": basicGetEmpty;
    "60_80": basicAck;
    "60_90": basicReject;
    "60_100": basicRecoverAsync;
    "60_110": basicRecover;
    "60_111": basicRecoverOk;
    "60_120": basicNack;
    "90_10": txSelect;
    "90_11": txSelectOk;
    "90_20": txCommit;
    "90_21": txCommitOk;
    "90_30": txRollback;
    "90_31": txRollbackOk;
    "85_10": confirmSelect;
    "85_11": confirmSelectOk;
};
export const classMethodsTable: ClassMethodsTable = {
    "10_10": methods.connectionStart,
    "10_11": methods.connectionStartOk,
    "10_20": methods.connectionSecure,
    "10_21": methods.connectionSecureOk,
    "10_30": methods.connectionTune,
    "10_31": methods.connectionTuneOk,
    "10_40": methods.connectionOpen,
    "10_41": methods.connectionOpenOk,
    "10_50": methods.connectionClose,
    "10_51": methods.connectionCloseOk,
    "10_60": methods.connectionBlocked,
    "10_61": methods.connectionUnblocked,
    "20_10": methods.channelOpen,
    "20_11": methods.channelOpenOk,
    "20_20": methods.channelFlow,
    "20_21": methods.channelFlowOk,
    "20_40": methods.channelClose,
    "20_41": methods.channelCloseOk,
    "40_10": methods.exchangeDeclare,
    "40_11": methods.exchangeDeclareOk,
    "40_20": methods.exchangeDelete,
    "40_21": methods.exchangeDeleteOk,
    "40_30": methods.exchangeBind,
    "40_31": methods.exchangeBindOk,
    "40_40": methods.exchangeUnbind,
    "40_51": methods.exchangeUnbindOk,
    "50_10": methods.queueDeclare,
    "50_11": methods.queueDeclareOk,
    "50_20": methods.queueBind,
    "50_21": methods.queueBindOk,
    "50_50": methods.queueUnbind,
    "50_51": methods.queueUnbindOk,
    "50_30": methods.queuePurge,
    "50_31": methods.queuePurgeOk,
    "50_40": methods.queueDelete,
    "50_41": methods.queueDeleteOk,
    "60_10": methods.basicQos,
    "60_11": methods.basicQosOk,
    "60_20": methods.basicConsume,
    "60_21": methods.basicConsumeOk,
    "60_30": methods.basicCancel,
    "60_31": methods.basicCancelOk,
    "60_40": methods.basicPublish,
    "60_50": methods.basicReturn,
    "60_60": methods.basicDeliver,
    "60_70": methods.basicGet,
    "60_71": methods.basicGetOk,
    "60_72": methods.basicGetEmpty,
    "60_80": methods.basicAck,
    "60_90": methods.basicReject,
    "60_100": methods.basicRecoverAsync,
    "60_110": methods.basicRecover,
    "60_111": methods.basicRecoverOk,
    "60_120": methods.basicNack,
    "90_10": methods.txSelect,
    "90_11": methods.txSelectOk,
    "90_20": methods.txCommit,
    "90_21": methods.txCommitOk,
    "90_30": methods.txRollback,
    "90_31": methods.txRollbackOk,
    "85_10": methods.confirmSelect,
    "85_11": methods.confirmSelectOk
};
export type Classes = {
    [ClassIds.connection]: connection;
    [ClassIds.channel]: channel;
    [ClassIds.exchange]: exchange;
    [ClassIds.queue]: queue;
    [ClassIds.basic]: basic;
    [ClassIds.confirm]: confirm;
    [ClassIds.tx]: tx;
};
export const classes: Classes = {
    [ClassIds.connection]: {
        name: ClassNames.connection,
        index: ClassIds.connection,
        fields: [],
        methods: [
            methods.connectionStart,
            methods.connectionStartOk,
            methods.connectionSecure,
            methods.connectionSecureOk,
            methods.connectionTune,
            methods.connectionTuneOk,
            methods.connectionOpen,
            methods.connectionOpenOk,
            methods.connectionClose,
            methods.connectionCloseOk,
            methods.connectionBlocked,
            methods.connectionUnblocked
        ]
    },
    [ClassIds.channel]: {
        name: ClassNames.channel,
        index: ClassIds.channel,
        fields: [],
        methods: [
            methods.channelOpen,
            methods.channelOpenOk,
            methods.channelFlow,
            methods.channelFlowOk,
            methods.channelClose,
            methods.channelCloseOk
        ]
    },
    [ClassIds.exchange]: {
        name: ClassNames.exchange,
        index: ClassIds.exchange,
        fields: [],
        methods: [
            methods.exchangeDeclare,
            methods.exchangeDeclareOk,
            methods.exchangeDelete,
            methods.exchangeDeleteOk,
            methods.exchangeBind,
            methods.exchangeBindOk,
            methods.exchangeUnbind,
            methods.exchangeUnbindOk
        ]
    },
    [ClassIds.queue]: {
        name: ClassNames.queue,
        index: ClassIds.queue,
        fields: [],
        methods: [
            methods.queueDeclare,
            methods.queueDeclareOk,
            methods.queueBind,
            methods.queueBindOk,
            methods.queueUnbind,
            methods.queueUnbindOk,
            methods.queuePurge,
            methods.queuePurgeOk,
            methods.queueDelete,
            methods.queueDeleteOk
        ]
    },
    [ClassIds.basic]: {
        name: ClassNames.basic,
        index: ClassIds.basic,
        fields: [
            { name: FieldNames.contentType, domain: FieldTypes.shortstr },
            { name: FieldNames.contentEncoding, domain: FieldTypes.shortstr },
            { name: FieldNames.headers, domain: FieldTypes.table },
            { name: FieldNames.deliveryMode, domain: FieldTypes.octet },
            { name: FieldNames.priority, domain: FieldTypes.octet },
            { name: FieldNames.correlationId, domain: FieldTypes.shortstr },
            { name: FieldNames.replyTo, domain: FieldTypes.shortstr },
            { name: FieldNames.expiration, domain: FieldTypes.shortstr },
            { name: FieldNames.messageId, domain: FieldTypes.shortstr },
            { name: FieldNames.timestamp, domain: FieldTypes.timestamp },
            { name: FieldNames.type, domain: FieldTypes.shortstr },
            { name: FieldNames.userId, domain: FieldTypes.shortstr },
            { name: FieldNames.appId, domain: FieldTypes.shortstr },
            { name: FieldNames.reserved, domain: FieldTypes.shortstr }
        ],
        methods: [
            methods.basicQos,
            methods.basicQosOk,
            methods.basicConsume,
            methods.basicConsumeOk,
            methods.basicCancel,
            methods.basicCancelOk,
            methods.basicPublish,
            methods.basicReturn,
            methods.basicDeliver,
            methods.basicGet,
            methods.basicGetOk,
            methods.basicGetEmpty,
            methods.basicAck,
            methods.basicReject,
            methods.basicRecoverAsync,
            methods.basicRecover,
            methods.basicRecoverOk,
            methods.basicNack
        ]
    },
    [ClassIds.confirm]: {
        name: ClassNames.confirm,
        index: ClassIds.confirm,
        fields: [],
        methods: [
            methods.confirmSelect,
            methods.confirmSelectOk
        ]
    },
    [ClassIds.tx]: {
        name: ClassNames.tx,
        index: ClassIds.tx,
        fields: [],
        methods: [
            methods.txSelect,
            methods.txSelectOk,
            methods.txCommit,
            methods.txCommitOk,
            methods.txRollback,
            methods.txRollbackOk
        ]
    }
};


type _<T> = T;
export type Merge<T> = _<{ [k in keyof T]: T[k] }>;
export type FieldsToRecord<T extends any[]> =
    T extends [infer Head]
        ? Head extends { name: FieldNames, domain: FieldTypes }
            ? { [K in `${Head['name']}`]: FieldTypeEquality[Head['domain']] }
            : never
    : T extends [infer Head, ...infer Tail]
        ? Head extends { name: FieldNames, domain: FieldTypes }
            ? Merge<{ [K in `${Head['name']}`]: FieldTypeEquality[Head['domain']] } & FieldsToRecord<Tail>>
            : never
        : Record<string, never>;

export type GenericMethodFrame = {
    type: FrameType.METHOD,
    name: MethodNames,
    method: MethodFrame['method'],
    args: MethodFrame['args']
}

export type SpecificMethodFrame<T> =
    T extends { name: "connectionStart", type: FrameType.METHOD } ? MethodFrameConnectionStart :
T extends { name: "connectionStartOk", type: FrameType.METHOD } ? MethodFrameConnectionStartOk :
T extends { name: "connectionSecure", type: FrameType.METHOD } ? MethodFrameConnectionSecure :
T extends { name: "connectionSecureOk", type: FrameType.METHOD } ? MethodFrameConnectionSecureOk :
T extends { name: "connectionTune", type: FrameType.METHOD } ? MethodFrameConnectionTune :
T extends { name: "connectionTuneOk", type: FrameType.METHOD } ? MethodFrameConnectionTuneOk :
T extends { name: "connectionOpen", type: FrameType.METHOD } ? MethodFrameConnectionOpen :
T extends { name: "connectionOpenOk", type: FrameType.METHOD } ? MethodFrameConnectionOpenOk :
T extends { name: "connectionClose", type: FrameType.METHOD } ? MethodFrameConnectionClose :
T extends { name: "connectionCloseOk", type: FrameType.METHOD } ? MethodFrameConnectionCloseOk :
T extends { name: "connectionBlocked", type: FrameType.METHOD } ? MethodFrameConnectionBlocked :
T extends { name: "connectionUnblocked", type: FrameType.METHOD } ? MethodFrameConnectionUnblocked :
T extends { name: "channelOpen", type: FrameType.METHOD } ? MethodFrameChannelOpen :
T extends { name: "channelOpenOk", type: FrameType.METHOD } ? MethodFrameChannelOpenOk :
T extends { name: "channelFlow", type: FrameType.METHOD } ? MethodFrameChannelFlow :
T extends { name: "channelFlowOk", type: FrameType.METHOD } ? MethodFrameChannelFlowOk :
T extends { name: "channelClose", type: FrameType.METHOD } ? MethodFrameChannelClose :
T extends { name: "channelCloseOk", type: FrameType.METHOD } ? MethodFrameChannelCloseOk :
T extends { name: "exchangeDeclare", type: FrameType.METHOD } ? MethodFrameExchangeDeclare :
T extends { name: "exchangeDeclareOk", type: FrameType.METHOD } ? MethodFrameExchangeDeclareOk :
T extends { name: "exchangeDelete", type: FrameType.METHOD } ? MethodFrameExchangeDelete :
T extends { name: "exchangeDeleteOk", type: FrameType.METHOD } ? MethodFrameExchangeDeleteOk :
T extends { name: "exchangeBind", type: FrameType.METHOD } ? MethodFrameExchangeBind :
T extends { name: "exchangeBindOk", type: FrameType.METHOD } ? MethodFrameExchangeBindOk :
T extends { name: "exchangeUnbind", type: FrameType.METHOD } ? MethodFrameExchangeUnbind :
T extends { name: "exchangeUnbindOk", type: FrameType.METHOD } ? MethodFrameExchangeUnbindOk :
T extends { name: "queueDeclare", type: FrameType.METHOD } ? MethodFrameQueueDeclare :
T extends { name: "queueDeclareOk", type: FrameType.METHOD } ? MethodFrameQueueDeclareOk :
T extends { name: "queueBind", type: FrameType.METHOD } ? MethodFrameQueueBind :
T extends { name: "queueBindOk", type: FrameType.METHOD } ? MethodFrameQueueBindOk :
T extends { name: "queueUnbind", type: FrameType.METHOD } ? MethodFrameQueueUnbind :
T extends { name: "queueUnbindOk", type: FrameType.METHOD } ? MethodFrameQueueUnbindOk :
T extends { name: "queuePurge", type: FrameType.METHOD } ? MethodFrameQueuePurge :
T extends { name: "queuePurgeOk", type: FrameType.METHOD } ? MethodFrameQueuePurgeOk :
T extends { name: "queueDelete", type: FrameType.METHOD } ? MethodFrameQueueDelete :
T extends { name: "queueDeleteOk", type: FrameType.METHOD } ? MethodFrameQueueDeleteOk :
T extends { name: "basicQos", type: FrameType.METHOD } ? MethodFrameBasicQos :
T extends { name: "basicQosOk", type: FrameType.METHOD } ? MethodFrameBasicQosOk :
T extends { name: "basicConsume", type: FrameType.METHOD } ? MethodFrameBasicConsume :
T extends { name: "basicConsumeOk", type: FrameType.METHOD } ? MethodFrameBasicConsumeOk :
T extends { name: "basicCancel", type: FrameType.METHOD } ? MethodFrameBasicCancel :
T extends { name: "basicCancelOk", type: FrameType.METHOD } ? MethodFrameBasicCancelOk :
T extends { name: "basicPublish", type: FrameType.METHOD } ? MethodFrameBasicPublish :
T extends { name: "basicReturn", type: FrameType.METHOD } ? MethodFrameBasicReturn :
T extends { name: "basicDeliver", type: FrameType.METHOD } ? MethodFrameBasicDeliver :
T extends { name: "basicGet", type: FrameType.METHOD } ? MethodFrameBasicGet :
T extends { name: "basicGetOk", type: FrameType.METHOD } ? MethodFrameBasicGetOk :
T extends { name: "basicGetEmpty", type: FrameType.METHOD } ? MethodFrameBasicGetEmpty :
T extends { name: "basicAck", type: FrameType.METHOD } ? MethodFrameBasicAck :
T extends { name: "basicReject", type: FrameType.METHOD } ? MethodFrameBasicReject :
T extends { name: "basicRecoverAsync", type: FrameType.METHOD } ? MethodFrameBasicRecoverAsync :
T extends { name: "basicRecover", type: FrameType.METHOD } ? MethodFrameBasicRecover :
T extends { name: "basicRecoverOk", type: FrameType.METHOD } ? MethodFrameBasicRecoverOk :
T extends { name: "basicNack", type: FrameType.METHOD } ? MethodFrameBasicNack :
T extends { name: "txSelect", type: FrameType.METHOD } ? MethodFrameTxSelect :
T extends { name: "txSelectOk", type: FrameType.METHOD } ? MethodFrameTxSelectOk :
T extends { name: "txCommit", type: FrameType.METHOD } ? MethodFrameTxCommit :
T extends { name: "txCommitOk", type: FrameType.METHOD } ? MethodFrameTxCommitOk :
T extends { name: "txRollback", type: FrameType.METHOD } ? MethodFrameTxRollback :
T extends { name: "txRollbackOk", type: FrameType.METHOD } ? MethodFrameTxRollbackOk :
T extends { name: "confirmSelect", type: FrameType.METHOD } ? MethodFrameConfirmSelect :
T extends { name: "confirmSelectOk", type: FrameType.METHOD } ? MethodFrameConfirmSelectOk :
        never;
