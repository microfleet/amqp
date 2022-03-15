export class ConnectionResetError extends Error {
  public readonly code = 'CONNECTION_RESET'
  public readonly name = 'AMQPConnectionResetError'
  public readonly message = 'Channel Opening or Reseting'
}
