import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { getAnnotations, createAnnotation, deleteAnnotation } from '../api'

interface Annotation {
  id: string
  symbol: string
  timeframe: string
  label: string
  price: number
  timestamp: string
  note?: string
}

const SYMBOLS = ['USDJPY', 'EURUSD', 'GBPUSD', 'AUDUSD']
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d']

export default function Elliott() {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [symbol, setSymbol] = useState<string>(SYMBOLS[0])
  const [timeframe, setTimeframe] = useState<string>(TIMEFRAMES[2])
  const [filterSymbol, setFilterSymbol] = useState<string>('all')
  const [filterTimeframe, setFilterTimeframe] = useState<string>('all')
  const [label, setLabel] = useState('')
  const [price, setPrice] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingDelete, setLoadingDelete] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getAnnotations()
        setAnnotations(data)
      } catch {
        setAnnotations([])
      }
    }
    load()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!label || !price) return

    setLoading(true)
    try {
      const newAnnotation = await createAnnotation({
        symbol,
        timeframe,
        label,
        price: parseFloat(price),
        timestamp: new Date().toISOString(),
        note,
      })
      setAnnotations([...annotations, newAnnotation])
      setLabel('')
      setPrice('')
      setNote('')
    } catch (err) {
      alert('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('削除しますか？')) return

    setLoadingDelete(id)
    try {
      await deleteAnnotation(id)
      setAnnotations(annotations.filter(a => a.id !== id))
    } catch {
      alert('削除に失敗しました')
    } finally {
      setLoadingDelete(null)
    }
  }

  const filtered = annotations.filter(a => {
    if (filterSymbol !== 'all' && a.symbol !== filterSymbol) return false
    if (filterTimeframe !== 'all' && a.timeframe !== filterTimeframe) return false
    return true
  })

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <div className="p-4 max-w-4xl mx-auto w-full space-y-6">
        <h1 className="text-lg font-bold text-white">エリオット波動学習</h1>

        {/* Explanation */}
        <div className="bg-panel border border-border rounded-xl p-4 text-sm text-slate-300 space-y-2">
          <h2 className="font-semibold text-white text-base mb-3">エリオット波動とは</h2>
          <p>
            エリオット波動理論は、金融市場の価格変動が予測可能なパターンに従うという理論です。
          </p>
          <p>
            <strong>5波動（上昇波）</strong>: 1波 → 2波 → 3波 → 4波 → 5波の5つの波動が組み合わさった上昇トレンド。
            通常、3波が最も長く、1波と5波の長さが似ています。
          </p>
          <p>
            <strong>ABC修正波（下降波）</strong>: A波 → B波 → C波の3つの波で構成される下降トレンド。
            5波動の後に必ず現れる修正波で、全体の25%～78.6%のレベルまで下げることが多い。
          </p>
          <p>
            この理論を使うことで、トレンドの強さや下降幅の予測、エントリーポイントやターゲットの設定に役立ちます。
          </p>
        </div>

        {/* Add Annotation Form */}
        <div className="bg-panel border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">ラベルを追加</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="bg-surface border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                {SYMBOLS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="bg-surface border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                {TIMEFRAMES.map((tf) => (
                  <option key={tf} value={tf}>
                    {tf}
                  </option>
                ))}
              </select>
            </div>

            <input
              type="text"
              placeholder="ラベル（例: 1波開始、ABC修正完了）"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
            />

            <input
              type="number"
              step="0.01"
              placeholder="価格"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
            />

            <textarea
              placeholder="メモ（オプション）"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:brightness-110 text-white py-2 rounded font-medium text-sm transition-colors disabled:opacity-50"
            >
              {loading ? '追加中...' : '追加'}
            </button>
          </form>
        </div>

        {/* Annotations List */}
        <div className="bg-panel border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">アノテーション一覧</h2>
            <div className="flex gap-2 flex-wrap">
              <select
                value={filterSymbol}
                onChange={(e) => setFilterSymbol(e.target.value)}
                className="bg-surface border border-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">すべての通貨ペア</option>
                {SYMBOLS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={filterTimeframe}
                onChange={(e) => setFilterTimeframe(e.target.value)}
                className="bg-surface border border-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">すべての時間軸</option>
                {TIMEFRAMES.map((tf) => (
                  <option key={tf} value={tf}>
                    {tf}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-8">アノテーションがありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-border">
                    <th className="text-left px-3 py-2">ペア</th>
                    <th className="text-left px-3 py-2">時間軸</th>
                    <th className="text-left px-3 py-2">ラベル</th>
                    <th className="text-right px-3 py-2">価格</th>
                    <th className="text-left px-3 py-2">日時</th>
                    <th className="text-left px-3 py-2">メモ</th>
                    <th className="text-center px-3 py-2">削除</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                      <td className="px-3 py-2 font-mono font-semibold text-white">{a.symbol}</td>
                      <td className="px-3 py-2 text-slate-300">{a.timeframe}</td>
                      <td className="px-3 py-2 font-semibold text-slate-200">{a.label}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-300">{a.price.toFixed(4)}</td>
                      <td className="px-3 py-2 text-slate-400 text-xs">
                        {new Date(a.timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                      </td>
                      <td className="px-3 py-2 text-slate-400 max-w-xs truncate">{a.note || '−'}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handleDelete(a.id)}
                          disabled={loadingDelete === a.id}
                          className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 text-xs font-semibold"
                        >
                          {loadingDelete === a.id ? '削除中...' : '削除'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
