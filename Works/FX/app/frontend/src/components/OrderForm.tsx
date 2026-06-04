import { FormEvent, useState } from 'react'
import api from '../api'
import { useStore } from '../store'

type OrderType = 'market' | 'limit' | 'stop' | 'oco'
type Side      = 'buy'    | 'sell'

const ORDER_TYPES: { value: OrderType; label: string; desc: string }[] = [
  { value: 'market', label: '成行',  desc: '現在レートで即時約定' },
  { value: 'limit',  label: '指値',  desc: '有利なレートで待機約定' },
  { value: 'stop',   label: '逆指値', desc: 'ブレイクアウト時に約定' },
  { value: 'oco',    label: 'OCO',   desc: '指値+逆指値を同時発注' },
]

export default function OrderForm() {
  const { selectedSymbol, rates, fetchPositions, fetchAccount } = useStore()
  const [orderType, setOrderType] = useState<OrderType>('market')
  const [side, setSide]           = useState<Side>('buy')
  const [lotSize, setLotSize]     = useState('0.1')
  const [leverage, setLeverage]   = useState('25')
  const [limitPrice, setLimitPrice] = useState('')
  const [stopPrice, setStopPrice]   = useState('')
  const [slPrice, setSlPrice]       = useState('')
  const [tpPrice, setTpPrice]       = useState('')
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')
  const [loading, setLoading]       = useState(false)

  const rate    = rates[selectedSymbol]
  const isJpy   = selectedSymbol.includes('JPY')
  const dec     = isJpy ? 3 : 5
  const pipUnit = isJpy ? 0.01 : 0.0001

  const calcMargin = () => {
    if (!rate) return null
    const price   = rate.ask
    const units   = parseFloat(lotSize) * 10000
    const lev     = parseInt(leverage)
    const usdJpy  = rates['USDJPY']?.mid ?? 150
    if (isJpy) return units * price / lev
    return units * price * usdJpy / lev
  }
  const margin = calcMargin()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    try {
      const body: Record<string, any> = {
        type: orderType, side, symbol: selectedSymbol,
        lot_size: parseFloat(lotSize), leverage: parseInt(leverage),
      }
      if (orderType !== 'market') body.limit_price = limitPrice ? parseFloat(limitPrice) : null
      if (orderType === 'stop' || orderType === 'oco') body.stop_price = stopPrice ? parseFloat(stopPrice) : null
      if (slPrice) body.sl_price = parseFloat(slPrice)
      if (tpPrice) body.tp_price = parseFloat(tpPrice)

      const { data } = await api.post('/orders', body)
      const msg = data.status === 'filled'
        ? `約定: ${data.filled_price?.toFixed(dec)}${data.slippage_pips > 0 ? ` (スリッページ ${data.slippage_pips}pips)` : ''}`
        : '注文を受け付けました'
      setSuccess(msg)
      fetchPositions(); fetchAccount()
    } catch (err: any) {
      setError(err.response?.data?.detail || '注文エラー')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-panel rounded-xl border border-border p-4 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-slate-300">注文パネル</h2>

      {/* Symbol + Rate */}
      {rate && (
        <div className="bg-surface rounded-lg p-3 text-center">
          <div className="text-xs text-slate-500 mb-1">{selectedSymbol}</div>
          <div className="flex justify-center gap-6">
            <div><div className="text-xs text-slate-500">BID</div>
              <div className="text-down font-bold text-lg font-mono">{rate.bid.toFixed(dec)}</div></div>
            <div><div className="text-xs text-slate-500">ASK</div>
              <div className="text-up font-bold text-lg font-mono">{rate.ask.toFixed(dec)}</div></div>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-2.5">
        {/* Order type */}
        <div className="grid grid-cols-4 gap-1">
          {ORDER_TYPES.map((ot) => (
            <button key={ot.value} type="button" onClick={() => setOrderType(ot.value)}
              title={ot.desc}
              className={`py-1.5 text-xs rounded font-medium transition-colors ${
                orderType === ot.value ? 'bg-indigo-600 text-white' : 'bg-surface text-slate-400 hover:text-white'
              }`}>
              {ot.label}
            </button>
          ))}
        </div>

        {/* Buy / Sell */}
        <div className="grid grid-cols-2 gap-1">
          <button type="button" onClick={() => setSide('buy')}
            className={`py-2 rounded font-bold text-sm transition-colors ${
              side === 'buy' ? 'bg-up text-white' : 'bg-surface text-slate-400 hover:text-up'
            }`}>
            BUY
          </button>
          <button type="button" onClick={() => setSide('sell')}
            className={`py-2 rounded font-bold text-sm transition-colors ${
              side === 'sell' ? 'bg-down text-white' : 'bg-surface text-slate-400 hover:text-down'
            }`}>
            SELL
          </button>
        </div>

        {/* Lot / Leverage */}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">ロット</span>
            <input type="number" min="0.01" max="100" step="0.01" value={lotSize}
              onChange={(e) => setLotSize(e.target.value)}
              className="bg-surface border border-border rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">レバレッジ</span>
            <select value={leverage} onChange={(e) => setLeverage(e.target.value)}
              className="bg-surface border border-border rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500">
              {[5, 10, 25, 50, 100].map((l) => <option key={l} value={l}>{l}倍</option>)}
            </select>
          </label>
        </div>

        {/* Conditional price fields */}
        {(orderType === 'limit' || orderType === 'oco') && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">指値レート</span>
            <input type="number" step={pipUnit} value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)}
              placeholder={rate?.mid.toFixed(dec)}
              className="bg-surface border border-border rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </label>
        )}
        {(orderType === 'stop' || orderType === 'oco') && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">逆指値レート</span>
            <input type="number" step={pipUnit} value={stopPrice} onChange={(e) => setStopPrice(e.target.value)}
              placeholder={rate?.mid.toFixed(dec)}
              className="bg-surface border border-border rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </label>
        )}

        {/* SL / TP */}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-red-400">SL（損切り）</span>
            <input type="number" step={pipUnit} value={slPrice} onChange={(e) => setSlPrice(e.target.value)}
              placeholder="任意"
              className="bg-surface border border-border rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-up">TP（利確）</span>
            <input type="number" step={pipUnit} value={tpPrice} onChange={(e) => setTpPrice(e.target.value)}
              placeholder="任意"
              className="bg-surface border border-border rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </label>
        </div>

        {/* Margin estimate */}
        {margin !== null && (
          <div className="text-xs text-slate-400 bg-surface rounded px-3 py-2">
            必要証拠金: <span className="text-white font-semibold">¥{Math.ceil(margin).toLocaleString()}</span>
            <span className="ml-2">({lotSize}lot × {leverage}倍)</span>
          </div>
        )}

        {error   && <p className="text-red-400 text-xs bg-red-900/20 rounded px-2 py-1">{error}</p>}
        {success && <p className="text-up text-xs bg-green-900/20 rounded px-2 py-1">{success}</p>}

        <button type="submit" disabled={loading}
          className={`w-full py-2.5 rounded font-bold text-sm transition-colors ${
            side === 'buy'
              ? 'bg-up hover:brightness-110 text-white'
              : 'bg-down hover:brightness-110 text-white'
          } disabled:opacity-50`}>
          {loading ? '処理中...' : `${side === 'buy' ? 'BUY' : 'SELL'} ${orderType.toUpperCase()}`}
        </button>
      </form>
    </div>
  )
}
