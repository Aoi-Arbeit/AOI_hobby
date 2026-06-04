import { useEffect, useRef, useState, useCallback } from 'react'
import {
  createChart, IChartApi, ISeriesApi, CandlestickData, UTCTimestamp,
  CrosshairMode, LineStyle
} from 'lightweight-charts'
import api from '../api'
import { useStore } from '../store'

const TIMEFRAMES = ['1m', '5m', '1h', '4h', '1d']
const SYMBOLS    = ['USDJPY', 'EURJPY', 'EURUSD', 'GBPUSD', 'AUDJPY']

type DrawMode = 'none' | 'hline' | 'trendline'

interface DrawnLine {
  id: string
  series: ISeriesApi<'Line'>
}

export default function ChartWidget() {
  const { selectedSymbol, setSelectedSymbol, selectedTimeframe, setSelectedTimeframe, rates } = useStore()
  const containerRef  = useRef<HTMLDivElement>(null)
  const chartRef      = useRef<IChartApi | null>(null)
  const seriesRef     = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const drawnLinesRef = useRef<DrawnLine[]>([])

  // drawing state
  const [drawMode, setDrawMode]   = useState<DrawMode>('none')
  const drawModeRef               = useRef<DrawMode>('none')
  const isDraggingRef             = useRef(false)
  const dragStartRef              = useRef<{ x: number; y: number } | null>(null)
  const previewSeriesRef          = useRef<ISeriesApi<'Line'> | null>(null)

  useEffect(() => { drawModeRef.current = drawMode }, [drawMode])

  // ─── chart init ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      layout: { background: { color: '#1a1d2e' }, textColor: '#94a3b8' },
      grid:   { vertLines: { color: '#2e3354' }, horzLines: { color: '#2e3354' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#2e3354' },
      timeScale:       { borderColor: '#2e3354', timeVisible: true, secondsVisible: false },
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    })
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a', downColor: '#ef5350',
      borderUpColor: '#26a69a', borderDownColor: '#ef5350',
      wickUpColor:   '#26a69a', wickDownColor:   '#ef5350',
    })
    chartRef.current  = chart
    seriesRef.current = candleSeries

    const resize = () => {
      if (containerRef.current)
        chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight })
    }
    window.addEventListener('resize', resize)
    return () => {
      chart.remove()
      window.removeEventListener('resize', resize)
      drawnLinesRef.current = []
    }
  }, [])

  // ─── price helper ─────────────────────────────────────────────────────────
  const yToPrice = useCallback((clientY: number): number | null => {
    if (!containerRef.current || !seriesRef.current) return null
    const rect = containerRef.current.getBoundingClientRect()
    const y    = clientY - rect.top
    return seriesRef.current.coordinateToPrice(y)
  }, [])

  const xToTime = useCallback((clientX: number): UTCTimestamp | null => {
    if (!containerRef.current || !chartRef.current) return null
    const rect = containerRef.current.getBoundingClientRect()
    const x    = clientX - rect.left
    const ts   = chartRef.current.timeScale().coordinateToTime(x)
    return ts as UTCTimestamp | null
  }, [])

  // ─── mouse event handlers ─────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (drawModeRef.current === 'none') return
    e.preventDefault()
    isDraggingRef.current = true
    dragStartRef.current  = { x: e.clientX, y: e.clientY }

    // create preview series
    if (chartRef.current) {
      const preview = chartRef.current.addLineSeries({
        color: drawModeRef.current === 'hline' ? '#f59e0b' : '#818cf8',
        lineWidth: 1,
        lineStyle: drawModeRef.current === 'hline' ? LineStyle.Dashed : LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: drawModeRef.current === 'hline',
        crosshairMarkerVisible: false,
      })
      previewSeriesRef.current = preview
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current || !previewSeriesRef.current || !dragStartRef.current) return
    e.preventDefault()

    const mode = drawModeRef.current
    const startPrice = yToPrice(dragStartRef.current.y)
    const endPrice   = yToPrice(e.clientY)
    if (startPrice === null || endPrice === null) return

    if (mode === 'hline') {
      // 水平線: 始点の価格で固定
      const now   = Math.floor(Date.now() / 1000) as UTCTimestamp
      previewSeriesRef.current.setData([
        { time: (now - 60 * 60 * 24 * 365) as UTCTimestamp, value: startPrice },
        { time: (now + 60 * 60 * 24 * 365) as UTCTimestamp, value: startPrice },
      ])
    } else if (mode === 'trendline') {
      // トレンドライン: ドラッグ始点〜終点
      const t1 = xToTime(dragStartRef.current.x)
      const t2 = xToTime(e.clientX)
      if (!t1 || !t2 || t1 === t2) return
      const [tMin, tMax]   = t1 < t2 ? [t1, t2] : [t2, t1]
      const [pMin, pMax]   = t1 < t2 ? [startPrice, endPrice] : [endPrice, startPrice]
      previewSeriesRef.current.setData([
        { time: tMin, value: pMin },
        { time: tMax, value: pMax },
      ])
    }
  }, [yToPrice, xToTime])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false

    const preview = previewSeriesRef.current
    previewSeriesRef.current = null

    if (!preview || !dragStartRef.current) return

    // ドラッグ距離が短すぎる場合はキャンセル
    const dx = Math.abs(e.clientX - dragStartRef.current.x)
    const dy = Math.abs(e.clientY - dragStartRef.current.y)
    dragStartRef.current = null

    if (dx < 5 && dy < 5) {
      chartRef.current?.removeSeries(preview)
      return
    }

    // 確定：drawnLines に登録
    drawnLinesRef.current.push({ id: crypto.randomUUID(), series: preview })
  }, [])

  const handleMouseLeave = useCallback((e: React.MouseEvent) => {
    if (isDraggingRef.current) handleMouseUp(e)
  }, [handleMouseUp])

  // ─── undo / clear ─────────────────────────────────────────────────────────
  const handleUndo = () => {
    if (!chartRef.current) return
    const last = drawnLinesRef.current.pop()
    if (last) chartRef.current.removeSeries(last.series)
    if (previewSeriesRef.current) {
      chartRef.current.removeSeries(previewSeriesRef.current)
      previewSeriesRef.current = null
    }
  }

  const handleClearAll = () => {
    if (!chartRef.current) return
    drawnLinesRef.current.forEach(l => chartRef.current!.removeSeries(l.series))
    drawnLinesRef.current = []
  }

  const toggleMode = (mode: DrawMode) => {
    setDrawMode(prev => {
      const next = prev === mode ? 'none' : mode
      // 描画モード中はチャートのスクロール・ズームを無効化
      chartRef.current?.applyOptions({
        handleScroll: next === 'none',
        handleScale:  next === 'none',
      })
      return next
    })
  }

  // ─── data loading ─────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data } = await api.get(`/rates/${selectedSymbol}/history?timeframe=${selectedTimeframe}`)
      seriesRef.current?.setData(
        data.candles.map((c: any) => ({
          time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close,
        }))
      )
      chartRef.current?.timeScale().fitContent()
    }
    load()
  }, [selectedSymbol, selectedTimeframe])

  useEffect(() => {
    const rate = rates[selectedSymbol]
    if (!rate || !seriesRef.current) return
    const ts = Math.floor(Date.now() / 1000) as UTCTimestamp
    seriesRef.current.update({
      time: ts, open: rate.mid, high: rate.mid, low: rate.mid, close: rate.mid,
    } as CandlestickData)
  }, [rates, selectedSymbol])

  const rate  = rates[selectedSymbol]
  const isJPY = selectedSymbol.includes('JPY')
  const isDrawing = drawMode !== 'none'

  return (
    <div className="flex flex-col h-full bg-panel rounded-xl border border-border overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border flex-wrap">

        {/* Symbols */}
        <div className="flex gap-1">
          {SYMBOLS.map(s => (
            <button key={s} onClick={() => setSelectedSymbol(s)}
              className={`px-2 py-1 text-xs rounded font-mono transition-colors ${
                selectedSymbol === s ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}>
              {s}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Timeframes */}
        <div className="flex gap-1">
          {TIMEFRAMES.map(tf => (
            <button key={tf} onClick={() => setSelectedTimeframe(tf)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedTimeframe === tf ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}>
              {tf}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Drawing tools */}
        <div className="flex gap-1 items-center">
          <button
            onClick={() => toggleMode('hline')}
            title="ドラッグで水平線を引く"
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
              drawMode === 'hline' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            ─ 水平線
          </button>
          <button
            onClick={() => toggleMode('trendline')}
            title="ドラッグでトレンドラインを引く"
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
              drawMode === 'trendline' ? 'bg-indigo-400 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            ╱ トレンド
          </button>
          <button onClick={handleUndo}
            className="px-2 py-1 text-xs rounded text-slate-400 hover:text-red-400 hover:bg-white/5 transition-colors"
            title="1つ戻す">
            ↩
          </button>
          <button onClick={handleClearAll}
            className="px-2 py-1 text-xs rounded text-slate-400 hover:text-red-400 hover:bg-white/5 transition-colors"
            title="全消し">
            🗑
          </button>
        </div>

        {/* Hint */}
        {isDrawing && (
          <span className="text-xs text-amber-400 animate-pulse">
            {drawMode === 'hline' ? '水平線: ドラッグして引く' : 'トレンドライン: ドラッグして引く'}
          </span>
        )}

        {/* Live rate */}
        {rate && (
          <div className="ml-auto flex items-center gap-4 text-sm font-mono">
            <span className="text-slate-400 text-xs">{selectedSymbol}</span>
            <span className="text-up font-bold">{rate.ask.toFixed(isJPY ? 3 : 5)}</span>
            <span className="text-down font-bold">{rate.bid.toFixed(isJPY ? 3 : 5)}</span>
            <span className="text-slate-500 text-xs">SP:{(rate.spread / (isJPY ? 0.01 : 0.0001)).toFixed(1)}pips</span>
          </div>
        )}
      </div>

      {/* Chart canvas — mouse events only active in draw mode */}
      <div
        ref={containerRef}
        className="flex-1"
        style={{ cursor: isDrawing ? 'crosshair' : 'default' }}
        onMouseDown={isDrawing ? handleMouseDown : undefined}
        onMouseMove={isDrawing ? handleMouseMove : undefined}
        onMouseUp={isDrawing   ? handleMouseUp   : undefined}
        onMouseLeave={isDrawing ? handleMouseLeave : undefined}
      />
    </div>
  )
}
