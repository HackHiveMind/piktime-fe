import { findConflictingReservation, getTimeSlots } from '../domain/booking'
import type { Reservation } from '../domain/types'

type SlotPickerProps = {
  roomId: string
  date: string
  reservations: Reservation[]
  selectedSlot: string
  onSelectSlot: (slot: string) => void
}

export function SlotPicker({
  roomId,
  date,
  reservations,
  selectedSlot,
  onSelectSlot,
}: SlotPickerProps) {
  return (
    <div className="slot-grid" aria-label="Sloturi disponibile">
      {getTimeSlots().map((slot) => {
        const isBooked = Boolean(
          findConflictingReservation(reservations, {
            roomId,
            date,
            startTime: slot.start,
          }),
        )
        const isSelected = selectedSlot === slot.start

        return (
          <button
            key={slot.start}
            type="button"
            className={`slot-button ${isSelected ? 'selected' : ''}`}
            disabled={isBooked}
            onClick={() => onSelectSlot(slot.start)}
          >
            <strong>{slot.start}</strong>
            <span>{isBooked ? 'Ocupat' : 'Liber'}</span>
          </button>
        )
      })}
    </div>
  )
}

