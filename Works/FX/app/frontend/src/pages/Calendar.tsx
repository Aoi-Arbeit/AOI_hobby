import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { getEconomicEvents } from '../api'

const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸', JP: '🇯🇵', EU: '🇪🇺', GB: '🇬🇧',
  UK: '🇬🇧', AU: '🇦🇺', CA: '🇨🇦', CH: '🇨🇭',
  NZ: '🇳🇿', CN: '🇨🇳',
}

interface EconomicEvent {
  id: string
  title: string
  country: string
  currency: string
  importance: 'low' | 'medium' | 'high'
  scheduled_at_jst: string
  scheduled_at_utc: string
  forecast: string | null
  previous: string | null
  actual: string | null
  description?: string
}

type ImportanceFilter = 'all' | 'low' | 'medium' | 'high'

export default function Calendar() {
  const [events, setEvents] = useState<EconomicEvent[]>([])
  const [importance, setImportance] = useState<ImportanceFilter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getEconomicEvents({ days: 14 })
        setEvents(data)
      } catch {
        setEvents([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = importance === 'all' ? events : events.filter(e => e.importance === importance)

  const getImportanceStyle = (imp: string) => {
    switch (imp) {
      case 'high':   return 'text-red-400'
      case 'medium': return 'text-yellow-400'
      default:       return 'text-slate-500'
    }
  }

  const getImportanceStars = (imp: string) => {
    switch (imp) {
      case 'high':   return '★★★'
      case 'medium': return '★★☆'
      default:       return '★☆☆'
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <div className="p-4 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-white">経済指標カレンダー</h1>
          <div className="flex gap-2">
            {(['all', 'high', 'medium', 'low'] as ImportanceFilter[]).map((imp) => (
              <button
                key={imp}
                onClick={() => setImportance(imp)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  importance === imp
                    ? imp === 'high' ? 'bg-red-600 text-white'
                      : imp === 'medium' ? 'bg-yellow-600 text-white'
                      : imp === 'low' ? 'bg-slate-600 text-white'
                      : 'bg-indigo-600 text-white'
                    : 'bg-panel border border-border text-slate-400 hover:text-white'
                }`}
              >
                {imp === 'all' ? 'すべて' : imp === 'high' ? '高' : imp === 'medium' ? '中' : '低'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-8">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-slate-400 py-8">該当するイベントがありません</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((event) => (
              <div key={event.id} className="bg-panel border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === event.id ? null : event.id)}
                  className="w-full px-4 py-3 hover:bg-white/5 transition-colors text-left flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{COUNTRY_FLAGS[event.country] ?? '🌍'}</span>
                      <span className="text-xs font-semibold text-slate-300">{event.country}</span>
                      <span className={`text-xs font-bold ${getImportanceStyle(event.importance)}`}>
                        {getImportanceStars(event.importance)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{event.title}</span>
                      <span className="text-xs text-slate-400">{event.scheduled_at_jst}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex gap-3">
                      {event.forecast && <span>予想: {event.forecast}</span>}
                      {event.previous && <span>前回: {event.previous}</span>}
                      {event.actual   && <span className="text-white font-semibold">実績: {event.actual}</span>}
                    </div>
                  </div>
                  <span className="text-slate-400 text-sm flex-shrink-0">
                    {expanded === event.id ? '▼' : '▶'}
                  </span>
                </button>

                {expanded === event.id && event.description && (
                  <div className="px-4 py-3 bg-surface border-t border-border text-xs text-slate-300 leading-relaxed">
                    {event.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
