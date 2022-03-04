import os = require('os')
import ref = require('ref-napi')
import ffi = require('ffi-napi')

let SOL_SOCKET: number
let SO_SNDBUF: number
let SO_RCVBUF: number

switch (os.platform()) {
  case 'linux':
    SOL_SOCKET = 1
    SO_SNDBUF = 7
    SO_RCVBUF = 8
    break

  case 'darwin':
    SOL_SOCKET = 0xffff
    SO_SNDBUF = 0x1001
    SO_RCVBUF = 0x1002
    break
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
function setsockoptInt(fd: number, level: number, name: number, value: number) {
  const valueRef = ref.alloc(cInt, value)
  // @ts-expect-error -- pointer types
  bindings.setsockopt(fd, level, name, valueRef, cInt.size)
}

export const setSocketReadBuffer = (fd: number, size: number) => {
  setsockoptInt(fd, SOL_SOCKET, SO_RCVBUF, size)
}

export const setSocketWriteBuffer = (fd: number, size: number) => {
  setsockoptInt(fd, SOL_SOCKET, SO_SNDBUF, size)
}
