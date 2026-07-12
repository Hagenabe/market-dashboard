import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend
} from 'recharts'
import { format, subMonths, subYears } from 'date-fns'
import type { PortfolioData, CorrelationData, HistoryPoint } from '../types'
import { fmtPct, colorClass } from '../utils/format'

type Period = '1M' | '3M' | '6M' | '1Y'
const PERIODS: Period[] = ['1M', '3M', '6M', '1Y']

const MACRO_LABELS: Record<string, string> = {
  wti: 'WTI原油', us10y: '米10Y金利', usdjpy: 'USD/JPY',
  gold: '金', nikkei: '日経平均', nasdaq100: 'NASDAQ',
}

const LINE_COLORS = ['#6366f1', '#f59e0b', '#22c55e', '#f87171', '#38bdf8']

function periodCutoff(period: Period): string {
  const now = new Date()
  let d: Date
  if (period === '1M') d = subMonths(now, 1)
  else if (period === '3M') d = subMonths(now, 3)
  else if (period === '6M') d = subMonths(now, 6)
  else d = subYears(now, 1)
  return format(d, 'yyyy-MM-dd')
}

function normalize(data: HistoryPoint[], cutoff: string): Array<{ date: string; value: number }> {
  const filtered = data.filter(d => d.date >= cutoff)
  if (filtered.length === 0) return []
  const base = filtered[0].close
  if (base === 0) return []
  return filtered.map(d => ({
    date: d.date,
    value: Math.round((d.close / base) * 10000) / 100,
  }))
}

function corrClass(v: number | null): string {
  if (v === null) return 'text-neutral'
  if (v > 0.6)  return 'text-up font-bold'
  if (v > 0.3)  return 'text-green-400'
  if (v < -0.6) return 'text-down font-bold'
  if (v < -0.3) return 'text-orange-400'
  return 'text-slate-400'
}

function corrBg(v: number | null): string {
  if (v === null) return ''
  if (v > 0.6)  return 'bg-up/10'
  if (v > 0.3)  return 'bg-green-900/20'
  if (v < -0.6) return 'bg-down/10'
  if (v < -0.3) return 'bg-orange-900/20'
  return ''
}

