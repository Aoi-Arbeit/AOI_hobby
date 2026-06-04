import { useState } from 'react'
import { useStore } from '../store'
import { updateSlTp, closeAllPositions } from '../api'

export default function PositionsList() {
  const { positions, fetchPositions } = useStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editSl, setEditSl] = useState('')
  const [editTp, setEditTp] = useState('')
  const [loadingClose, setLoadingClose] = useState<string | null>(null)
  const [loadingCloseAll, setLoadingCloseAll] = useState(false)

  const handleEditClick = (posId: string, currentSl: number | null, currentTp: number | null) => {
    setEditingId(posId)
    setEditSl(currentSl?.toString() || '')
    setEditTp(currentTp?.toString() || '')
  }

  const handleSaveSlTp = async (posId: string) => {
    setLoadingClose(posId)
    try {
      await updateSlTp(posId, {
        sl_price: editSl ? parseFloat(editSl) : null,
        tp_price: editTp ? parseFloat(editTp) : null,
      })
      fetchPositions()
      setEditingId(null)
    } catch {
      alert('更新に失敗しました')
    } finally {
      setLoadingClose(null)
    }
  }

  const handleCloseAll = async () => {
    if (!confirm('すべてのポジションを決済しますか？')) return

    setLoadingCloseAll(true)
    try {
      await closeAllPositions()
      fetchPositions()
    } catch {
      alert('決済に失敗しました')
    } finally {
      setLoadingCloseAll(false)
    }
  }

  if (positions.length === 0) {
    return (
      <div className="bg-panel border border-border rounded-xl p-4">
        <p className="text-slate-500 text-xs text-center">オープンポジションなし</p>
      </div>
    )
  }

  return (
    <div className="bg-panel border border-border rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300">オープンポジション</h2>
        <button
          onClick={handleCloseAll}
          disabled={loadingCloseAll}
          className="text-xs text-red-400 hover:text-red-300 font-semibold disabled:opacity-50 transition-colors"
        >
          {loadingCloseAll ? '決済中...' : '全決済'}
        </button>
      </div>
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-border">
              <th className="text-left px-3 py-2">ペア</th>
              <th className="text-left px-3 py-2">方向</th>
              <th className="text-right px-3 py-2">ロット</th>
              <th className="text-right px-3 py-2">エントリー</th>
              <th className="text-right px-3 py-2">現在値</th>
              <th className="text-right px-3 py-2">損益</th>
              <th className="text-right px-3 py-2">SL</th>
              <th className="text-right px-3 py-2">TP</th>
              <th className="text-center px-3 py-2">編集</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const isJpy = p.symbol.includes('JPY')
              const dec = isJpy ? 3 : 5
              const isEditing = editingId === p.id

              return (
                <tr key={p.id} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                  <td className="px-3 py-2 font-mono font-semibold text-white">{p.symbol}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded font-bold text-xs ${p.side === 'buy' ? 'bg-up/20 text-up' : 'bg-down/20 text-down'}`}>
                      {p.side === 'buy' ? 'BUY' : 'SELL'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-300">{p.lot_size}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-300">{p.entry_price.toFixed(dec)}</td>
                  <td className="px-3 py-2 text-right font-mono text-white">{p.current_price.toFixed(dec)}</td>
                  <td className={`px-3 py-2 text-right font-mono font-bold ${p.unrealized_pnl >= 0 ? 'text-up' : 'text-down'}`}>
                    {p.unrealized_pnl >= 0 ? '+' : ''}¥{p.unrealized_pnl.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-400">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editSl}
                        onChange={(e) => setEditSl(e.target.value)}
                        className="bg-surface border border-border rounded px-1 py-0.5 w-16 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    ) : (
                      p.sl_price?.toFixed(dec) || '−'
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-400">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editTp}
                        onChange={(e) => setEditTp(e.target.value)}
                        className="bg-surface border border-border rounded px-1 py-0.5 w-16 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    ) : (
                      p.tp_price?.toFixed(dec) || '−'
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {isEditing ? (
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => handleSaveSlTp(p.id)}
                          disabled={loadingClose === p.id}
                          className="text-xs text-up hover:text-up/80 font-semibold disabled:opacity-50"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs text-slate-400 hover:text-slate-300 font-semibold"
                        >
                          キャンセル
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEditClick(p.id, p.sl_price, p.tp_price)}
                        className="text-xs text-slate-400 hover:text-slate-300 font-semibold transition-colors"
                      >
                        編集
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
