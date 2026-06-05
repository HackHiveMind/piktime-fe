import {
  findConflictingReservation,
  findConflictingRoomBlock,
  getTimeSlots,
} from '../domain/booking'
import type { Reservation, RoomBlock, TimeSlot } from '../domain/types'

type SlotPickerProps = {
  roomId: string
  date: string
  reservations: Reservation[]
  roomBlocks: RoomBlock[]
  selectedSlot: string
  onSelectSlot: (slot: TimeSlot) => void
}

export function SlotPicker({
  roomId,
  date,
  reservations,
  roomBlocks,
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
            endTime: slot.end,
          }),
        )
        const isBlocked = Boolean(
          findConflictingRoomBlock(roomBlocks, {
            roomId,
            startTime: slot.start,
            endTime: slot.end,
          }),
        )
        const isSelected = selectedSlot === slot.start
        const slotState = isBlocked ? 'Blocat' : isBooked ? 'Ocupat' : 'Liber'

        return (
          <button
            key={slot.start}
            type="button"
            className={`slot-button ${isSelected ? 'selected' : ''}`}
            disabled={isBooked || isBlocked}
            onClick={() => onSelectSlot(slot)}
          >
            <strong>{slot.start}</strong>
            <span>{slotState}</span>
          </button>
        )
      })}
    </div>
  )
}
