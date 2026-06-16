import { CalendarCheck, CheckCircle2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ReservationForm } from '../components/ReservationForm'
import { RoomCard } from '../components/RoomCard'
import { SlotPicker } from '../components/SlotPicker'
import { rooms as fallbackRooms } from '../data/rooms'
import {
  findConflictingReservation,
  findConflictingRoomBlock,
  getPublicBookingSlots,
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
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [availability, setAvailability] = useState<Record<string, AvailabilitySlot[]>>({})
  const [roomBlocks] = useState<RoomBlock[]>(() => getRoomBlocks())
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<ReservationFormData>(() =>
    emptyFormData('', today, ''),
  )
  const bookingPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let isMounted = true

    fetchRooms()
      .then((apiRooms) => {
        if (isMounted) {
          const nextRooms = apiRooms.map(mergeRoomMetadata)
          setRooms(nextRooms)
          setSelectedRoomId((currentRoomId) => {
            if (nextRooms.some((room) => room.id === currentRoomId)) {
              return currentRoomId
            }

            return ''
          })
        }
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

  const orderedRooms = useMemo(() => orderConferenceRoomsFirst(rooms), [rooms])
  const selectedRoom = orderedRooms.find((room) => room.id === selectedRoomId)
  const availableCounts = useMemo(() => {
    return new Map(
      orderedRooms.map((room) => [
        room.id,
        (availability[room.id] ?? getPublicBookingSlots().map((slot) => ({ ...slot, available: true }))).filter(
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
  }, [availability, date, orderedRooms, reservations, roomBlocks])

  const handleDateChange = (nextDate: string) => {
    setDate(nextDate)
    setSelectedSlot('')
    setMessage('')
    setFormData((current) => ({
      ...current,
      date: nextDate,
      startTime: '',
      endTime: undefined,
    }))
  }

  const handleRoomSelect = (room: Room) => {
    setSelectedRoomId(room.id)
    setSelectedSlot('')
    setMessage('')
    setFormData((current) => ({
      ...current,
      roomId: room.id,
      date,
      startTime: '',
      endTime: undefined,
    }))

    const focusBookingPanel = () => {
      bookingPanelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
      bookingPanelRef.current?.focus({ preventScroll: true })
    }

    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(focusBookingPanel)
    } else {
      focusBookingPanel()
    }
  }

  const handleSlotSelect = (slot: TimeSlot) => {
    if (!selectedRoom) {
      return
    }

    setSelectedSlot(slot.start)
    setMessage('')
    setFormData((current) => ({
      ...current,
      roomId: selectedRoom.id,
      date,
      startTime: slot.start,
      endTime: slot.end,
    }))
  }

  const handleSubmit = async () => {
    if (!selectedRoom) {
      setMessage('Alege o sala inainte de confirmare.')
      return
    }

    if (!formData.startTime) {
      setMessage('Alege un slot disponibil inainte de confirmare.')
      return
    }

    const validationMessage = getReservationValidationMessage(formData)
    if (validationMessage) {
      setMessage(validationMessage)
      return
    }

    if (findConflictingReservation(reservations, formData)) {
      setMessage('Slotul a fost deja rezervat. Alege alta ora.')
      return
    }

    if (
      findConflictingRoomBlock(roomBlocks, {
        roomId: formData.roomId,
        startTime: formData.startTime,
        endTime: formData.endTime ?? formData.startTime,
      })
    ) {
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
      setFormData((current) => emptyFormData(current.roomId, current.date, ''))
      setMessage(`Rezervare confirmata pentru ${selectedRoom.name}, ora ${reservation.startTime}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Rezervarea nu a putut fi salvata.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-stack">
      <BookingHero
        title="Rezerva o sala"
        description="Alege data si sala. Sloturile si formularul apar imediat pe aceeasi pagina."
        date={date}
        onDateChange={handleDateChange}
      />

      <section className="content-grid">
        <div className="room-select-panel">
          <div className="section-heading-row room-picker-heading">
            <h2>Alege sala</h2>
            <span>{orderedRooms.length} sali</span>
          </div>
          <div className="room-list room-list-grid" aria-label="Sali disponibile">
            {orderedRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                selected={room.id === selectedRoomId}
                availableCount={availableCounts.get(room.id) ?? 0}
                onSelect={() => handleRoomSelect(room)}
              />
            ))}
          </div>
        </div>

        {selectedRoom ? (
          <div ref={bookingPanelRef} className="booking-panel" tabIndex={-1}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">{selectedRoom.location}</span>
                <h2>{selectedRoom.name}</h2>
              </div>
              <CalendarCheck size={28} />
            </div>

            <SlotPicker
              roomId={selectedRoom.id}
              date={date}
              reservations={reservations}
              roomBlocks={roomBlocks}
              slots={availability[selectedRoom.id]}
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
        ) : (
          <div ref={bookingPanelRef} className="booking-panel empty-booking-panel" tabIndex={-1}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Selectie sala</span>
                <h2>Alege o sala</h2>
              </div>
              <CalendarCheck size={28} />
            </div>
            <p>Apasa pe un card de sala ca sa vezi sloturile si formularul de rezervare.</p>
          </div>
        )}
      </section>
    </div>
  )
}

function BookingHero({
  title,
  description,
  date,
  onDateChange,
}: {
  title: string
  description: string
  date: string
  onDateChange: (date: string) => void
}) {
  return (
    <section className="hero-band">
      <div>
        <span className="eyebrow">Booking sali conferinta</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <label className="date-control">
        Data rezervarii
        <input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
      </label>
    </section>
  )
}

function getReservationValidationMessage(formData: ReservationFormData): string {
  if (!formData.lastName.trim()) {
    return 'Completeaza numele.'
  }

  if (!formData.firstName.trim()) {
    return 'Completeaza prenumele.'
  }

  if (!formData.email.trim()) {
    return 'Completeaza emailul.'
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
    return 'Introdu un email valid.'
  }

  if (!formData.phone.trim()) {
    return 'Completeaza numarul de telefon.'
  }

  return ''
}

function mergeRoomMetadata(room: Room): Room {
  const localRoom = fallbackRooms.find((item) => item.id === room.id)

  return {
    id: room.id,
    name: room.name,
    capacity: room.capacity,
    businessId: room.businessId ?? localRoom?.businessId,
    location: room.location || localRoom?.location || 'iHUB',
    amenities: room.amenities.length > 0 ? room.amenities : localRoom?.amenities ?? [],
    accent: room.accent || localRoom?.accent || '#74bd45',
  }
}

function orderConferenceRoomsFirst(roomList: Room[]): Room[] {
  return [...roomList].sort((firstRoom, secondRoom) => {
    const firstScore = isConferenceRoom(firstRoom) ? 0 : 1
    const secondScore = isConferenceRoom(secondRoom) ? 0 : 1

    if (firstScore !== secondScore) {
      return firstScore - secondScore
    }

    return firstRoom.name.localeCompare(secondRoom.name)
  })
}

function isConferenceRoom(room: Room): boolean {
  const searchableText = `${room.name} ${room.location}`.toLowerCase()

  return searchableText.includes('conference') || searchableText.includes('conferinta')
}

function emptyFormData(roomId: string, date: string, startTime: string): ReservationFormData {
  const endTime = getPublicBookingSlots().find((slot) => slot.start === startTime)?.end

  return {
    roomId,
    date,
    startTime,
    endTime,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  }
}
