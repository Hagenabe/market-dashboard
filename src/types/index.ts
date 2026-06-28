export type Category = 'equity' | 'rates' | 'fx' | 'commodity' | 'risk' | 'energy'

export interface HistoryPoint {
  date: string   // YYYY-MM-DD
  close: number
}

export interface Indicator {
  id: string
  name: string
  name_ja: string
  category: Category
  unit?: string          // e.g. '%', 'USD/JPY', 'USD/bbl'
  value: number
  change: number
  change_pct: number
  week_pct: number
  month_pct: number
  ytd_pct?: number
  description?: string
  history: HistoryPoint[]  // last 30 days for sparkline
}

export interface MarketData {
  updated_at: string
  indicators: Indicator[]
}

// Detail page fetches this per-indicator
export interface IndicatorHistory {
  id: string
  history: HistoryPoint[]
}

export interface CommentEntry {
  time: string   // HH:MM
  text: string
}

export interface DayComment {
  date: string          // YYYY-MM-DD
  entries: CommentEntry[]
}
