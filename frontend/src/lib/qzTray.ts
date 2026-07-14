import qz from 'qz-tray'

export interface QZConnectionStatus {
  connected: boolean
  version: string | null
  availablePrinters: string[]
  error?: string
}

let connectionReady = false
let securityConfigured = false

function configureQZSecurity() {
  if (securityConfigured) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(qz as any).security.setCertificatePromise(
    (_resolve: (cert: string) => void, reject: (err: unknown) => void) => {
      try { _resolve('') } catch (e) { reject(e) }
    },
  )
  ;(qz as any).security.setSignatureAlgorithm('SHA512')
  ;(qz as any).security.setSignaturePromise((toSign: string) => {
    void toSign
    return (_resolve: (sig: string) => void, reject: (err: unknown) => void) => {
      try { _resolve('') } catch (e) { reject(e) }
    }
  })
  securityConfigured = true
}

export async function connectQZTray(): Promise<QZConnectionStatus> {
  if (connectionReady && qz.websocket.isActive()) {
    return { connected: true, version: qz.VERSION, availablePrinters: [] }
  }

  try {
    configureQZSecurity()
    await qz.websocket.connect()
    connectionReady = true
    return { connected: true, version: qz.VERSION, availablePrinters: [] }
  } catch (err) {
    connectionReady = false
    return {
      connected: false,
      version: null,
      availablePrinters: [],
      error: err instanceof Error ? err.message : 'QZ Tray no está activo, por favor inícielo',
    }
  }
}

export async function disconnectQZTray(): Promise<void> {
  if (qz.websocket.isActive()) {
    await qz.websocket.disconnect()
  }
  connectionReady = false
}

export async function getAvailablePrinters(): Promise<string[]> {
  try {
    if (!qz.websocket.isActive()) {
      configureQZSecurity()
      await qz.websocket.connect()
    }
    const printers = await qz.printers.find()
    return printers || []
  } catch {
    return []
  }
}

export async function findPrinterByName(name: string): Promise<string | null> {
  try {
    if (!qz.websocket.isActive()) {
      configureQZSecurity()
      await qz.websocket.connect()
    }
    const allPrinters = await qz.printers.find()
    const found = allPrinters?.find((p: string) => p.toLowerCase().includes(name.toLowerCase()))
    return found || null
  } catch {
    return null
  }
}

export async function printZPL(
  printerName: string,
  zplCommands: string[],
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!qz.websocket.isActive()) {
      configureQZSecurity()
      await qz.websocket.connect()
    }

    const config = qz.configs.create(printerName)

    const printData = zplCommands.map((zpl) => ({
      type: 'raw' as const,
      format: 'command' as const,
      flavor: 'plain' as const,
      data: zpl,
    }))

    await qz.print(config, printData)

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error enviando ZPL a la impresora',
    }
  }
}

export function isQZConnected(): boolean {
  return connectionReady && qz.websocket.isActive()
}
