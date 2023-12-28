import os from 'node:os'
import { getSystemErrorName } from 'node:util'
// @ts-expect-error no types
import ref from '@makeomatic/ref-napi'
// @ts-expect-error no types
import ffi from '@makeomatic/ffi-napi'

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

const errnoException = (errno: number, syscall: string) => {
  const errname = getSystemErrorName(errno)
  const err = new Error(`${syscall} ${errname} (${errno})`) as Error & { code: string, errno: number, syscall: string }

  err.code = errname
  err.errno = errno
  err.syscall = syscall

  return err
}

/**
 * Call the native 'setsockopt' API to set an integer socket option.
 * See: Unix man page for setsockopt(2).
 * @param {number} fd
 * @param {number} level
 * @param {number} name
 * @param {number} value
 * @returns {void}
 */
function setsockoptInt(fd: number, level: number, name: number, value: number): void {
  const valueRef = ref.alloc(cInt, value)
  const err = bindings.setsockopt(fd, level, name, valueRef, valueRef.type.size)

  if (err !== 0) {
    const errno = ffi.errno()
    throw errnoException(errno, 'getsockopt')
  }
}

export const setSocketReadBuffer = (fd: number, size: number) => {
  setsockoptInt(fd, SOL_SOCKET, SO_RCVBUF, size)
}

export const setSocketWriteBuffer = (fd: number, size: number) => {
  setsockoptInt(fd, SOL_SOCKET, SO_SNDBUF, size)
}
