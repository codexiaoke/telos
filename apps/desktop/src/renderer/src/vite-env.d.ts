/// <reference types="vite/client" />

interface TelosAppInfo {
  name: string
  version: string
  platform: string
}

interface Window {
  telos: {
    system: {
      getAppInfo: () => Promise<TelosAppInfo>
    }
  }
}
