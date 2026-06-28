import type { Indicator, DayComment } from '../types'
import { fmtPct, colorClass } from '../utils/format'

interface Props {
  indicators: Indicator[]
  comment: DayComment | null
  date: string
}

export function MarketSummary({ indicators, comment, date }: Props) {
  const byId = Object.fromEntries(indicators.map(i => [i.id, i]))

  const bullets = generateBullets(byId)
  const headline = generateHeadline(byId)

  return (
    <div className="mb-8 bg-surface-card border border-surface-border rounded-xl overflow-hidden">
      {/* Header bar */}
      <div className="px-5 py-3 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono tracking-widest text-neutral uppercase">Today's Overview</span>
          <span className="text-xs text-slate-500 font-mono">{date}</span>
        </div>
        <MoodBadge indicators={indicators} />
      </div>

      <div className="px-5 py-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: auto-generated summary */}
        <div>
          <p className="text-sm font-semibold text-slate-200 mb-3 leading-relaxed">{headline}</p>
          <ul className="space-y-2">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300 leading-relaxed">
                <span className="mt-0.5 shrink-0">{b.icon}</span>
                <span>
                  <span className={`font-mono font-semibold ${b.color} mr-1`}>{b.label}</span>
                  {b.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: user memos */}
        <div>
          <p className="text-xs font-mono tracking-widest text-neutral uppercase mb-3">📝 学習メモ</p>
          {comment && comment.entries.length > 0 ? (
            <ul className="space-y-2">
              {comment.entries.map((e, i) => (
                <li key={i} className="flex items-start gap-3 bg-slate-800/60 rounded-lg px-3 py-2">
                  <span className="font-mono text-xs text-slate-500 shrink-0 mt-0.5">{e.time}</span>
                  <span className="text-slate-100 text-sm leading-relaxed">{e.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral italic">
              今日のメモはまだありません。<br />
              ページ下部の「学習メモ」欄から追加できます。
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Mood badge ────────────────────────────────────────────────────────────────

function MoodBadge({ indicators }: { indicators: Indicator[] }) {
  const equities = indicators.filter(i => i.category === 'equity')
  const upCount = equities.filter(i => i.change_pct > 0).length
  const ratio = upCount / (equities.length || 1)

  if (ratio >= 0.6) return (
    <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-up/15 text-up border border-up/30">
      ▲ リスクオン
    </span>
  )
  if (ratio <= 0.4) return (
    <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-down/15 text-down border border-down/30">
      ▼ リスクオフ
    </span>
  )
  return (
    <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-700 text-neutral border border-slate-600">
      ─ 方向感なし
    </span>
  )
}

// ── Auto-generated bullets ────────────────────────────────────────────────────

interface Bullet { icon: string; label: string; text: string; color: string }

function generateBullets(byId: Record<string, Indicator>): Bullet[] {
  const bullets: Bullet[] = []

  // Equity
  const sp = byId['sp500']
  const nk = byId['nikkei']
  if (sp) {
    const dir = sp.change_pct > 0 ? '上昇' : '下落'
    const mag = Math.abs(sp.change_pct) > 1 ? '大幅に' : '小幅'
    bullets.push({
      icon: sp.change_pct > 0 ? '📈' : '📉',
      label: `S&P500 ${fmtPct(sp.change_pct)}`,
      text: `米国株は${mag}${dir}。`,
      color: colorClass(sp.change_pct),
    })
  }
  if (nk) {
    const dir = nk.change_pct > 0 ? '上昇' : '下落'
    bullets.push({
      icon: nk.change_pct > 0 ? '📈' : '📉',
      label: `日経 ${fmtPct(nk.change_pct)}`,
      text: `日本株は${dir}。`,
      color: colorClass(nk.change_pct),
    })
  }

  // Rates
  const us10 = byId['us10y']
  const us2  = byId['us2y']
  const spread = byId['spread_10_2']
  if (us10) {
    const dir = us10.change > 0 ? '上昇' : '低下'
    const implication = us10.change > 0
      ? '債券売り・株式PER圧縮圧力。'
      : '利下げ期待または景気不安を示唆。'
    bullets.push({
      icon: '🏦',
      label: `米10Y ${us10.value.toFixed(2)}%`,
      text: `金利${dir}（${us10.change > 0 ? '+' : ''}${us10.change.toFixed(2)}bp）。${implication}`,
      color: colorClass(-us10.change),  // 金利下落は株にポジティブ
    })
  }
  if (spread && spread.value < 0) {
    bullets.push({
      icon: '⚠️',
      label: `逆イールド ${spread.value.toFixed(2)}%`,
      text: '10Y-2Yスプレッドがマイナス継続。景気後退シグナルとして注視。',
      color: 'text-down',
    })
  }

  // FX
  const usd = byId['usdjpy']
  if (usd) {
    const dir = usd.change_pct > 0 ? '円安' : '円高'
    const mag = Math.abs(usd.change_pct) > 0.5 ? '大きく' : '小幅'
    bullets.push({
      icon: '💱',
      label: `USD/JPY ${usd.value.toFixed(2)}`,
      text: `${mag}${dir}（${usd.change > 0 ? '+' : ''}${usd.change.toFixed(2)}円）。`,
      color: colorClass(usd.change_pct),
    })
  }

  // Commodity
  const gold = byId['gold']
  if (gold) {
    const dir = gold.change_pct > 0 ? '上昇' : '下落'
    const factor = gold.change_pct > 0
      ? 'ドル安・地政学リスクを反映か。'
      : 'ドル高・リスクオンで売り。'
    bullets.push({
      icon: '🥇',
      label: `金 ${fmtPct(gold.change_pct)}`,
      text: `$${gold.value.toLocaleString()}/${dir}。${factor}`,
      color: colorClass(gold.change_pct),
    })
  }

  // VIX
  const vix = byId['vix']
  if (vix) {
    const level = vix.value >= 30 ? '高恐怖域' : vix.value >= 20 ? '警戒域' : '低位安定'
    const emoji = vix.value >= 30 ? '🔴' : vix.value >= 20 ? '🟡' : '🟢'
    bullets.push({
      icon: emoji,
      label: `VIX ${vix.value.toFixed(1)}`,
      text: `恐怖指数は${level}。${vix.change_pct < 0 ? '市場の不安は後退傾向。' : '警戒感が高まっている。'}`,
      color: colorClass(-vix.change_pct),  // VIX下落はポジティブ
    })
  }

  return bullets
}

// ── Headline ──────────────────────────────────────────────────────────────────

function generateHeadline(byId: Record<string, Indicator>): string {
  const sp   = byId['sp500']
  const us10 = byId['us10y']
  const usd  = byId['usdjpy']
  const vix  = byId['vix']

  const parts: string[] = []

  if (sp) {
    parts.push(sp.change_pct > 0 ? '米国株は上昇' : '米国株は下落')
  }
  if (us10) {
    parts.push(us10.change < 0 ? '長期金利は低下' : '長期金利は上昇')
  }
  if (usd) {
    parts.push(usd.change_pct > 0 ? 'ドル高・円安' : 'ドル安・円高')
  }
  if (vix && vix.value >= 20) {
    parts.push('市場の警戒感は高まっている')
  }

  if (parts.length === 0) return 'データを読み込んでいます...'
  return parts.join('、') + '。'
}
