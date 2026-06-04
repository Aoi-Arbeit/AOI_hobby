import { useEffect, useRef } from 'react'
import { useStore } from '../store'

export function useWebSocket() {
  const { token, setRates, fetchPositions, fetchAccount, setWsConnected } = useStore()
  const wsRef    = useRef<WebSocket | null>(null)
  const retryRef = useRef<number>(1000)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    const connect = () => {
      if (cancelled) return
      const ws = new WebSocket(`ws://${window.location.host}/ws`)
      wsRef.current = ws

      ws.onopen = () => {
        retryRef.current = 1000
        setWsConnected(true)
        ws.send(JSON.stringify({ type: 'sync.request' }))
      }

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        switch (msg.type) {
          case 'rate.update':
            setRates(msg.data)
            break
          case 'order.filled':
          case 'position.closed':
          case 'position.loss_cut':
            fetchPositions()
            fetchAccount()
            break
        }
      }

      ws.onclose = () => {
        setWsConnected(false)
        if (!cancelled) {
          setTimeout(connect, retryRef.current)
          retryRef.current = Math.min(retryRef.current * 2, 30000)
        }
      }

      ws.onerror = () => ws.close()
    }

    connect()
    return () => {
      cancelled = true
      wsRef.current?.close()
    }
  }, [token])
}
