import type { Category, Indicator } from '../types'
import { MarketCard } from './MarketCard'

const LABELS: Record<Category, { en: string; ja: string; icon: string }> = {
  equity:    { en: 'EQUITY',    ja: '株式インデックス',   icon: '📈' },
  rates:     { en: 'RATES',     ja: '金利',               icon: '📊' },
  fx:        { en: 'FX',        ja: '為替',               icon: '💱' },
  commodity: { en: 'COMMODITY', ja: 'コモディティ',       icon: '🛢️' },
  risk:      { en: 'RISK',      ja: 'リスク指標',         icon: '⚡' },
  energy:    { en: 'ENERGY',    ja: 'エネルギー',         icon: '⚡' },
}

interface Props {
  category: Category
  indicators: Indicator[]
}

export function CategorySection({ category, indicators }: Props) {
  if (indicators.length === 0) return null
  const { en, ja, icon } = LABELS[category]

  return (
    <section id={en.toLowerCase()} className="mb-10 scroll-mt-20">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-lg">{icon}</span>
        <h2 className="text-xs font-mono tracking-[0.2em] text-neutral uppercase">{en}</h2>
        <span className="text-sm text-slate-400">{ja}</span>
        <div className="flex-1 border-t border-surface-border ml-2" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {indicators.map(ind => (
          <MarketCard key={ind.id} indicator={ind} />
        ))}
      </div>
    </section>
  )
}
