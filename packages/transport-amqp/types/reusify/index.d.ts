declare module 'reusify' {
  const reusify: <T>(ctor: (...args: any) => any) => {
    get(): T
    release(obj: T): void
  }
  
  export = reusify
}
