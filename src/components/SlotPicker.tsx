import {
  findConflictingReservation,
  findConflictingRoomBlock,
  getPublicBookingSlots,
} from '../domain/booking'
import type { Reservation, RoomBlock, TimeSlot } from '../domain/types'
import type { AvailabilitySlot } from '../services/bookingApi'

type SlotPickerProps = {
  roomId: string
  date: string
  reservations: Reservation[]
  roomBlocks: RoomBlock[]
  slots?: AvailabilitySlot[]
  selectedSlot: string
  onSelectSlot: (slot: TimeSlot) => void
}

export function SlotPicker({
  roomId,
  date,
  reservations,
  roomBlocks,
  slots,
  selectedSlot,
  onSelectSlot,
}: SlotPickerProps) {
  const timeSlots = slots ?? getPublicBookingSlots().map((slot) => ({ ...slot, available: true }))

  return (
    <div className="slot-grid" aria-label="Sloturi disponibile">
      {timeSlots.map((slot) => {
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
        const isUnavailable = slot.available === false
        const slotState = isBlocked ? 'Blocat' : isBooked || isUnavailable ? 'Ocupat' : 'Liber'

        return (
          <button
            key={slot.start}
            type="button"
            className={`slot-button ${isSelected ? 'selected' : ''}`}
            disabled={isBooked || isBlocked || isUnavailable}
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
