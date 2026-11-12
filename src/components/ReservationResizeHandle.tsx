import { useRef } from 'react'

type Props = {
  label: string
  startTime: string
  endTime: string
  onPreview: (endTime: string | null) => void
  onCommit: (endTime: string) => void
}

function minutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

function timeFromMinutes(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

export function ReservationResizeHandle({ label, startTime, endTime, onPreview, onCommit }: Props) {
  const dragging = useRef<{ pointerId: number; startY: number; rowHeight: number; originalEnd: number; nextEnd: number } | null>(null)
  const minimum = minutes(startTime) + 30
  const maximum = 21 * 60
  const clamp = (value: number) => Math.max(minimum, Math.min(maximum, value))

  return <span className="reservation-resize-handle" role="slider" tabIndex={0}
    aria-label={label} aria-orientation="vertical" aria-valuemin={minimum} aria-valuemax={maximum}
    aria-valuenow={minutes(endTime)} aria-valuetext={endTime}
    title="Trage în jos pentru a prelungi rezervarea. Săgețile sus/jos modifică durata cu 30 de minute."
    onClick={(event) => event.stopPropagation()}
    onDragStart={(event) => event.preventDefault()}
    onPointerDown={(event) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      const originalEnd = minutes(endTime)
      dragging.current = { pointerId: event.pointerId, startY: event.clientY,
        rowHeight: event.currentTarget.closest('.daily-resource-cell')?.getBoundingClientRect().height || 44,
        originalEnd, nextEnd: originalEnd }
      event.currentTarget.setPointerCapture?.(event.pointerId)
    }}
    onPointerMove={(event) => {
      const current = dragging.current
      if (!current || current.pointerId !== event.pointerId) return
      const steps = Math.round((event.clientY - current.startY) / current.rowHeight)
      current.nextEnd = clamp(current.originalEnd + steps * 30)
      onPreview(timeFromMinutes(current.nextEnd))
    }}
    onPointerUp={(event) => {
      const current = dragging.current
      if (!current || current.pointerId !== event.pointerId) return
      dragging.current = null
      event.currentTarget.releasePointerCapture?.(event.pointerId)
      onPreview(null)
      if (current.nextEnd !== current.originalEnd) onCommit(timeFromMinutes(current.nextEnd))
    }}
    onPointerCancel={() => { dragging.current = null; onPreview(null) }}
    onKeyDown={(event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      event.preventDefault()
      event.stopPropagation()
      const next = clamp(minutes(endTime) + (event.key === 'ArrowDown' ? 30 : -30))
      if (next !== minutes(endTime)) onCommit(timeFromMinutes(next))
    }}
  ><span aria-hidden="true">⋮</span></span>
}
