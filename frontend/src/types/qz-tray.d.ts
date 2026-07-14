declare module 'qz-tray' {
  export interface QZPrinters {
    find: (query?: string) => Promise<string[]>
    getDefault: () => Promise<string | null>
  }

  export interface Config {
    getPrinter: () => string
    getOptions: () => Record<string, unknown>
  }

  export interface QZConfig {
    create: (printer: string, options?: Record<string, unknown>) => Config
  }

  export interface PrintData {
    type: 'raw' | 'pixel'
    format: 'command' | 'html' | 'image' | 'pdf'
    flavor: 'plain' | 'base64' | 'file' | 'hex'
    data: string
  }

  export interface QZPrint {
    (config: Config, data: PrintData[]): Promise<void>
  }

  export interface ConnectOptions {
    host?: string | string[]
    port?: { secure?: number[]; insecure?: number[] }
    usingSecure?: boolean
    keepAlive?: number
    retries?: number
    delay?: number
  }

  export interface QZWebsocket {
    connect: (options?: ConnectOptions) => Promise<void>
    disconnect: () => Promise<void>
    isActive: () => boolean
  }

  const qz: {
    VERSION: string
    printers: QZPrinters
    configs: QZConfig
    print: QZPrint
    websocket: QZWebsocket
  }

  export default qz
}
