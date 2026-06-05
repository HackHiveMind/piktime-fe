import { CalendarCheck, CheckCircle2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ReservationForm } from '../components/ReservationForm'
import { RoomCard } from '../components/RoomCard'
import { SlotPicker } from '../components/SlotPicker'
import { rooms } from '../data/rooms'
import {
  createReservation,
  findConflictingReservation,
  findConflictingRoomBlock,
  getTimeSlots,
} from '../domain/booking'
import type { Reservation, ReservationFormData, RoomBlock, TimeSlot } from '../domain/types'
import { getReservations, getRoomBlocks, upsertReservation } from '../services/reservationStore'

const today = new Date().toISOString().slice(0, 10)

export function UserBookingPage() {
  const [date, setDate] = useState(today)
  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0].id)
  const [selectedSlot, setSelectedSlot] = useState('')
  const [reservations, setReservations] = useState<Reservation[]>(() => getReservations())
  const [roomBlocks] = useState<RoomBlock[]>(() => getRoomBlocks())
  const [message, setMessage] = useState('')
  const [formData, setFormData] = useState<ReservationFormData>(() =>
    emptyFormData(rooms[0].id, today, ''),
  )

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? rooms[0]

  const availableCounts = useMemo(() => {
    return new Map(
      rooms.map((room) => [
        room.id,
        getTimeSlots().filter(
          (slot) =>
            !findConflictingReservation(reservations, {
              roomId: room.id,
              date,
              startTime: slot.start,
              endTime: slot.end,
            }) &&
            !findConflictingRoomBlock(roomBlocks, {
              roomId: room.id,
              startTime: slot.start,
              endTime: slot.end,
            }),
        ).length,
      ]),
    )
  }, [date, reservations, roomBlocks])

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoomId(roomId)
    setSelectedSlot('')
    setMessage('')
    setFormData((current) => ({ ...current, roomId, date, startTime: '', endTime: undefined }))
  }

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot.start)
    setMessage('')
    setFormData((current) => ({
      ...current,
      roomId: selectedRoomId,
      date,
      startTime: slot.start,
      endTime: slot.end,
    }))
  }

  const handleDateChange = (nextDate: string) => {
    setDate(nextDate)
    setSelectedSlot('')
    setMessage('')
    setFormData((current) => ({ ...current, date: nextDate, startTime: '', endTime: undefined }))
  }

  const handleSubmit = () => {
    if (!formData.startTime) {
      setMessage('Alege un slot disponibil inainte de confirmare.')
      return
    }

    const conflict = findConflictingReservation(reservations, formData)
    if (conflict) {
      setMessage('Slotul a fost deja rezervat. Alege alta ora.')
      setReservations(getReservations())
      return
    }

    const blockConflict = findConflictingRoomBlock(roomBlocks, {
      roomId: formData.roomId,
      startTime: formData.startTime,
      endTime: formData.endTime ?? formData.startTime,
    })
    if (blockConflict) {
      setMessage('Slotul este blocat de admin. Alege alta ora.')
      return
    }

    const reservation = createReservation(formData)
    const nextReservations = upsertReservation(reservation)
    setReservations(nextReservations)
    setSelectedSlot('')
    setFormData(emptyFormData(selectedRoomId, date, ''))
    setMessage(`Rezervare confirmata pentru ${selectedRoom.name}, ora ${reservation.startTime}.`)
  }

  return (
    <div className="page-stack">
      <section className="hero-band">
        <div>
          <span className="eyebrow">Booking sali conferinta</span>
          <h1>Rezerva o sala</h1>
          <p>
            Alege data, sala si un slot de 30 de minute intre 09:00 si 21:00. Nu ai nevoie
            de cont pentru prima versiune iHUB.
          </p>
        </div>
        <label className="date-control">
          Data rezervarii
          <input type="date" value={date} onChange={(event) => handleDateChange(event.target.value)} />
        </label>
      </section>

      <section className="content-grid">
        <div className="room-list">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              selected={room.id === selectedRoomId}
              availableCount={availableCounts.get(room.id) ?? 0}
              onSelect={() => handleRoomSelect(room.id)}
            />
          ))}
        </div>

        <div className="booking-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">{selectedRoom.location}</span>
              <h2>{selectedRoom.name}</h2>
            </div>
            <CalendarCheck size={28} />
          </div>

          <SlotPicker
            roomId={selectedRoomId}
            date={date}
            reservations={reservations}
            roomBlocks={roomBlocks}
            selectedSlot={selectedSlot}
            onSelectSlot={handleSlotSelect}
          />

          <ReservationForm
            value={formData}
            submitLabel="Confirma rezervarea"
            onChange={setFormData}
            onSubmit={handleSubmit}
          />

          {message ? (
            <p className="status-message">
              <CheckCircle2 size={18} />
              {message}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  )
}

function emptyFormData(roomId: string, date: string, startTime: string): ReservationFormData {
  return {
    roomId,
    date,
    startTime,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  }
}
