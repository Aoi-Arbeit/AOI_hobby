import { create } from 'zustand'
import api from './api'

export type Rates = Record<string, { bid: number; ask: number; mid: number; spread: number }>

export interface Position {
  id: string; symbol: string; side: 'buy' | 'sell'
  lot_size: number; leverage: number
  entry_price: number; current_price: number
  sl_price: number | null; tp_price: number | null
  unrealized_pnl: number; pips: number
  required_margin: number; opened_at: string
}

export interface Trade {
  id: string; symbol: string; side: 'buy' | 'sell'
  lot_size: number; leverage: number
  entry_price: number; exit_price: number
  net_pnl: number; pips_gained: number
  holding_duration_sec: number; close_reason: string
  slippage_pips: number; opened_at: string; closed_at: string
}

export interface Account {
  id: string; email: string; username: string
  balance: number; initial_balance: number
  equity: number; unrealized_pnl: number
  required_margin: number; margin_level: number
}

export interface Stats {
  total_trades: number; win_count: number; loss_count: number
  win_rate: number; total_pnl_jpy: number; roi: number
  profit_factor: number | null; max_drawdown: number
  expected_value_jpy: number; average_rr: number
}

interface FxStore {
  // Auth
  token: string | null
  setToken: (t: string | null) => void

  // Account
  account: Account | null
  fetchAccount: () => Promise<void>

  // Rates
  rates: Rates
  setRates: (r: Rates) => void
  selectedSymbol: string
  setSelectedSymbol: (s: string) => void
  selectedTimeframe: string
  setSelectedTimeframe: (tf: string) => void

  // Positions
  positions: Position[]
  fetchPositions: () => Promise<void>

  // Trades
  trades: Trade[]
  fetchTrades: () => Promise<void>

  // Stats
  stats: Stats | null
  fetchStats: () => Promise<void>

  // Economic Events
  economicEvents: any[]
  setEconomicEvents: (events: any[]) => void

  // Annotations
  annotations: any[]
  setAnnotations: (annotations: any[]) => void

  // WS connection status
  wsConnected: boolean
  setWsConnected: (v: boolean) => void
}

export const useStore = create<FxStore>((set, get) => ({
  token: localStorage.getItem('fx_token'),
  setToken: (t) => {
    if (t) localStorage.setItem('fx_token', t)
    else localStorage.removeItem('fx_token')
    set({ token: t })
  },

  account: null,
  fetchAccount: async () => {
    try {
      const { data } = await api.get('/account')
      set({ account: data })
    } catch { /* ignore */ }
  },

  rates: {},
  setRates: (r) => set({ rates: r }),
  selectedSymbol: 'USDJPY',
  setSelectedSymbol: (s) => set({ selectedSymbol: s }),
  selectedTimeframe: '1m',
  setSelectedTimeframe: (tf) => set({ selectedTimeframe: tf }),

  positions: [],
  fetchPositions: async () => {
    try {
      const { data } = await api.get('/positions')
      set({ positions: data })
    } catch { /* ignore */ }
  },

  trades: [],
  fetchTrades: async () => {
    try {
      const { data } = await api.get('/trades')
      set({ trades: data })
    } catch { /* ignore */ }
  },

  stats: null,
  fetchStats: async () => {
    try {
      const { data } = await api.get('/stats/summary')
      set({ stats: data })
    } catch { /* ignore */ }
  },

  economicEvents: [],
  setEconomicEvents: (events) => set({ economicEvents: events }),

  annotations: [],
  setAnnotations: (annotations) => set({ annotations }),

  wsConnected: false,
  setWsConnected: (v) => set({ wsConnected: v }),
}))
