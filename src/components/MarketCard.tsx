import { useNavigate } from 'react-router-dom'
import type { Indicator } from '../types'
import { fmtValue, fmtChange, fmtPct, colorClass, bgColorClass } from '../utils/format'
import { SparklineChart } from './SparklineChart'

interface Props {
  indicator: Indicator
}

export function MarketCard({ indicator: ind }: Props) {
  const navigate = useNavigate()

  return (
    <div
      className="bg-surface-card border border-surface-border rounded-xl p-4 cursor-pointer hover:border-slate-500 hover:bg-surface-hover transition-all"
      onClick={() => navigate(`/indicator/${ind.id}`)}
    >
      {/* Name + value */}
      <div className="flex justify-between items-start mb-1">
        <div>
          <p className="text-xs text-neutral font-mono tracking-wide">{ind.id.toUpperCase()}</p>
          <p className="text-sm font-semibold text-slate-200 leading-tight">{ind.name_ja}</p>
        </div>
        <div className="text-right">
          <p className="text-base font-mono font-semibold text-slate-100">
            {fmtValue(ind.value, ind.unit)}
          </p>
          <p className={`text-xs font-mono ${colorClass(ind.change)}`}>
            {fmtChange(ind.change, ind.unit)}
          </p>
        </div>
      </div>

      {/* Sparkline */}
      <div className="my-2">
        <SparklineChart history={ind.history} positive={ind.change_pct >= 0} />
      </div>

      {/* Badges: day / 1W / 1M */}
      <div className="flex gap-1.5 mt-1 flex-wrap">
        <Badge label="1D" value={ind.change_pct} />
        <Badge label="1W" value={ind.week_pct} />
        <Badge label="1M" value={ind.month_pct} />
      </div>
    </div>
  )
}

function Badge({ label, value }: { label: string; value: number }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-md ${bgColorClass(value)}`}>
      <span className="text-neutral/70">{label}</span>
      {fmtPct(value)}
    </span>
  )
}
