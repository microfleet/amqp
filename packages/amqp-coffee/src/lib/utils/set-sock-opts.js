/** eslint-disable **/
const os = require('os')
const ref = require('ref-napi')
const ffi = require('ffi-napi')

let SOL_SOCKET
let SO_SNDBUF
let SO_RCVBUF

switch (os.platform()) {
  case 'linux':
    SOL_SOCKET = 1
    SO_SNDBUF = 7
    SO_RCVBUF = 8
    break;

  case 'darwin':
    SOL_SOCKET = 0xffff
    SO_SNDBUF = 0x1001
    SO_RCVBUF = 0x1002
    break;
}

const cInt = ref.types.int
const cVoid = ref.types.void
const bindings = ffi.Library(null, {
    setsockopt: [cInt, [cInt, cInt, cInt, ref.refType(cVoid), cInt]],
})

/**
 * Call the native 'setsockopt' API to set an integer socket option.
 * See: Unix man page for setsockopt(2).
 * @param {number} fd
 * @param {number} level
 * @param {number} name
 * @param {number} value
 * @returns {void}
 */
function setsockoptInt(fd, level, name, value) {
  const valueRef = ref.alloc(cInt, value)
  bindings.setsockopt(fd, level, name, valueRef, cInt.size)
}

exports.setSocketReadBuffer = (fd, size) => {
  setsockoptInt(fd, SOL_SOCKET, SO_RCVBUF, size)
}

exports.setSocketWriteBuffer = (fd, size) => {
  setsockoptInt(fd, SOL_SOCKET, SO_SNDBUF, size)
}
