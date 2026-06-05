import { CalendarCheck, CheckCircle2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ReservationForm } from '../components/ReservationForm'
import { RoomCard } from '../components/RoomCard'
import { SlotPicker } from '../components/SlotPicker'
import { rooms as fallbackRooms } from '../data/rooms'
import {
  findConflictingReservation,
  findConflictingRoomBlock,
  getTimeSlots,
} from '../domain/booking'
import type { Reservation, ReservationFormData, Room, RoomBlock, TimeSlot } from '../domain/types'
import {
  createPublicReservation,
  fetchRoomAvailability,
  fetchRooms,
  type AvailabilitySlot,
} from '../services/bookingApi'
import { getRoomBlocks } from '../services/reservationStore'

const today = new Date().toISOString().slice(0, 10)

export function UserBookingPage() {
  const [date, setDate] = useState(today)
  const [rooms, setRooms] = useState<Room[]>(fallbackRooms)
  const [selectedRoomId, setSelectedRoomId] = useState(fallbackRooms[0].id)
  const [selectedSlot, setSelectedSlot] = useState('')
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [availability, setAvailability] = useState<Record<string, AvailabilitySlot[]>>({})
  const [roomBlocks] = useState<RoomBlock[]>(() => getRoomBlocks())
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<ReservationFormData>(() =>
    emptyFormData(fallbackRooms[0].id, today, ''),
  )

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? rooms[0] ?? fallbackRooms[0]

  useEffect(() => {
    let isMounted = true

    fetchRooms()
      .then((apiRooms) => {
        if (!isMounted) {
          return
        }

        setRooms(apiRooms.map(mergeRoomMetadata))
      })
      .catch(() => {
        if (isMounted) {
          setMessage('Nu am putut incarca salile din API. Folosim lista locala temporar.')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    Promise.all(
      rooms.map((room) =>
        fetchRoomAvailability(room.id, date).then((roomAvailability) => [
          room.id,
          roomAvailability.slots,
        ] as const),
      ),
    )
      .then((entries) => {
        if (isMounted) {
          setAvailability(Object.fromEntries(entries))
        }
      })
      .catch(() => {
        if (isMounted) {
          setMessage('Nu am putut incarca disponibilitatea din API.')
        }
      })

    return () => {
      isMounted = false
    }
  }, [date, rooms])

  const availableCounts = useMemo(() => {
    return new Map(
      rooms.map((room) => [
        room.id,
        (availability[room.id] ?? getTimeSlots().map((slot) => ({ ...slot, available: true }))).filter(
          (slot) =>
            slot.available !== false &&
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
  }, [availability, date, reservations, roomBlocks, rooms])

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

  const handleSubmit = async () => {
    if (!formData.startTime) {
      setMessage('Alege un slot disponibil inainte de confirmare.')
      return
    }

    const conflict = findConflictingReservation(reservations, formData)
    if (conflict) {
      setMessage('Slotul a fost deja rezervat. Alege alta ora.')
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

    setIsSubmitting(true)

    try {
      const reservation = await createPublicReservation(formData)
      setReservations((current) => [reservation, ...current])
      setAvailability((current) => ({
        ...current,
        [reservation.roomId]: (current[reservation.roomId] ?? []).map((slot) =>
          slot.start === reservation.startTime ? { ...slot, available: false } : slot,
        ),
      }))
      setSelectedSlot('')
      setFormData(emptyFormData(selectedRoomId, date, ''))
      setMessage(`Rezervare confirmata pentru ${selectedRoom.name}, ora ${reservation.startTime}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Rezervarea nu a putut fi salvata.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-stack">
      <section className="hero-band">
        <div>
          <span className="eyebrow">Booking sali conferinta</span>
          <h1>Rezerva o sala</h1>
          <p>
            Alege data, sala si un slot de o ora intre 09:00 si 21:00. Nu ai nevoie
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
            slots={availability[selectedRoomId]}
            selectedSlot={selectedSlot}
            onSelectSlot={handleSlotSelect}
          />

          <ReservationForm
            value={formData}
            submitLabel={isSubmitting ? 'Se salveaza...' : 'Confirma rezervarea'}
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

function mergeRoomMetadata(room: Pick<Room, 'id' | 'name' | 'capacity'>): Room {
  const localRoom = fallbackRooms.find((item) => item.id === room.id)

  return {
    id: room.id,
    name: room.name,
    capacity: room.capacity,
    location: localRoom?.location ?? 'iHUB',
    amenities: localRoom?.amenities ?? [],
    accent: localRoom?.accent ?? '#74bd45',
  }
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