export function PortfolioPage() {
  const navigate = useNavigate()
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null)
  const [corrData, setCorrData] = useState<CorrelationData | null>(null)
  const [selectedStock, setSelectedStock] = useState<string>('')
  const [period, setPeriod] = useState<Period>('6M')
  const [overlayData, setOverlayData] = useState<Array<Record<string, number | string>>>([])
  const histCacheRef = useRef<Record<string, HistoryPoint[]>>({})

  useEffect(() => {
    fetch('./data/portfolio_latest.json')
      .then(r => r.ok ? r.json() : null)
      .then((d: PortfolioData | null) => {
        setPortfolioData(d)
        if (d?.stocks?.length) setSelectedStock(d.stocks[0].id)
      })
      .catch(() => null)

    fetch('./data/correlations.json')
      .then(r => r.ok ? r.json() : null)
      .then(setCorrData)
      .catch(() => null)
  }, [])

  // Build normalized overlay chart whenever stock/period changes
  useEffect(() => {
    if (!selectedStock || !portfolioData) return
    const stock = portfolioData.stocks.find(s => s.id === selectedStock)
    if (!stock) return

    const ids = [selectedStock, ...(stock.macro_pairs ?? [])]
    const cutoff = periodCutoff(period)

    const fetchHist = async (id: string): Promise<HistoryPoint[]> => {
      if (histCacheRef.current[id]) return histCacheRef.current[id]
      try {
        const r = await fetch(`./data/history/${id}.json`)
        if (!r.ok) return []
        const j = await r.json()
        histCacheRef.current[id] = j.history as HistoryPoint[]
        return histCacheRef.current[id]
      } catch {
        return []
      }
    }

    Promise.all(ids.map(fetchHist)).then(allHists => {
      const dateMap: Record<string, Record<string, number>> = {}
      ids.forEach((id, i) => {
        normalize(allHists[i], cutoff).forEach(({ date, value }) => {
          if (!dateMap[date]) dateMap[date] = {}
          dateMap[date][id] = value
        })
      })
      const rows = Object.entries(dateMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({ date, ...vals }))
      setOverlayData(rows)
    })
  }, [selectedStock, period, portfolioData])

  const stocks = portfolioData?.stocks ?? []
  const selectedStockDef = stocks.find(s => s.id === selectedStock)
  const macroIds = corrData?.macro_ids ?? []

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur border-b border-surface-border">
        <div className="max-w-screen-xl mx-auto px-4 md:px-6 h-14 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-sm font-mono text-neutral hover:text-slate-200 transition-colors"
          >
            ← ホーム
          </button>
          <span className="text-surface-border">|</span>
          <span className="text-sm font-semibold text-slate-200">📊 マイポートフォリオ</span>
          {portfolioData && (
            <span className="text-xs font-mono text-neutral ml-auto">
              更新: {portfolioData.updated_at.slice(0, 16).replace('T', ' ')}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-3 md:px-6 py-4 md:py-6">

        {/* ── Stock cards ── */}
        {stocks.length === 0 ? (
          <div className="text-center py-20 text-neutral text-sm">
            <p className="mb-2">portfolio_latest.json が見つかりません。</p>
            <p className="text-xs">scripts/fetch_market_data.py を実行してください。</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-8">
              {stocks.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStock(s.id)}
                  className={`text-left p-4 rounded-xl border transition-colors ${
                    s.id === selectedStock
                      ? 'bg-slate-700/50 border-slate-500'
                      : 'bg-surface-card border-surface-border hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs font-mono text-neutral">{s.sector}</p>
                      <p className="text-sm font-semibold text-slate-200 mt-0.5">{s.name_ja}</p>
                    </div>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${
                      s.change_pct >= 0
                        ? 'text-up border-up/30 bg-up/10'
                        : 'text-down border-down/30 bg-down/10'
                    }`}>
                      {s.change_pct >= 0 ? '+' : ''}{s.change_pct.toFixed(2)}%
                    </span>
                  </div>

                  <p className="text-xl font-mono font-bold text-slate-100 mb-2">
                    {s.value.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}
                    <span className="text-xs text-neutral ml-1">円</span>
                  </p>

                  <div className="flex gap-3 text-xs font-mono text-neutral mb-2">
                    <span>1W <span className={colorClass(s.week_pct)}>{fmtPct(s.week_pct)}</span></span>
                    <span>1M <span className={colorClass(s.month_pct)}>{fmtPct(s.month_pct)}</span></span>
                  </div>

                  {s.macro_pairs && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {s.macro_pairs.map(mp => (
                        <span key={mp} className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {MACRO_LABELS[mp] ?? mp}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* ── Macro overlay chart ── */}
            <section className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xs font-mono tracking-widest text-neutral uppercase">
                  📈 マクロ連動チャート
                </h2>
                <span className="text-xs text-neutral">
                  {selectedStockDef?.name_ja} vs {selectedStockDef?.macro_pairs?.map(mp => MACRO_LABELS[mp] ?? mp).join(' / ')}
                </span>
              </div>

              <div className="bg-surface-card border border-surface-border rounded-xl p-5">
                {/* Period + legend */}
                <div className="flex flex-wrap items-center gap-3 mb-3">
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
                  <div className="flex gap-4 text-xs font-mono text-neutral">
                    {[selectedStock, ...(selectedStockDef?.macro_pairs ?? [])].map((id, i) => (
                      <span key={id} className="flex items-center gap-1">
                        <span
                          className="w-4 h-0.5 inline-block rounded"
                          style={{ backgroundColor: LINE_COLORS[i] }}
                        />
                        {i === 0 ? (selectedStockDef?.name_ja ?? id) : (MACRO_LABELS[id] ?? id)}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-neutral mb-4">選択期間の始点を100に正規化して比較</p>

                {overlayData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={overlayData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid stroke="#2a2d3a" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickFormatter={d => (d as string).slice(5)}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={['auto', 'auto']}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        width={48}
                        tickFormatter={(v: number) => v.toFixed(0)}
                      />
                      <Tooltip
                        contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 11 }}
                        formatter={(v: unknown) => [`${(v as number).toFixed(1)}`, undefined]}
                        labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 8 }} />
                      {[selectedStock, ...(selectedStockDef?.macro_pairs ?? [])].map((id, i) => (
                        <Line
                          key={id}
                          type="monotone"
                          dataKey={id}
                          name={i === 0 ? (selectedStockDef?.name_ja ?? id) : (MACRO_LABELS[id] ?? id)}
                          stroke={LINE_COLORS[i]}
                          strokeWidth={i === 0 ? 2 : 1.5}
                          dot={false}
                          connectNulls
                          isAnimationActive={false}
                        />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-60 flex items-center justify-center text-neutral text-sm">
                    履歴データを読み込み中...
                  </div>
                )}
              </div>
            </section>

            {/* ── Correlation heatmap ── */}
            {corrData && Object.keys(corrData.matrix).length > 0 && (
              <section>
                <h2 className="text-xs font-mono tracking-widest text-neutral uppercase mb-4">
                  🔗 相関ヒートマップ（日次リターン、過去3年）
                </h2>
                <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="border-b border-surface-border">
                          <th className="text-left px-4 py-3 text-neutral font-normal whitespace-nowrap">銘柄</th>
                          {macroIds.map(mid => (
                            <th key={mid} className="px-3 py-3 text-center text-neutral font-normal whitespace-nowrap">
                              {MACRO_LABELS[mid] ?? mid}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {stocks.map((s, i) => (
                          <tr
                            key={s.id}
                            className={`border-b border-surface-border/40 cursor-pointer transition-colors ${
                              s.id === selectedStock ? 'bg-slate-700/30' : i % 2 === 1 ? 'bg-slate-900/20' : ''
                            }`}
                            onClick={() => setSelectedStock(s.id)}
                          >
                            <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">{s.name_ja}</td>
                            {macroIds.map(mid => {
                              const v = corrData.matrix[s.id]?.[mid] ?? null
                              return (
                                <td
                                  key={mid}
                                  className={`px-3 py-2.5 text-center ${corrClass(v)} ${corrBg(v)}`}
                                >
                                  {v !== null ? v.toFixed(2) : '—'}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Legend */}
                  <div className="px-4 py-2.5 border-t border-surface-border flex flex-wrap gap-3 text-xs">
                    <span className="text-up">■ &gt;0.6 強正相関</span>
                    <span className="text-green-400">■ 0.3〜0.6 正相関</span>
                    <span className="text-slate-400">■ 無相関</span>
                    <span className="text-orange-400">■ -0.6〜-0.3 負相関</span>
                    <span className="text-down">■ &lt;-0.6 強負相関</span>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
