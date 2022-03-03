// Exchange
const { methods } = require('@microfleet/amqp-codec');
const applyDefaults = require('lodash/defaults');
const defaults = require('./defaults');

class Exchange {
  constructor(channel, args, cb) {
    if (args.exchange == null && args.name != null) {
      args.exchange = args.name;
      delete args.name;
    }

    if (args.exchange == null) {
      cb?.(new Error('args.exchange is requried'));
      return;
    }

    this.exchangeOptions = applyDefaults(args, defaults.exchange);
    this.channel = channel;
    this.taskPush = channel.taskPush;

    cb?.(null, this);
  }

  declare(args, cb) {
    let declareOptions;
    if (args == null && cb == null) {
      declareOptions = this.exchangeOptions;
    } else if (typeof args === 'function') {
      cb = args;
      args = {};
      declareOptions = this.exchangeOptions;
    } else {
      declareOptions = applyDefaults(args, this.exchangeOptions);
    }

    this.taskPush(methods.exchangeDeclare, declareOptions, methods.exchangeDeclareOk, cb);
    return this;
  }

  delete(args, cb) {
    if (typeof args === 'function') {
      cb = args;
      args = {};
    }

    const exchangeDeleteOptions = applyDefaults(
      args,
      defaults.exchangeDelete,
      { exchange: this.exchangeOptions.exchange }
    );

    this.taskPush(methods.exchangeDelete, exchangeDeleteOptions, methods.exchangeDeleteOk, cb);

    return this;
  }

  bind(destExchange, routingKey, sourceExchange, cb) {
    const sourceExchangeName = typeof sourceExchange === 'string'
      ? sourceExchange
      : this.exchangeOptions.exchange;

    if (typeof sourceExchange === 'function') {
      cb = sourceExchange;
    }

    const exchangeBindOptions = {
      destination: destExchange,
      source: sourceExchangeName,
      routingKey,
      arguments: {},
    };

    this.taskPush(methods.exchangeBind, exchangeBindOptions, methods.exchangeBindOk, cb);
    return this;
  }

  unbind(destExchange, routingKey, sourceExchange, cb) {
    let sourceExchangeName;
    if (typeof sourceExchange === 'string') {
      sourceExchangeName = sourceExchange;
    } else {
      cb = sourceExchange;
      sourceExchangeName = this.exchangeOptions.exchange;
    }

    const exchangeUnbindOptions = {
      destination: destExchange,
      source: sourceExchangeName,
      routingKey,
      arguments: {},
    };

    this.taskPush(methods.exchangeUnbind, exchangeUnbindOptions, methods.exchangeUnbindOk, cb);
    return this;
  }
}

module.exports = Exchange;
