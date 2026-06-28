export function fmtValue(value: number, unit?: string): string {
  if (unit === '%') return value.toFixed(2) + '%'
  if (unit === 'USD/JPY') return value.toFixed(2)
  if (unit === 'EUR/USD') return value.toFixed(4)
  if (value >= 10000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (value >= 100) return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return value.toLocaleString('en-US', { maximumFractionDigits: 3 })
}

export function fmtChange(change: number, unit?: string): string {
  const sign = change >= 0 ? '+' : ''
  if (unit === '%') return sign + change.toFixed(2) + 'bp'
  return sign + fmtValue(change)
}

export function fmtPct(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return sign + pct.toFixed(2) + '%'
}

export function colorClass(v: number): string {
  if (v > 0) return 'text-up'
  if (v < 0) return 'text-down'
  return 'text-neutral'
}

export function bgColorClass(v: number): string {
  if (v > 0) return 'bg-up/10 text-up'
  if (v < 0) return 'bg-down/10 text-down'
  return 'bg-slate-800 text-neutral'
}

// Calculate moving average
export function movingAverage(data: number[], window: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < window - 1) return null
    const slice = data.slice(i - window + 1, i + 1)
    return slice.reduce((a, b) => a + b, 0) / window
  })
}

// Annualized volatility from daily returns
export function calcVolatility(closes: number[]): number {
  if (closes.length < 2) return 0
  const returns = closes.slice(1).map((c, i) => Math.log(c / closes[i]))
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1)
  return Math.sqrt(variance * 252) * 100  // annualized %
}
