import { useEffect, useRef, useState } from 'react'
import type { Annotation } from '../../types'

type Point = { x: number; y: number }

type AnnotationCanvasProps = {
  width: number
  height: number
  currentTime: number
  annotations: Annotation[]
  onAddAnnotation: (annotation: Annotation) => void
}

const createId = () => crypto.randomUUID()

const getNormalizedPoint = (
  event: React.MouseEvent<HTMLCanvasElement>,
): Point => {
  const bounds = event.currentTarget.getBoundingClientRect()

  return {
    x: Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1),
    y: Math.min(Math.max((event.clientY - bounds.top) / bounds.height, 0), 1),
  }
}

export function AnnotationCanvas({
  width,
  height,
  currentTime,
  annotations,
  onAddAnnotation,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [points, setPoints] = useState<Point[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')

    if (!canvas || !context) {
      return
    }

    context.clearRect(0, 0, width, height)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = 4

    const drawPoints = (drawnPoints: Point[], color: string) => {
      if (drawnPoints.length < 2) {
        return
      }

      context.strokeStyle = color
      context.beginPath()
      drawnPoints.forEach((point, index) => {
        const x = point.x * width
        const y = point.y * height

        if (index === 0) {
          context.moveTo(x, y)
        } else {
          context.lineTo(x, y)
        }
      })
      context.stroke()
    }

    annotations
      .filter((annotation) => Math.abs(annotation.time - currentTime) <= 0.5)
      .forEach((annotation) => drawPoints(annotation.points, annotation.color))

    drawPoints(points, '#ef4444')
  }, [annotations, currentTime, height, points, width])

  return (
    <canvas
      ref={canvasRef}
      className="annotation-canvas"
      width={width}
      height={height}
      onMouseDown={(event) => {
        setIsDrawing(true)
        setPoints([getNormalizedPoint(event)])
      }}
      onMouseMove={(event) => {
        if (isDrawing) {
          setPoints((currentPoints) => [
            ...currentPoints,
            getNormalizedPoint(event),
          ])
        }
      }}
      onMouseUp={(event) => {
        if (!isDrawing) {
          return
        }

        const finalPoints = [...points, getNormalizedPoint(event)]
        if (finalPoints.length > 1) {
          onAddAnnotation({
            id: createId(),
            time: currentTime,
            points: finalPoints,
            color: '#ef4444',
          })
        }
        setIsDrawing(false)
        setPoints([])
      }}
      onMouseLeave={() => {
        setIsDrawing(false)
        setPoints([])
      }}
    />
  )
}
