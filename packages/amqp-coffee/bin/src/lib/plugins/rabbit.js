// Generated by CoffeeScript 2.6.1
(function() {
  var debug, http;

  debug = require('../config').debug('amqp:plugins:rabbit');

  http = require('http');

  module.exports = {
    masterNode: function(connection, queue, callback) {
      var host, port, req, requestOptions, vhost;
      if (connection.connectionOptions.hosts == null) {
        return callback();
      }
      //TODO let the api host and port be specifically configured
      host = connection.connectionOptions.host;
      port = connection.connectionOptions.port + 10000; // this is the default option, but should probably be configurable
      vhost = encodeURIComponent(connection.connectionOptions.vhost);
      requestOptions = {
        host: host,
        port: port,
        path: `/api/queues/${vhost}/${queue}`,
        method: 'GET',
        headers: {
          Host: host,
          Authorization: 'Basic ' + Buffer.from(connection.connectionOptions.login + ':' + connection.connectionOptions.password).toString('base64')
        },
        agent: false
      };
      req = http.request(requestOptions, function(res) {
        var body;
        if (res.statusCode === 404) {
          return callback(null, true); // if our queue doesn't exist then master node doesn't matter
        }
        res.setEncoding('utf8');
        body = "";
        res.on('data', function(chunk) {
          return body += chunk;
        });
        return res.on('end', function() {
          var e, i, j, len, masternode, ref, response;
          try {
            response = JSON.parse(body);
          } catch (error) {
            e = error;
            response = {};
          }
          if (response.node == null) {
            debug(1, function() {
              return ["No .node in the api response,", response];
            });
            return callback("No response node"); // if we have no node information we doesn't really know what to do here
          }
          if (response.node.indexOf('@') !== -1) {
            masternode = response.node.split('@')[1];
          }
          masternode = masternode.toLowerCase();
          if (connection.connectionOptions.host === masternode) {
            return callback(null, true);
          }
          ref = connection.connectionOptions.hosts;
          // connection.connectionOptions.hosts.hosts is set as toLowerCase in Connection
          for (i = j = 0, len = ref.length; j < len; i = ++j) {
            host = ref[i];
            if (host.host === masternode || (host.host.indexOf('.') !== -1 && host.host.split('.')[0] === masternode)) {
              connection.connectionOptions.hosti = i;
              connection.updateConnectionOptionsHostInformation();
              return callback(null, true);
            }
          }
          debug(1, function() {
            return `we can not connection to the master node, its not in our valid hosts.  Master : ${masternode} Hosts : ${JSON.stringify(connection.connectionOptions.hosts)}`;
          });
          return callback("master node isn't in our hosts");
        });
      });
      req.on('error', function(e) {
        return callback(e);
      });
      return req.end();
    }
  };

}).call(this);
