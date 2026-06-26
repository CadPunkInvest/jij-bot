export interface BackgroundConfig {
  src: string
  opacity: number
  blur: number
  mode: 'cover' | 'contain' | 'tile'
  offsetX: number
  offsetY: number
}

export interface PanelConfig {
  id: string
  x: number
  y: number
  w: number
  h: number
  z: number
  visible: boolean
}

export interface SpriteConfig {
  id: string
  src: string
  x: number
  y: number
  xPct?: number
  yPct?: number
  scale: number
  frameWidth: number
  frameHeight: number
  frameCount: number
  fps: number
  loop: 'loop' | 'ping-pong' | 'once'
  visible: boolean
  z: number
}

export interface DesignConfig {
  version: number
  desktop: {
    background: BackgroundConfig
    panels: PanelConfig[]
    sprites: SpriteConfig[]
  }
  android: {
    background: BackgroundConfig
    tabOrder: string[]
    panelOrder: Record<string, string[]>
    sprites: SpriteConfig[]
  }
}

export const DEFAULT_DESIGN_CONFIG: DesignConfig = {
  version: 1,
  desktop: {
    background: { src: '', opacity: 0.85, blur: 2, mode: 'cover', offsetX: 0, offsetY: 0 },
    panels: [
      { id: 'DashboardPanel', x: 0, y: 0, w: 700, h: 400, z: 1, visible: true },
      { id: 'DCAPanel', x: 20, y: 420, w: 340, h: 280, z: 1, visible: true },
      { id: 'TaxReservePanel', x: 380, y: 420, w: 340, h: 280, z: 1, visible: true },
      { id: 'CapitalPanel', x: 740, y: 0, w: 300, h: 280, z: 1, visible: true },
      { id: 'PnLPanel', x: 740, y: 300, w: 300, h: 200, z: 1, visible: true },
      { id: 'ActivityLog', x: 20, y: 720, w: 720, h: 200, z: 1, visible: true },
    ],
    sprites: [],
  },
  android: {
    background: { src: '', opacity: 0.80, blur: 0, mode: 'cover', offsetX: 0, offsetY: 0 },
    tabOrder: ['Dashboard', 'Grid', 'DCA', 'Tax', 'Settings'],
    panelOrder: {
      Dashboard: ['PriceCard', 'BotStatusCard', 'HWMCard'],
      DCA: ['DCAStatusCard', 'DCAStatsCard'],
      Tax: ['TaxSummaryCard', 'TaxExportCard'],
    },
    sprites: [],
  },
}
