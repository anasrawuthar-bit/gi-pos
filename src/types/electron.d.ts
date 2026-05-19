export type PrinterInfo = {
  name: string
  displayName: string
  isDefault: boolean
  status?: number
}

export type ReceiptPrinterSettings = {
  mode: 'system' | 'network'
  deviceName: string
  ipAddress: string
  port: string
  paperWidth: '58' | '80'
}

export type LocalDbSnapshot = {
  engine: 'sqlite'
  path: string
  values: Record<string, string>
}

export type LocalDbWriteResult = {
  ok: boolean
  key?: string
  count?: number
  updatedAt: string
}

export type LocalDbSyncChange = {
  id: string
  entityType: string
  entityId: string
  operation: string
  payload: unknown
  createdAt: string
}

export type AppUpdateStatus = {
  state:
    | 'idle'
    | 'checking'
    | 'available'
    | 'downloading'
    | 'downloaded'
    | 'installing'
    | 'not-available'
    | 'disabled'
    | 'error'
  message: string
  version?: string
  latestVersion?: string
  updateUrl?: string
  updatedAt?: string
  percent?: number
  error?: string
}

declare global {
  interface Window {
    posPrinter?: {
      listPrinters: () => Promise<PrinterInfo[]>
      printReceipt: (payload: unknown) => Promise<{ ok: boolean; mode: string }>
      printTest: (settings: ReceiptPrinterSettings) => Promise<{ ok: boolean; mode: string }>
      printKot: (payload: unknown) => Promise<{ ok: boolean; mode: string }>
      printKotTest: (payload: unknown) => Promise<{ ok: boolean; mode: string }>
    }
    posDb?: {
      load: () => Promise<LocalDbSnapshot>
      set: (key: string, value: string) => Promise<LocalDbWriteResult>
      setMany: (entries: Array<{ key: string; value: string }>) => Promise<LocalDbWriteResult>
      getPendingSync: (limit?: number) => Promise<{ ok: boolean; changes: LocalDbSyncChange[] }>
      markSynced: (ids: string[]) => Promise<LocalDbWriteResult>
      clearPendingSync: () => Promise<LocalDbWriteResult>
      applyRemoteValues: (
        entries: Array<{ key: string; value: string; updatedAt?: string }>,
      ) => Promise<LocalDbWriteResult>
      resetAll: () => Promise<LocalDbWriteResult>
    }
    posUpdater?: {
      getStatus: () => Promise<AppUpdateStatus>
      check: () => Promise<AppUpdateStatus>
      install: () => Promise<AppUpdateStatus>
      onStatus: (callback: (status: AppUpdateStatus) => void) => () => void
    }
  }
}

export {}
