const http = require('http');
const debug = require('../config').debug('amqp:plugins:rabbit');

module.exports = {
  masterNode(connection, queue, callback) {
    // only atempt if we have hosts
    if (connection.connectionOptions.hosts == null) {
      return callback();
    }

    // TODO let the api host and port be specifically configured
    const port = connection.connectionOptions.port + 10000; // this is the default option, but should probably be configurable
    const vhost = encodeURIComponent(connection.connectionOptions.vhost);

    const requestOptions = {
      host: connection.connectionOptions.host,
      port,
      path: `/api/queues/${vhost}/${queue}`,
      method: 'GET',
      headers: {
        Host: connection.connectionOptions.host,
        Authorization: `Basic ${Buffer.from(`${connection.connectionOptions.login}:${connection.connectionOptions.password}`).toString('base64')}`,
      },
      agent: false,
    };

    const req = http.request(requestOptions, (res) => {
      if (res.statusCode === 404) {
        callback(null, true); // if our queue doesn't exist then master node doesn't matter
        return;
      }

      res.setEncoding('utf8');
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        let response;
        try {
          response = JSON.parse(body);
        } catch (e) {
          response = {};
        }

        if (!response.node) {
          debug(1, () => ['No .node in the api response,', response]);
          // if we have no node information we doesn't really know what to do here
          callback(new Error('No response node'));
          return;
        }

        let masternode = response.node.toLowerCase();
        if (masternode.indexOf('@') !== -1) {
          [, masternode] = masternode.split('@');
        }

        if (connection.connectionOptions.host === masternode) {
          callback(null, true);
          return;
        }

        // connection.connectionOptions.hosts.hosts is set as toLowerCase in Connection
        for (const [i, host] of connection.connectionOptions.hosts.entries()) {
          if (host.host === masternode || (host.host.indexOf('.') !== -1 && host.host.split('.')[0] === masternode)) {
            connection.connectionOptions.hosti = i;
            connection.updateConnectionOptionsHostInformation();
            callback(null, true);
            return;
          }
        }

        debug(1, () => `we can not connection to the master node, its not in our valid hosts.  Master : ${masternode} Hosts : ${JSON.stringify(connection.connectionOptions.hosts)}`);
        callback(new Error("master node isn't in our hosts"));
      });
    });

    req.on('error', (e) => {
      return callback(e);
    });

    return req.end();
  },
};
