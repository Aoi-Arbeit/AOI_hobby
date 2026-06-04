import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { useStore } from '../store'
import api from '../api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { getStatsMonthly, getStatsBySymbol, exportTrades } from '../api'

const fmtPct  = (v: number) => `${(v * 100).toFixed(1)}%`
const fmtJpy  = (v: number) => `¥${v.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`
const fmtPnl  = (v: number) => `${v >= 0 ? '+' : ''}${fmtJpy(v)}`
const fmtDur  = (s: number) => {
  if (s < 60)   return `${s}秒`
  if (s < 3600) return `${Math.floor(s / 60)}分`
  if (s < 86400)return `${Math.floor(s / 3600)}時間`
  return `${Math.floor(s / 86400)}日`
}

export default function Stats() {
  const { stats, trades, fetchStats, fetchTrades } = useStore()
  const [periodFilter, setPeriodFilter] = useState<'week' | 'month' | 'all'>('all')
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [symbolStats, setSymbolStats] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'summary' | 'monthly' | 'symbol'>('summary')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetchStats()
    fetchTrades()
  }, [])

  useEffect(() => {
    const loadMonthly = async () => {
      try {
        const data = await getStatsMonthly()
        setMonthlyData(data)
      } catch {
        setMonthlyData([])
      }
    }
    loadMonthly()
  }, [])

  useEffect(() => {
    const loadSymbolStats = async () => {
      try {
        const data = await getStatsBySymbol()
        setSymbolStats(data)
      } catch {
        setSymbolStats([])
      }
    }
    loadSymbolStats()
  }, [])

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await exportTrades()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `trades_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('エクスポートに失敗しました')
    } finally {
      setExporting(false)
    }
  }

  const resetAccount = async () => {
    if (!confirm('口座をリセットしますか？（¥1,000,000に戻します）')) return
    await api.post('/account/reset')
    fetchStats(); fetchTrades()
  }

  const cards = stats
    ? [
        { label: '総トレード数', value: `${stats.total_trades}回`,        sub: `勝${stats.win_count} 負${stats.loss_count}` },
        { label: '勝率',         value: fmtPct(stats.win_rate),           color: stats.win_rate >= 0.5 ? 'text-up' : 'text-down' },
        { label: '収益率 (ROI)', value: fmtPct(stats.roi),               color: stats.roi >= 0 ? 'text-up' : 'text-down' },
        { label: '累積損益',     value: fmtPnl(stats.total_pnl_jpy),     color: stats.total_pnl_jpy >= 0 ? 'text-up' : 'text-down' },
        { label: 'プロフィットファクター', value: stats.profit_factor !== null ? stats.profit_factor.toFixed(2) : '∞',
          color: (stats.profit_factor ?? 99) >= 1 ? 'text-up' : 'text-down' },
        { label: '最大ドローダウン', value: fmtPct(stats.max_drawdown),  color: stats.max_drawdown < -0.1 ? 'text-down' : 'text-yellow-400' },
        { label: '期待値',        value: fmtPnl(stats.expected_value_jpy), color: stats.expected_value_jpy >= 0 ? 'text-up' : 'text-down' },
        { label: '平均RRR',      value: `1:${stats.average_rr.toFixed(2)}`, color: stats.average_rr >= 1 ? 'text-up' : 'text-yellow-400' },
      ]
    : []

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <div className="p-4 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-white">成績・統計</h1>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="text-xs text-slate-400 hover:text-up border border-border hover:border-up px-3 py-1.5 rounded transition-colors disabled:opacity-50"
            >
              {exporting ? 'エクスポート中...' : 'CSV エクスポート'}
            </button>
            <button
              onClick={resetAccount}
              className="text-xs text-slate-400 hover:text-red-400 border border-border hover:border-red-400 px-3 py-1.5 rounded transition-colors"
            >
              口座リセット
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              activeTab === 'summary'
                ? 'bg-indigo-600 text-white'
                : 'bg-panel border border-border text-slate-400 hover:text-white'
            }`}
          >
            サマリー
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              activeTab === 'monthly'
                ? 'bg-indigo-600 text-white'
                : 'bg-panel border border-border text-slate-400 hover:text-white'
            }`}
          >
            月次パフォーマンス
          </button>
          <button
            onClick={() => setActiveTab('symbol')}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              activeTab === 'symbol'
                ? 'bg-indigo-600 text-white'
                : 'bg-panel border border-border text-slate-400 hover:text-white'
            }`}
          >
            通貨ペア別成績
          </button>
        </div>

        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <>
            {stats && stats.total_trades === 0 ? (
              <div className="text-center text-slate-400 py-16">トレード履歴がまだありません</div>
            ) : (
              <>
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setPeriodFilter('week')}
                    className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                      periodFilter === 'week'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-surface border border-border text-slate-400 hover:text-white'
                    }`}
                  >
                    今週
                  </button>
                  <button
                    onClick={() => setPeriodFilter('month')}
                    className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                      periodFilter === 'month'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-surface border border-border text-slate-400 hover:text-white'
                    }`}
                  >
                    今月
                  </button>
                  <button
                    onClick={() => setPeriodFilter('all')}
                    className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                      periodFilter === 'all'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-surface border border-border text-slate-400 hover:text-white'
                    }`}
                  >
                    全期間
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {cards.map((c) => (
                    <div key={c.label} className="bg-panel border border-border rounded-xl p-4">
                      <div className="text-xs text-slate-400 mb-1">{c.label}</div>
                      <div className={`text-xl font-bold ${c.color ?? 'text-white'}`}>{c.value}</div>
                      {c.sub && <div className="text-xs text-slate-500 mt-0.5">{c.sub}</div>}
                    </div>
                  ))}
                </div>

                {/* Instruction box */}
                <div className="bg-panel/60 border border-border rounded-xl p-4 mb-6 text-xs text-slate-400 space-y-1">
                  <p><span className="text-white font-semibold">期待値 &gt; 0</span> = 長期的に利益が出る戦略</p>
                  <p><span className="text-white font-semibold">PF &gt; 1.5</span> = 優良な戦略の目安</p>
                  <p><span className="text-white font-semibold">最大DD</span> = 資産曲線の最大下落幅（小さいほど安全）</p>
                  <p><span className="text-white font-semibold">RRR</span> = 平均損切り幅に対する平均利確幅の比率</p>
                </div>
              </>
            )}

            {/* Trade history */}
            <div className="bg-panel border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-slate-300">トレード履歴（直近200件）</h2>
          </div>
          {trades.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-8">履歴なし</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-border">
                    <th className="text-left px-3 py-2">日時 (JST)</th>
                    <th className="text-left px-3 py-2">ペア</th>
                    <th className="text-left px-3 py-2">方向</th>
                    <th className="text-right px-3 py-2">ロット</th>
                    <th className="text-right px-3 py-2">エントリー</th>
                    <th className="text-right px-3 py-2">決済</th>
                    <th className="text-right px-3 py-2">pips</th>
                    <th className="text-right px-3 py-2">損益</th>
                    <th className="text-right px-3 py-2">保有時間</th>
                    <th className="text-right px-3 py-2">理由</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => {
                    const isJpy = t.symbol.includes('JPY'); const dec = isJpy ? 3 : 5
                    const closedJst = new Date(t.closed_at)
                    const label: Record<string, string> = {
                      manual: '手動', tp: 'TP', sl: 'SL', loss_cut: 'ロスカット'
                    }
                    return (
                      <tr key={t.id} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                        <td className="px-3 py-2 text-slate-400">
                          {closedJst.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold text-white">{t.symbol}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded font-bold ${t.side === 'buy' ? 'bg-up/20 text-up' : 'bg-down/20 text-down'}`}>
                            {t.side === 'buy' ? 'BUY' : 'SELL'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-300">{t.lot_size}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-300">{t.entry_price.toFixed(dec)}</td>
                        <td className="px-3 py-2 text-right font-mono text-white">{t.exit_price.toFixed(dec)}</td>
                        <td className={`px-3 py-2 text-right font-mono font-semibold ${t.pips_gained >= 0 ? 'text-up' : 'text-down'}`}>
                          {t.pips_gained >= 0 ? '+' : ''}{t.pips_gained.toFixed(1)}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono font-bold ${t.net_pnl >= 0 ? 'text-up' : 'text-down'}`}>
                          {t.net_pnl >= 0 ? '+' : ''}¥{t.net_pnl.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-400">{fmtDur(t.holding_duration_sec)}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`text-xs ${t.close_reason === 'loss_cut' ? 'text-red-400' : t.close_reason === 'sl' ? 'text-down' : t.close_reason === 'tp' ? 'text-up' : 'text-slate-400'}`}>
                            {label[t.close_reason] ?? t.close_reason}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
            </div>
          </>
        )}

        {/* Monthly Chart Tab */}
        {activeTab === 'monthly' && (
          <div className="bg-panel border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">月次パフォーマンス</h2>
            {monthlyData.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-8">データなし</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2e3354" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#222538', border: '1px solid #2e3354', borderRadius: '8px' }}
                    formatter={(v: any) => `¥${(v as number).toLocaleString()}`}
                  />
                  <Legend />
                  <Bar dataKey="pnl" fill="#26a69a" name="収益" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* Symbol Stats Tab */}
        {activeTab === 'symbol' && (
          <div className="bg-panel border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-slate-300">通貨ペア別成績</h2>
            </div>
            {symbolStats.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-8">データなし</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-border">
                      <th className="text-left px-3 py-2">ペア</th>
                      <th className="text-right px-3 py-2">取引数</th>
                      <th className="text-right px-3 py-2">勝数</th>
                      <th className="text-right px-3 py-2">勝率</th>
                      <th className="text-right px-3 py-2">損益</th>
                      <th className="text-right px-3 py-2">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {symbolStats.map((s, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                        <td className="px-3 py-2 font-mono font-semibold text-white">{s.symbol}</td>
                        <td className="px-3 py-2 text-right text-slate-300">{s.total_trades}</td>
                        <td className="px-3 py-2 text-right text-slate-300">{s.win_count}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${s.win_rate >= 0.5 ? 'text-up' : 'text-down'}`}>
                          {(s.win_rate * 100).toFixed(1)}%
                        </td>
                        <td className={`px-3 py-2 text-right font-mono font-bold ${s.pnl >= 0 ? 'text-up' : 'text-down'}`}>
                          {s.pnl >= 0 ? '+' : ''}¥{s.pnl.toLocaleString()}
                        </td>
                        <td className={`px-3 py-2 text-right font-bold ${s.roi >= 0 ? 'text-up' : 'text-down'}`}>
                          {s.roi >= 0 ? '+' : ''}{(s.roi * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
