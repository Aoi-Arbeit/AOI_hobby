import Header from '../components/Header'
import ChartWidget from '../components/ChartWidget'
import OrderForm from '../components/OrderForm'
import PositionsList from '../components/PositionsList'
import { useStore } from '../store'

export default function Trade() {
  const { account } = useStore()

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      {/* Account bar */}
      {account && (
        <div className="flex gap-6 px-4 py-2 bg-panel border-b border-border text-xs">
          {[
            { label: '残高',     value: `¥${account.balance.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}` },
            { label: '有効証拠金', value: `¥${account.equity.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`,
              color: account.equity >= account.balance ? 'text-up' : 'text-down' },
            { label: '含み損益',  value: `${account.unrealized_pnl >= 0 ? '+' : ''}¥${account.unrealized_pnl.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`,
              color: account.unrealized_pnl >= 0 ? 'text-up' : 'text-down' },
            { label: '必要証拠金', value: `¥${account.required_margin.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}` },
            { label: '維持率',    value: `${account.margin_level >= 9999 ? '∞' : account.margin_level.toFixed(1)}%`,
              color: account.margin_level < 200 ? 'text-red-400' : account.margin_level < 500 ? 'text-yellow-400' : 'text-up' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="text-slate-500">{label}:</span>
              <span className={`font-semibold text-white ${color ?? ''}`}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 gap-3 p-3 overflow-hidden" style={{ height: 'calc(100vh - 8rem)' }}>
        {/* Chart area */}
        <div className="flex flex-col flex-1 gap-3 min-w-0 overflow-hidden">
          <div className="flex-1 min-h-0">
            <ChartWidget />
          </div>
          <PositionsList />
        </div>

        {/* Order panel */}
        <div className="w-64 shrink-0 overflow-y-auto">
          <OrderForm />
        </div>
      </div>
    </div>
  )
}
