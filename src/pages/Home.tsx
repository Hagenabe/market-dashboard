import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import type { MarketData, Category, DayComment } from '../types'
import { CategorySection } from '../components/CategorySection'
import { CorrelationPanel } from '../components/CorrelationPanel'
import { MemoEditor } from '../components/MemoEditor'
import { MarketSummary } from '../components/MarketSummary'
import { fmtPct, colorClass } from '../utils/format'

const CATEGORY_ORDER: Category[] = ['equity', 'rates', 'fx', 'commodity', 'risk', 'energy']

const NAV_LABELS: Record<Category, string> = {
  equity: 'Equity', rates: 'Rates', fx: 'FX',
  commodity: 'Commodity', risk: 'Risk', energy: 'Energy',
}

export function Home() {
  const [data, setData] = useState<MarketData | null>(null)
  const [comment, setComment] = useState<DayComment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    fetch('./data/market_latest.json')
      .then(r => { if (!r.ok) throw new Error('data not found'); return r.json() })
      .then(setData)
      .catch(() => setError('market_latest.json が見つかりません。scripts/fetch_market_data.py を実行してください。'))

    fetch(`./data/comments/${today}.json`)
      .then(r => r.ok ? r.json() : null)
      .then(setComment)
      .catch(() => null)
  }, [today])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (error) return <ErrorScreen message={error} />

  return (
    <div className="min-h-screen bg-surface">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur border-b border-surface-border">
        <div className="max-w-screen-xl mx-auto px-4 md:px-6 h-12 md:h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-mono font-semibold text-slate-200 tracking-wider">MARKET</span>
            {/* PC nav */}
            <nav className="hidden md:flex gap-1">
              {CATEGORY_ORDER.map(c => (
                <button
                  key={c}
                  onClick={() => scrollTo(c)}
                  className="text-xs font-mono px-3 py-1.5 rounded-md text-neutral hover:text-slate-200 hover:bg-surface-card transition-colors"
                >
                  {NAV_LABELS[c]}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 md:gap-4 text-xs font-mono text-neutral">
            {data && (
              <>
                <span className="hidden md:inline">更新: {data.updated_at.slice(0, 16).replace('T', ' ')}</span>
                <MarketPulse indicators={data.indicators} />
              </>
            )}
          </div>
        </div>
        {/* Mobile category nav — horizontally scrollable */}
        <nav className="md:hidden flex gap-2 px-4 pb-2 overflow-x-auto scrollbar-none">
          {CATEGORY_ORDER.map(c => (
            <button
              key={c}
              onClick={() => scrollTo(c)}
              className="text-xs font-mono shrink-0 px-3 py-1 rounded-full bg-surface-card border border-surface-border text-neutral active:bg-slate-700 transition-colors"
            >
              {NAV_LABELS[c]}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-screen-xl mx-auto px-3 md:px-6 py-4 md:py-6">
        {/* Market pulse strip */}
        {data && <PulseStrip indicators={data.indicators} />}

        {/* Summary */}
        {data && <MarketSummary indicators={data.indicators} comment={comment} date={today} />}

        {/* Category sections */}
        {data && CATEGORY_ORDER.map(cat => (
          <CategorySection
            key={cat}
            category={cat}
            indicators={data.indicators.filter(i => i.category === cat)}
          />
        ))}

        {/* Relations */}
        {data && <CorrelationPanel indicators={data.indicators} />}

        {/* Memo */}
        <MemoEditor comment={comment} date={today} inputOnly />
      </main>
    </div>
  )
}

// ── Sub components ──

function PulseStrip({ indicators }: { indicators: MarketData['indicators'] }) {
  const key = ['sp500', 'nikkei', 'usdjpy', 'gold', 'us10y', 'vix']
  const items = key.map(id => indicators.find(i => i.id === id)).filter(Boolean)
  return (
    <div className="flex gap-6 overflow-x-auto pb-2 mb-8 border-b border-surface-border text-xs font-mono">
      {items.map(ind => ind && (
        <div key={ind.id} className="shrink-0">
          <span className="text-neutral mr-2">{ind.name}</span>
          <span className="text-slate-200 mr-1">{ind.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
          <span className={colorClass(ind.change_pct)}>{fmtPct(ind.change_pct)}</span>
        </div>
      ))}
    </div>
  )
}

function MarketPulse({ indicators }: { indicators: MarketData['indicators'] }) {
  const sp = indicators.find(i => i.id === 'sp500')
  if (!sp) return null
  return (
    <span className={`px-2 py-0.5 rounded ${sp.change_pct >= 0 ? 'bg-up/10 text-up' : 'bg-down/10 text-down'}`}>
      {sp.change_pct >= 0 ? '▲' : '▼'} S&P {fmtPct(sp.change_pct)}
    </span>
  )
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center max-w-lg px-6">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-slate-300 mb-4">{message}</p>
        <pre className="text-left text-xs bg-surface-card border border-surface-border rounded-xl p-4 text-slate-400 leading-relaxed">
{`# セットアップ手順
cd market-dashboard
pip install -r scripts/requirements.txt

# .env に FRED_API_KEY を設定（任意）
cp .env.example .env

# データ取得
python scripts/fetch_market_data.py`}
        </pre>
      </div>
    </div>
  )
}
