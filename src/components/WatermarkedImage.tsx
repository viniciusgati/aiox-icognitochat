'use client'

import React, { useEffect, useRef, useState } from 'react'

interface Props {
  src: string
  alt: string
  username: string
  roomId: string
  timestamp: number
  className?: string
  onClick?: (e?: React.MouseEvent) => void
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  label: string
) {
  ctx.save()
  ctx.globalAlpha = 0.04
  ctx.fillStyle = 'white'
  ctx.font = '11px monospace'
  ctx.shadowColor = 'black'
  ctx.shadowBlur = 1
  ctx.translate(width / 2, height / 2)
  ctx.rotate(-Math.PI / 6)
  const step = 120
  for (let x = -width * 1.5; x < width * 1.5; x += step) {
    for (let y = -height * 1.5; y < height * 1.5; y += step) {
      ctx.fillText(label, x, y)
    }
  }
  ctx.restore()
}

export default function WatermarkedImage({
  src,
  alt,
  username,
  roomId,
  timestamp,
  className,
  onClick,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      setDimensions({ w: img.naturalWidth, h: img.naturalHeight })
      setLoaded(true)
    }
    img.onerror = () => setError(true)
    img.src = src
  }, [src])

  useEffect(() => {
    if (!loaded || !dimensions || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = dimensions.w
    canvas.height = dimensions.h

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      ctx.drawImage(img, 0, 0, dimensions.w, dimensions.h)
      const ts = new Date(timestamp).toISOString()
      const label = `${username} | ${roomId} | ${ts}`
      drawWatermark(ctx, dimensions.w, dimensions.h, label)
    }
    img.src = src
  }, [loaded, dimensions, src, username, roomId, timestamp])

  // Fallback: canvas not supported or image load error
  if (error || typeof document !== 'undefined' && !document.createElement('canvas').getContext) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} onClick={onClick} />
  }

  if (!loaded || !dimensions) {
    return (
      <div
        className={`bg-zinc-800 animate-pulse ${className ?? 'max-w-xs max-h-72'}`}
        style={dimensions ? { width: dimensions.w, height: dimensions.h } : { width: 200, height: 150 }}
      />
    )
  }

  return (
    <canvas
      ref={canvasRef}
      aria-label={alt}
      className={className}
      style={{ cursor: onClick ? 'zoom-in' : undefined, display: 'block' }}
      onClick={onClick}
    />
  )
}
