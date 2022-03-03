// Queues
const applyDefaults = require('lodash/defaults');
const { methods } = require('@microfleet/amqp-codec');
const debug = require('./config').debug('amqp:Queue');
const defaults = require('./defaults');

class Queue {
  // ###
  //   @args.name(required)
  //   @cb function required
  // ###
  constructor(channel, args, cb) {
    debug(3, () => ['New queue', JSON.stringify(args)]);

    if (!args.queue != null && args.name != null) {
      args.queue = args.name;
      delete args.name;
    }

    if (args.queue == null) {
      cb?.(new Error('args.queue is required'));
      return;
    }

    this.queueOptions = applyDefaults(args, defaults.queue);
    this.channel = channel;
    this.taskPush = channel.taskPush;

    if (cb) {
      setImmediate(cb, null, this);
    }
  }

  declare(args = {}, cb) {
    const queueNameSpecified = !!args.queue;

    let declareOptions;
    if (typeof args === 'function') {
      cb = args;
      args = {};
      declareOptions = this.queueOptions;
    } else {
      declareOptions = applyDefaults(args, this.queueOptions);
    }

    this.taskPush(methods.queueDeclare, declareOptions, methods.queueDeclareOk, (err, res) => {
      if (!queueNameSpecified && !err && res.queue != null) {
        this.queueOptions.queue = res.queue;
      }

      cb?.(err, res);
    });

    return this;
  }

  bind(exchange, routingKey, opts, cb) {
    let queueName;
    let args;

    if (typeof opts === 'function') {
      cb = opts;
      queueName = this.queueOptions.queue;
      args = {};
    } else if (typeof opts === 'string') {
      queueName = opts;
      args = {};
      // cb is either undefined or present, both are good opts
    } else if (opts !== null && typeof opts === 'object') {
      // neither string or function means its either
      args = opts.arguments || {};
      queueName = opts.queue || this.queueOptions.queue;
    } else {
      args = {};
      queueName = this.queueOptions.queue;
    }

    const queueBindOptions = {
      queue: queueName,
      exchange,
      routingKey,
      arguments: args,
    };

    this.taskPush(methods.queueBind, queueBindOptions, methods.queueBindOk, cb);

    return this;
  }

  unbind(exchange, routingKey, queueName, cb) {
    if (typeof queueName !== 'string') {
      cb = queueName;
      queueName = this.queueOptions.queue;
    }

    const queueUnbindOptions = {
      queue: queueName,
      exchange,
      routingKey,
      arguments: {},
    };

    this.taskPush(methods.queueUnbind, queueUnbindOptions, methods.queueUnbindOk, cb);

    return this;
  }

  messageCount(args = {}, cb) {
    if (typeof args === 'function') {
      cb = args;
      args = {};
    }

    const declareOptions = applyDefaults(args, this.queueOptions);

    return this.declare(declareOptions, (err, res) => {
      if (err) {
        cb(err);
        return;
      }

      if (res?.messageCount != null) {
        cb(null, res.messageCount);
      } else {
        cb(new Error('messageCount not returned'));
      }
    });
  }

  consumerCount(args = {}, cb) {
    if (typeof args === 'function') {
      cb = args;
      args = {};
    }

    const declareOptions = applyDefaults(args, this.queueOptions);

    return this.declare(declareOptions, (err, res) => {
      if (err) {
        cb(err);
        return;
      }

      if (res?.consumerCount != null) {
        cb(null, res.consumerCount);
      } else {
        cb(new Error('consumerCountconsumerCount not returned'));
      }
    });
  }

  delete(args = {}, cb) {
    if (typeof args === 'function') {
      cb = args;
      args = {};
    }

    const queueDeleteArgs = applyDefaults(args, defaults.queueDelete, { queue: this.queueOptions.queue });
    this.taskPush(methods.queueDelete, queueDeleteArgs, methods.queueDeleteOk, cb);

    return this;
  }
}

module.exports = Queue;
