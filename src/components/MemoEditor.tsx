import { useState } from 'react'
import type { DayComment } from '../types'
import { format } from 'date-fns'

interface Props {
  comment: DayComment | null
  date: string
  inputOnly?: boolean   // true のとき既存エントリ一覧を非表示
}

export function MemoEditor({ comment, date, inputOnly = false }: Props) {
  const [copied, setCopied] = useState(false)
  const [localEntries, setLocalEntries] = useState(comment?.entries ?? [])
  const [draft, setDraft] = useState('')

  const addEntry = () => {
    if (!draft.trim()) return
    const now = format(new Date(), 'HH:mm')
    setLocalEntries(prev => [...prev, { time: now, text: draft.trim() }])
    setDraft('')
  }

  const removeEntry = (i: number) => {
    setLocalEntries(prev => prev.filter((_, idx) => idx !== i))
  }

  const exportJson = () => {
    const obj: DayComment = { date, entries: localEntries }
    const json = JSON.stringify(obj, null, 2)
    navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-mono tracking-widest text-neutral uppercase">
          📝 学習メモ — {date}
        </h3>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-neutral">
            保存先: <code className="text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">public/data/comments/{date}.json</code>
          </span>
          <button
            onClick={exportJson}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-mono transition-colors"
          >
            {copied ? '✓ コピー済み' : 'JSON コピー'}
          </button>
        </div>
      </div>

      {/* Entry list — 上部サマリーに表示済みなので inputOnly 時は非表示 */}
      {!inputOnly && (
        <div className="space-y-2 mb-4 min-h-[60px]">
          {localEntries.length === 0 && (
            <p className="text-sm text-neutral italic">まだメモがありません。下から追加してください。</p>
          )}
          {localEntries.map((e, i) => (
            <div key={i} className="flex items-start gap-3 group bg-slate-800/60 rounded-lg px-3 py-2">
              <span className="font-mono text-xs text-slate-400 mt-0.5 shrink-0">{e.time}</span>
              <span className="text-slate-100 flex-1 text-sm leading-relaxed">{e.text}</span>
              <button
                onClick={() => removeEntry(i)}
                className="text-slate-600 opacity-0 group-hover:opacity-100 hover:text-down transition-all text-xs"
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addEntry()}
          placeholder="例: 米10年金利低下。利下げ期待が強まり株高。"
          className="flex-1 bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-neutral outline-none focus:border-slate-500 transition-colors"
        />
        <button
          onClick={addEntry}
          className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-sm text-slate-100 transition-colors"
        >
          追加
        </button>
      </div>

      <p className="text-xs text-neutral mt-3">
        「JSON コピー」でクリップボードにコピー → <code className="text-slate-400">public/data/comments/{date}.json</code> に貼り付けて保存
      </p>
    </div>
  )
}
