import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend
} from 'recharts'
import { format, subMonths, subYears } from 'date-fns'
import type { MarketData, IndicatorHistory } from '../types'
import { fmtValue, fmtPct, colorClass, calcVolatility } from '../utils/format'
import { withMovingAverages } from '../utils/ma'

type Period = '1M' | '3M' | '6M' | '1Y' | '3Y'
const PERIODS: Period[] = ['1M', '3M', '6M', '1Y', '3Y']

const MA_WINDOWS = [20, 60, 200]
const MA_COLORS = ['#f59e0b', '#a78bfa', '#38bdf8']

export function IndicatorDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<MarketData | null>(null)
  const [history, setHistory] = useState<IndicatorHistory | null>(null)
  const [period, setPeriod] = useState<Period>('6M')
  const [showMAs, setShowMAs] = useState<number[]>([20, 60])

  useEffect(() => {
    fetch('./data/market_latest.json').then(r => r.json()).then(setData)
    if (id) {
      fetch(`./data/history/${id}.json`)
        .then(r => r.ok ? r.json() : null)
        .then(setHistory)
        .catch(() => null)
    }
  }, [id])

  const ind = data?.indicators.find(i => i.id === id)
  if (!ind) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center">
        <p className="text-neutral mb-4">読み込み中...</p>
        <button onClick={() => navigate('/')} className="text-sm text-slate-400 hover:text-slate-200">← 戻る</button>
      </div>
    </div>
  )

  // Build chart data
  const fullHistory = history?.history ?? ind.history
  const cutoff = periodCutoff(period)
  const filtered = fullHistory.filter(h => h.date >= cutoff)
  const chartData = withMovingAverages(filtered, showMAs)

  // Stats
  const closes = filtered.map(h => h.close)
  const max = Math.max(...closes)
  const min = Math.min(...closes)
  const avg = closes.reduce((a, b) => a + b, 0) / closes.length
  const vol = calcVolatility(closes)
  const ytd = fullHistory.find(h => h.date >= `${new Date().getFullYear()}-01-01`)
  const ytdPct = ytd ? (ind.value - ytd.close) / ytd.close * 100 : null
  const prevMonth = fullHistory[fullHistory.length - 31]
  const momPct = prevMonth ? (ind.value - prevMonth.close) / prevMonth.close * 100 : null

  const yDomain = (['auto', 'auto'] as [string, string])

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur border-b border-surface-border">
        <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-sm font-mono text-neutral hover:text-slate-200 transition-colors"
          >
            ← 戻る
          </button>
          <span className="text-surface-border">|</span>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-neutral tracking-widest">{id?.toUpperCase()}</span>
            <h1 className="text-sm font-semibold text-slate-200">{ind.name_ja}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-3 md:px-6 py-4 md:py-6">
        {/* Value hero */}
        <div className="mb-6">
          <p className="text-3xl font-mono font-bold text-slate-100 mb-1">
            {fmtValue(ind.value, ind.unit)}
            {ind.unit && <span className="text-base text-neutral ml-2">{ind.unit}</span>}
          </p>
          <div className="flex gap-4 font-mono text-sm">
            <span className={colorClass(ind.change_pct)}>
              {ind.change >= 0 ? '+' : ''}{ind.change.toFixed(2)} ({fmtPct(ind.change_pct)})
            </span>
            <span className="text-neutral">1W {fmtPct(ind.week_pct)}</span>
            <span className="text-neutral">1M {fmtPct(ind.month_pct)}</span>
            {ytdPct !== null && <span className="text-neutral">YTD {fmtPct(ytdPct)}</span>}
          </div>
          {ind.description && <p className="text-xs text-neutral mt-2">{ind.description}</p>}
        </div>

        {/* Chart card */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-5 mb-6">
          {/* Period + MA controls */}
          <div className="flex flex-wrap gap-2 md:gap-3 items-center mb-4">
            <div className="flex gap-1">
              {PERIODS.map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`text-xs font-mono px-3 py-1.5 rounded-lg transition-colors ${
                    period === p
                      ? 'bg-slate-600 text-slate-100'
                      : 'text-neutral hover:text-slate-200 hover:bg-surface'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <div className="flex gap-2 items-center">
              <span className="text-xs text-neutral">MA:</span>
              {MA_WINDOWS.map((w, i) => (
                <button
                  key={w}
                  onClick={() => setShowMAs(prev =>
                    prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w]
                  )}
                  className={`text-xs font-mono px-2.5 py-1 rounded-md transition-colors border ${
                    showMAs.includes(w)
                      ? `border-transparent text-slate-100`
                      : 'border-surface-border text-neutral'
                  }`}
                  style={showMAs.includes(w) ? { backgroundColor: MA_COLORS[i] + '33', color: MA_COLORS[i] } : {}}
                >
                  {w}日
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="#2a2d3a" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickFormatter={d => d.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={yDomain}
                tick={{ fontSize: 10, fill: '#64748b' }}
                width={60}
                tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(2)}
              />
              <Tooltip
                contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
                itemStyle={{ padding: '1px 0' }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 8 }} />
              <Line
                type="monotone"
                dataKey="close"
                name={ind.name}
                stroke="#6366f1"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              {MA_WINDOWS.map((w, i) =>
                showMAs.includes(w) ? (
                  <Line
                    key={w}
                    type="monotone"
                    dataKey={`ma${w}`}
                    name={`MA${w}`}
                    stroke={MA_COLORS[i]}
                    strokeWidth={1}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                ) : null
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: `最高値 (${period})`,  value: fmtValue(max, ind.unit) },
            { label: `最安値 (${period})`,  value: fmtValue(min, ind.unit) },
            { label: `平均値 (${period})`,  value: fmtValue(avg, ind.unit) },
            { label: `ボラティリティ(年率)`, value: vol.toFixed(1) + '%' },
            { label: '前月比',              value: momPct !== null ? fmtPct(momPct) : '—', colored: momPct },
            { label: '年初来騰落率',        value: ytdPct !== null ? fmtPct(ytdPct) : '—', colored: ytdPct },
            { label: '週次変化',            value: fmtPct(ind.week_pct), colored: ind.week_pct },
            { label: '月次変化',            value: fmtPct(ind.month_pct), colored: ind.month_pct },
          ].map(({ label, value, colored }) => (
            <div key={label} className="bg-surface-card border border-surface-border rounded-xl p-4">
              <p className="text-xs text-neutral mb-1">{label}</p>
              <p className={`text-base font-mono font-semibold ${colored !== undefined && colored !== null ? colorClass(colored) : 'text-slate-200'}`}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

function periodCutoff(period: Period): string {
  const now = new Date()
  let d: Date
  if (period === '1M') d = subMonths(now, 1)
  else if (period === '3M') d = subMonths(now, 3)
  else if (period === '6M') d = subMonths(now, 6)
  else if (period === '1Y') d = subYears(now, 1)
  else d = subYears(now, 3)
  return format(d, 'yyyy-MM-dd')
}
