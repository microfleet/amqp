import http = require('http')
import { debug as _debug } from '../config'
import { Connection } from '../connection'

const debug = _debug('amqp:plugins:rabbit')

export const masterNode = (
  connection: Connection, 
  queue: string, 
  callback: (err?: Error | null, success?: boolean) => void
) => {
  // only atempt if we have hosts
  if (connection.preparedHosts == null) {
    return callback()
  }

  // TODO let the api host and port be specifically configured
  const port = connection.activePort + 10000 // this is the default option, but should probably be configurable
  const vhost = encodeURIComponent(connection.connectionOptions.vhost)

  const requestOptions = {
    host: connection.activeHost,
    port,
    path: `/api/queues/${vhost}/${queue}`,
    method: 'GET',
    headers: {
      Host: connection.activeHost,
      Authorization: `Basic ${Buffer.from(`${connection.connectionOptions.login}:${connection.connectionOptions.password}`).toString('base64')}`,
    },
    agent: false,
  }

  const req = http.request(requestOptions, (res) => {
    if (res.statusCode === 404) {
      callback(null, true) // if our queue doesn't exist then master node doesn't matter
      return
    }

    res.setEncoding('utf8')
    let body = ''

    res.on('data', (chunk) => {
      body += chunk
    })

    res.on('end', () => {
      let response: any
      try {
        response = JSON.parse(body)
      } catch (e) {
        response = {}
      }

      if (!response.node) {
        debug(1, () => ['No .node in the api response,', response])
        // if we have no node information we doesn't really know what to do here
        callback(new Error('No response node'))
        return
      }

      let masternode = response.node.toLowerCase()
      if (masternode.indexOf('@') !== -1) {
        [, masternode] = masternode.split('@')
      }

      if (connection.connectionOptions.host === masternode) {
        callback(null, true)
        return
      }

      // connection.connectionOptions.hosts.hosts is set as toLowerCase in Connection
      for (const [i, host] of connection.preparedHosts.entries()) {
        if (host.host === masternode || (host.host.indexOf('.') !== -1 && host.host.split('.')[0] === masternode)) {
          connection.hosti = i
          connection.updateConnectionOptionsHostInformation()
          callback(null, true)
          return
        }
      }

      debug(1, () => `
        we can not connection to the master node, its not in our valid hosts.
        Master : ${masternode} Hosts : ${JSON.stringify(connection.preparedHosts)}
      `)
      callback(new Error("master node isn't in our hosts"))
    })
  })

  req.on('error', (e) => {
    return callback(e)
  })

  return req.end()
}
