import type { Indicator } from '../types'
import { fmtPct, colorClass } from '../utils/format'

// Simple "rate → equity → fx → commodity" relationship display
interface RelationRow {
  label: string
  a_id: string
  b_id: string
  note: string
}

const RELATIONS: RelationRow[] = [
  { label: '米10年金利 × S&P500',    a_id: 'us10y',   b_id: 'sp500',    note: '金利上昇 → 株式PER圧縮。逆相関が基本だが景気期待局面では順相関も' },
  { label: '米10年金利 × USD/JPY',   a_id: 'us10y',   b_id: 'usdjpy',   note: '日米金利差が拡大するとドル高・円安。日銀政策との組み合わせに注意' },
  { label: 'USD/JPY × 金',           a_id: 'usdjpy',  b_id: 'gold',     note: 'ドル安→金高が基本。ドル建て資産なので逆相関しやすい' },
  { label: '金 × プラチナ 価格比',   a_id: 'gold',    b_id: 'platinum', note: '金/白金比が高いほど白金が割安。景気回復期は比率が縮小する傾向' },
  { label: '米10年-2年スプレッド',   a_id: 'us10y',   b_id: 'us2y',     note: 'マイナス（逆イールド）は景気後退の先行指標として参照される' },
]

interface Props {
  indicators: Indicator[]
}

export function CorrelationPanel({ indicators }: Props) {
  const byId = Object.fromEntries(indicators.map(i => [i.id, i]))

  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xs font-mono tracking-[0.2em] text-neutral uppercase">RELATIONS</h2>
        <span className="text-sm text-slate-400">指標間の関係</span>
        <div className="flex-1 border-t border-surface-border ml-2" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {RELATIONS.map(rel => {
          const a = byId[rel.a_id]
          const b = byId[rel.b_id]
          if (!a || !b) return null

          // Spread case
          if (rel.a_id === 'us10y' && rel.b_id === 'us2y') {
            const spread = a.value - b.value
            return (
              <RelCard key={rel.label} label={rel.label} note={rel.note}>
                <div className="flex gap-6 font-mono text-sm">
                  <Stat label="10Y" value={a.value} unit="%" />
                  <Stat label="2Y" value={b.value} unit="%" />
                  <div>
                    <p className="text-xs text-neutral">スプレッド</p>
                    <p className={`font-semibold ${spread < 0 ? 'text-down' : 'text-up'}`}>
                      {spread >= 0 ? '+' : ''}{spread.toFixed(2)}bp
                    </p>
                    {spread < 0 && <p className="text-xs text-down">⚠️ 逆イールド中</p>}
                  </div>
                </div>
              </RelCard>
            )
          }

          // Gold/Platinum ratio
          if (rel.a_id === 'gold' && rel.b_id === 'platinum') {
            const ratio = a.value / b.value
            return (
              <RelCard key={rel.label} label={rel.label} note={rel.note}>
                <div className="flex gap-6 font-mono text-sm">
                  <Stat label="Gold" value={a.value} unit="$" pct={a.change_pct} />
                  <Stat label="Platinum" value={b.value} unit="$" pct={b.change_pct} />
                  <div>
                    <p className="text-xs text-neutral">比率(Au/Pt)</p>
                    <p className="font-semibold text-slate-200">{ratio.toFixed(2)}x</p>
                    <p className="text-xs text-neutral">{ratio > 2 ? 'Pt割安域' : 'Pt割高域'}</p>
                  </div>
                </div>
              </RelCard>
            )
          }

          return (
            <RelCard key={rel.label} label={rel.label} note={rel.note}>
              <div className="flex gap-6 font-mono text-sm">
                <Stat label={a.name} value={a.value} pct={a.change_pct} />
                <Stat label={b.name} value={b.value} pct={b.change_pct} />
              </div>
            </RelCard>
          )
        })}
      </div>
    </section>
  )
}

function RelCard({ label, note, children }: { label: string; note: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-4">
      <p className="text-xs text-neutral font-mono mb-2">{label}</p>
      {children}
      <p className="text-xs text-slate-500 mt-2 leading-relaxed">{note}</p>
    </div>
  )
}

function Stat({ label, value, unit, pct }: { label: string; value: number; unit?: string; pct?: number }) {
  return (
    <div>
      <p className="text-xs text-neutral truncate max-w-[80px]">{label}</p>
      <p className="font-semibold text-slate-200">{unit}{value.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
      {pct !== undefined && (
        <p className={`text-xs ${colorClass(pct)}`}>{fmtPct(pct)}</p>
      )}
    </div>
  )
}
