const omit = require('lodash/omit');
const { MSError } = require('./utils/serialization');

// error data that is going to be copied
const copyErrorData = [
  'code', 'name', 'errors',
  'field', 'reason', 'stack',
];

/**
 * Wraps response error
 * @param {Error | Record<string, any>} originalError
 * @returns {Error}
 */
exports.wrapError = function wrapError(originalError) {
  if (originalError instanceof Error) {
    return originalError;
  }

  // this only happens in case of .toJSON on error object
  const error = new MSError(originalError.message);

  for (const fieldName of copyErrorData) {
    const mixedData = originalError[fieldName];
    if (mixedData !== undefined && mixedData !== null) {
      error[fieldName] = mixedData;
    }
  }

  return error;
};

/**
 * Set queue opts
 * @param  {Object} opts
 * @return {Object}
 */
exports.setQoS = function setQoS(opts) {
  const { neck, noAck } = opts;
  const output = omit(opts, ['neck', 'noAck']);

  if (typeof neck === 'undefined') {
    output.noAck = true;
  } else {
    output.noAck = noAck == null ? false : noAck;
    output.prefetchCount = neck > 0 ? neck : 0;
  }

  return output;
};
