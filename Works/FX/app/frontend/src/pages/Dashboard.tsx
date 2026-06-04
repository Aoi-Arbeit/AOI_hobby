import { useEffect } from 'react'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import Header from '../components/Header'
import { useStore } from '../store'

const fmtJpy = (v: number) => `¥${v.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`
const fmtDur = (s: number) => {
  if (s < 60) return `${s}秒`
  if (s < 3600) return `${Math.floor(s / 60)}分`
  if (s < 86400) return `${Math.floor(s / 3600)}時間`
  return `${Math.floor(s / 86400)}日`
}

export default function Dashboard() {
  const { account, positions, trades, stats, fetchAccount, fetchPositions, fetchTrades, fetchStats } = useStore()

  useEffect(() => {
    fetchAccount()
    fetchPositions()
    fetchTrades()
    fetchStats()
  }, [])

  // Simple performance chart data (last 10 trades cumulative P&L)
  const chartData = trades.slice(-10).reduce((acc: any[], t, i) => {
    const prev = acc[i - 1]?.pnl ?? 0
    acc.push({
      name: `Trade ${i + 1}`,
      pnl: prev + t.net_pnl,
    })
    return acc
  }, [])

  // Recent 5 trades
  const recentTrades = trades.slice(-5)

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <div className="p-4 max-w-6xl mx-auto w-full space-y-6">
        <h1 className="text-2xl font-bold text-white">ダッシュボード</h1>

        {/* Performance Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-panel border border-border rounded-xl p-4">
            <div className="text-xs text-slate-400 mb-1">残高</div>
            <div className="text-lg font-bold text-white">
              {account ? fmtJpy(account.balance) : '−'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {account ? fmtJpy(account.initial_balance) : '−'} 初期
            </div>
          </div>

          <div className="bg-panel border border-border rounded-xl p-4">
            <div className="text-xs text-slate-400 mb-1">収益率</div>
            <div className={`text-lg font-bold ${stats && stats.roi >= 0 ? 'text-up' : 'text-down'}`}>
              {stats ? fmtPct(stats.roi) : '−'}
            </div>
          </div>

          <div className="bg-panel border border-border rounded-xl p-4">
            <div className="text-xs text-slate-400 mb-1">勝率</div>
            <div className={`text-lg font-bold ${stats && stats.win_rate >= 0.5 ? 'text-up' : 'text-down'}`}>
              {stats ? fmtPct(stats.win_rate) : '−'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {stats ? `${stats.win_count}/${stats.total_trades}` : '−'}
            </div>
          </div>

          <div className="bg-panel border border-border rounded-xl p-4">
            <div className="text-xs text-slate-400 mb-1">PF</div>
            <div className={`text-lg font-bold ${stats && (stats.profit_factor ?? 0) >= 1 ? 'text-up' : 'text-down'}`}>
              {stats ? (stats.profit_factor !== null ? stats.profit_factor.toFixed(2) : '∞') : '−'}
            </div>
          </div>

          <div className="bg-panel border border-border rounded-xl p-4">
            <div className="text-xs text-slate-400 mb-1">最大DD</div>
            <div className="text-lg font-bold text-down">
              {stats ? fmtPct(stats.max_drawdown) : '−'}
            </div>
          </div>
        </div>

        {/* Mini Chart */}
        {chartData.length > 0 && (
          <div className="bg-panel border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">最近のパフォーマンス</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e3354" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#222538', border: '1px solid #2e3354', borderRadius: '8px' }}
                  formatter={(v: any) => fmtJpy(v as number)}
                />
                <Line
                  type="monotone"
                  dataKey="pnl"
                  stroke="#26a69a"
                  dot={{ fill: '#26a69a' }}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Positions List */}
        <div className="bg-panel border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-slate-300">オープンポジション</h2>
          </div>
          {positions.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-8">ポジションなし</p>
          ) : (
            <div className="overflow-x-auto">
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
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => {
                    const isJpy = p.symbol.includes('JPY')
                    const dec = isJpy ? 3 : 5
                    return (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                        <td className="px-3 py-2 font-mono font-semibold text-white">{p.symbol}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded font-bold ${p.side === 'buy' ? 'bg-up/20 text-up' : 'bg-down/20 text-down'}`}>
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
                          {p.sl_price ? p.sl_price.toFixed(dec) : '−'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-400">
                          {p.tp_price ? p.tp_price.toFixed(dec) : '−'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Trades */}
        <div className="bg-panel border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-slate-300">最近のトレード</h2>
          </div>
          {recentTrades.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-8">トレード履歴なし</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-border">
                    <th className="text-left px-3 py-2">ペア</th>
                    <th className="text-left px-3 py-2">方向</th>
                    <th className="text-right px-3 py-2">pips</th>
                    <th className="text-right px-3 py-2">損益</th>
                    <th className="text-right px-3 py-2">保有時間</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.map((t) => (
                    <tr key={t.id} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                      <td className="px-3 py-2 font-mono font-semibold text-white">{t.symbol}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded font-bold ${t.side === 'buy' ? 'bg-up/20 text-up' : 'bg-down/20 text-down'}`}>
                          {t.side === 'buy' ? 'BUY' : 'SELL'}
                        </span>
                      </td>
                      <td className={`px-3 py-2 text-right font-mono font-semibold ${t.pips_gained >= 0 ? 'text-up' : 'text-down'}`}>
                        {t.pips_gained >= 0 ? '+' : ''}{t.pips_gained.toFixed(1)}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono font-bold ${t.net_pnl >= 0 ? 'text-up' : 'text-down'}`}>
                        {t.net_pnl >= 0 ? '+' : ''}¥{t.net_pnl.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-400">{fmtDur(t.holding_duration_sec)}</td>
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
