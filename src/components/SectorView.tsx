import { useState, useEffect } from 'react'
import type { SectorData } from '../types'
import { fmtPct, colorClass } from '../utils/format'

export function SectorView() {
  const [data, setData] = useState<SectorData | null>(null)

  useEffect(() => {
    fetch('./data/sector_latest.json')
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => null)
  }, [])

  if (!data || data.sectors.length === 0) return null

  // Sort by relative_1m ascending (most lagging = top)
  const sectors = [...data.sectors].sort((a, b) => {
    const am = a.relative_1m ?? 0
    const bm = b.relative_1m ?? 0
    return am - bm
  })

  // Bar representing lag degree (max 5 dots)
  const lagDots = (rel1m: number | undefined) => {
    if (rel1m === undefined) return null
    const score = Math.min(Math.max(Math.round(-rel1m / 2.5), 0), 5)
    return (
      <>
        <span className="text-orange-400">{'●'.repeat(score)}</span>
        <span className="text-slate-700">{'●'.repeat(5 - score)}</span>
      </>
    )
  }

  return (
    <section className="mb-8" id="sector">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-xs font-mono tracking-widest text-neutral uppercase">業種別 vs TOPIX</h2>
        <span className="text-xs text-slate-500">出遅れ業種ほど上位に表示（買い時ヒント）</span>
      </div>

      <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="text-left px-4 py-2.5 text-neutral font-normal">業種</th>
                <th className="px-3 py-2.5 text-right text-neutral font-normal">現値</th>
                <th className="px-3 py-2.5 text-right text-neutral font-normal">前日比</th>
                <th className="px-3 py-2.5 text-right text-neutral font-normal">1M</th>
                <th className="px-3 py-2.5 text-right text-neutral font-normal whitespace-nowrap">対TOPIX 1M</th>
                <th className="px-3 py-2.5 text-right text-neutral font-normal whitespace-nowrap">対TOPIX 1Y</th>
                <th className="px-3 py-2.5 text-center text-neutral font-normal">出遅れ度</th>
              </tr>
            </thead>
            <tbody>
              {sectors.map((s, i) => {
                const isTopLag = i === 0
                const isBotLag = i === sectors.length - 1
                return (
                  <tr
                    key={s.id}
                    className={`border-b border-surface-border/40 ${
                      isTopLag ? 'bg-orange-900/10' : isBotLag ? 'bg-green-900/5' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      {s.sector_ja}
                      {isTopLag && (
                        <span className="ml-2 text-orange-400 font-normal">← 出遅れ</span>
                      )}
                      {isBotLag && (
                        <span className="ml-2 text-up font-normal">← 先行</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300">
                      {s.value.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}
                    </td>
                    <td className={`px-3 py-3 text-right ${colorClass(s.change_pct)}`}>
                      {fmtPct(s.change_pct)}
                    </td>
                    <td className={`px-3 py-3 text-right ${colorClass(s.month_pct)}`}>
                      {fmtPct(s.month_pct)}
                    </td>
                    <td className={`px-3 py-3 text-right font-semibold ${
                      s.relative_1m !== undefined ? colorClass(s.relative_1m) : 'text-neutral'
                    }`}>
                      {s.relative_1m !== undefined
                        ? (s.relative_1m >= 0 ? '+' : '') + s.relative_1m.toFixed(2) + '%'
                        : '—'}
                    </td>
                    <td className={`px-3 py-3 text-right ${
                      s.relative_1y !== undefined ? colorClass(s.relative_1y) : 'text-neutral'
                    }`}>
                      {s.relative_1y !== undefined
                        ? (s.relative_1y >= 0 ? '+' : '') + s.relative_1y.toFixed(2) + '%'
                        : '—'}
                    </td>
                    <td className="px-3 py-3 text-center tracking-tight">
                      {lagDots(s.relative_1m)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-surface-border text-xs text-slate-500">
          代表銘柄: エネルギー=INPEX / 素材=日本製鉄 / 自動車=トヨタ / 電気=ソニー / 金融=三菱UFJ / 商社=三菱商事 / 医薬=武田薬品 / 不動産=三井不動産 / 小売=セブン&アイ / IT=ソフトバンクG
        </div>
      </div>
    </section>
  )
}
