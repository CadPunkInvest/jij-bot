import { registerPlugin } from '@capacitor/core'

interface EncryptedKeyStorePlugin {
  storeKey(options: { key: string }): Promise<void>
  clearKey(): Promise<void>
}

interface BotWorkerPlugin {
  start(): Promise<void>
  stop(): Promise<void>
}

const EncryptedKeyStore = registerPlugin<EncryptedKeyStorePlugin>('EncryptedKeyStore')
const BotWorkerBridge = registerPlugin<BotWorkerPlugin>('BotWorker')

export async function storeKeyForBackground(secretKey: Uint8Array): Promise<void> {
  const base64 = btoa(String.fromCharCode(...secretKey))
  await EncryptedKeyStore.storeKey({ key: base64 })
}

export async function clearKeyFromBackground(): Promise<void> {
  await EncryptedKeyStore.clearKey()
}

export async function startBackgroundWorker(): Promise<void> {
  await BotWorkerBridge.start()
}

export async function stopBackgroundWorker(): Promise<void> {
  await BotWorkerBridge.stop()
}
