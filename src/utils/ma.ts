import type { HistoryPoint } from '../types'

export type MARow = { date: string; close: number } & Record<string, number | null | string>

export function withMovingAverages(
  history: HistoryPoint[],
  windows: number[]
): MARow[] {
  const closes = history.map(h => h.close)
  return history.map((h, i) => {
    const row: MARow = { date: h.date, close: h.close }
    for (const w of windows) {
      if (i < w - 1) {
        row[`ma${w}`] = null
      } else {
        const slice = closes.slice(i - w + 1, i + 1)
        row[`ma${w}`] = slice.reduce((a, b) => a + b, 0) / w
      }
    }
    return row
  })
}
