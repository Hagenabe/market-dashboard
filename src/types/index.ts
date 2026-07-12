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

// ── Portfolio ─────────────────────────────────────────────────────────────────

export interface PortfolioStock {
  id: string
  name: string
  name_ja: string
  sector?: string
  macro_pairs?: string[]
  description?: string
  value: number
  change: number
  change_pct: number
  week_pct: number
  month_pct: number
  history: HistoryPoint[]
}

export interface PortfolioData {
  updated_at: string
  stocks: PortfolioStock[]
}

// ── Sector ────────────────────────────────────────────────────────────────────

export interface SectorStock {
  id: string
  name: string
  name_ja: string
  sector_ja: string
  value: number
  change: number
  change_pct: number
  week_pct: number
  month_pct: number
  history: HistoryPoint[]
  relative_1m?: number   // vs TOPIX (%)
  relative_1y?: number   // vs TOPIX (%)
}

export interface SectorData {
  updated_at: string
  sectors: SectorStock[]
}

// ── Correlations ──────────────────────────────────────────────────────────────

export interface CorrelationData {
  updated_at: string
  portfolio_ids: string[]
  macro_ids: string[]
  matrix: Record<string, Record<string, number | null>>
}
