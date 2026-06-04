import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store'

export default function Header() {
  const { account, wsConnected, setToken } = useStore()
  const location = useLocation()
  const navigate = useNavigate()

  const logout = () => { setToken(null); navigate('/login') }

  const nav = [
    { path: '/dashboard', label: 'ダッシュボード' },
    { path: '/trade', label: 'チャート' },
    { path: '/calendar', label: 'カレンダー' },
    { path: '/elliott', label: 'エリオット' },
    { path: '/stats', label: '成績' },
    { path: '/learn', label: '学習' },
    { path: '/settings', label: '設定' },
  ]

  return (
    <header className="bg-panel border-b border-border px-4 h-14 flex items-center gap-4 sticky top-0 z-50">
      {/* Logo */}
      <span className="font-bold text-indigo-400 text-lg mr-2">FX Practice</span>

      {/* Nav */}
      <nav className="flex gap-1">
        {nav.map((n) => (
          <Link
            key={n.path} to={n.path}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              location.pathname === n.path
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {n.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-4">
        {/* WS Status */}
        <div className="flex items-center gap-1.5 text-xs">
          <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`} />
          <span className="text-slate-400">{wsConnected ? 'LIVE' : '接続中...'}</span>
        </div>

        {/* Balance */}
        {account && (
          <div className="text-right">
            <div className="text-xs text-slate-400">有効証拠金</div>
            <div className="text-sm font-semibold text-white">
              ¥{account.equity.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}
            </div>
          </div>
        )}

        {/* Logout */}
        <button onClick={logout} className="text-xs text-slate-500 hover:text-white transition-colors">
          ログアウト
        </button>
      </div>
    </header>
  )
}
