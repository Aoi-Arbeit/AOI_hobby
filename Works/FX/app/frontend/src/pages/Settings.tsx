import { useEffect } from 'react'
import Header from '../components/Header'
import api from '../api'
import { useStore } from '../store'

const fmtJpy = (v: number) => `¥${v.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`

export default function Settings() {
  const { account, fetchAccount, stats, fetchStats } = useStore()

  useEffect(() => {
    fetchAccount()
    fetchStats()
  }, [])

  const resetAccount = async () => {
    if (!confirm('口座をリセットしますか？（¥1,000,000に戻します）')) return
    try {
      await api.post('/account/reset')
      fetchAccount()
      fetchStats()
      alert('口座がリセットされました')
    } catch {
      alert('リセットに失敗しました')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <div className="p-4 max-w-2xl mx-auto w-full">
        <h1 className="text-lg font-bold text-white mb-6">設定</h1>

        {/* User Info */}
        <div className="bg-panel border border-border rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">ユーザー情報</h2>
          <div className="space-y-2">
            <div>
              <div className="text-xs text-slate-400 mb-1">ユーザー名</div>
              <div className="text-white font-semibold">{account?.username || '−'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">メールアドレス</div>
              <div className="text-white font-semibold">{account?.email || '−'}</div>
            </div>
          </div>
        </div>

        {/* Account Status */}
        <div className="bg-panel border border-border rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">口座情報</h2>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-slate-400 mb-1">現在の残高</div>
              <div className="text-lg font-bold text-white">
                {account ? fmtJpy(account.balance) : '−'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">有効証拠金</div>
              <div className="text-lg font-bold text-white">
                {account ? fmtJpy(account.equity) : '−'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">累計損益</div>
              <div className={`text-lg font-bold ${stats && stats.total_pnl_jpy >= 0 ? 'text-up' : 'text-down'}`}>
                {stats ? `${stats.total_pnl_jpy >= 0 ? '+' : ''}${fmtJpy(stats.total_pnl_jpy)}` : '−'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">初期残高</div>
              <div className="text-white font-semibold">
                {account ? fmtJpy(account.initial_balance) : '−'}
              </div>
            </div>
          </div>
        </div>

        {/* Account Reset */}
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-red-300 mb-3">危険ゾーン</h2>
          <p className="text-xs text-slate-400 mb-3">
            口座をリセットすると、すべてのポジション・トレード履歴がクリアされ、残高が¥1,000,000に戻ります。この操作は取り消せません。
          </p>
          <button
            onClick={resetAccount}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded font-medium text-sm transition-colors"
          >
            口座をリセット
          </button>
        </div>
      </div>
    </div>
  )
}
