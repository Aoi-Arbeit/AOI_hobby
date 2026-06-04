import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useStore } from '../store'

export default function Login() {
  const [tab, setTab]     = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { setToken } = useStore()
  const navigate = useNavigate()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      if (tab === 'register') {
        const { data } = await api.post('/auth/register', { email, username, password })
        setToken(data.access_token)
      } else {
        const form = new URLSearchParams({ username: email, password })
        const { data } = await api.post('/auth/login', form, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
        setToken(data.access_token)
      }
      navigate('/trade')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'エラーが発生しました')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-full max-w-sm bg-panel rounded-2xl p-8 shadow-2xl border border-border">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-white mb-1">FX Practice</div>
          <div className="text-sm text-slate-400">仮想資金でリアルなFXを練習</div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg overflow-hidden border border-border mb-6">
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                tab === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t === 'login' ? 'ログイン' : '新規登録'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {tab === 'register' && (
            <input
              type="text" placeholder="ユーザー名" value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              required
            />
          )}
          <input
            type="email" placeholder="メールアドレス" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            required
          />
          <input
            type="password" placeholder="パスワード" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            required
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {tab === 'login' ? 'ログイン' : '登録する'}
          </button>
        </form>

        <p className="text-center text-slate-500 text-xs mt-6">
          初期仮想資金: ¥1,000,000 | 学習目的専用
        </p>
      </div>
    </div>
  )
}
