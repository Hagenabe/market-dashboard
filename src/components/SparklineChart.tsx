import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'
import type { HistoryPoint } from '../types'

interface Props {
  history: HistoryPoint[]
  positive: boolean
}

function tickFormatter(date: string): string {
  return date.slice(5)  // "YYYY-MM-DD" → "MM-DD"
}

export function SparklineChart({ history, positive }: Props) {
  const color = positive ? '#22c55e' : '#ef4444'
  return (
    <ResponsiveContainer width="100%" height={68}>
      <LineChart data={history} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 9, fill: '#475569' }}
          tickFormatter={tickFormatter}
          interval="preserveStartEnd"
          axisLine={false}
          tickLine={false}
        />
        <YAxis domain={['auto', 'auto']} hide />
        <Line
          type="monotone"
          dataKey="close"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
        <Tooltip
          contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 6, fontSize: 11 }}
          itemStyle={{ color: '#e2e8f0' }}
          labelStyle={{ color: '#64748b', marginBottom: 2 }}
          formatter={(v: number) => [v.toLocaleString(), '']}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
