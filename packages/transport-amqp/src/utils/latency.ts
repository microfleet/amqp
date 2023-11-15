/**
 * @param hrtime
 */
export function toMiliseconds(hrtime: [number, number]) {
  return (hrtime[0] * 1e3) + (Math.round(hrtime[1] / 1e3) / 1e3)
}

/**
 * @param time
 */
export function latency(time: number) {
  return Date.now() - time
}

export default latency
