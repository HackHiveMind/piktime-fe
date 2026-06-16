import { CalendarCheck, CheckCircle2, ChevronLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
  const navigate = useNavigate()
  const [date, setDate] = useState(today)
  const { rooms, availability, reservations, roomBlocks, message } = usePublicBookingData(date)
  const orderedRooms = useMemo(() => orderConferenceRoomsFirst(rooms), [rooms])
  const availableCounts = useAvailableCounts(orderedRooms, availability, reservations, roomBlocks, date)

  return (
    <div className="page-stack">
      <BookingHero
        title="Rezerva o sala"
        description="Alege data si sala. Sloturile de timp apar pe pagina salii selectate."
        date={date}
        onDateChange={setDate}
      />

      <section className="room-directory">
        <div className="section-heading-row room-picker-heading">
          <h2>Alege sala</h2>
          <span>{orderedRooms.length} sali</span>
        </div>
        <div className="room-list room-list-grid" aria-label="Sali disponibile">
          {orderedRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              selected={false}
              availableCount={availableCounts.get(room.id) ?? 0}
              onSelect={() => navigate(`/rooms/${room.id}?date=${date}`)}
            />
          ))}
        </div>
        {message ? (
          <p className="status-message">
            <CheckCircle2 size={18} />
            {message}
          </p>
        ) : null}
      </section>
    </div>
  )
}

export function RoomSlotsPage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [date, setDate] = useState(searchParams.get('date') || today)
  const { rooms, availability, reservations, roomBlocks, message } = usePublicBookingData(date)
  const room = findRoom(rooms, roomId)

  const handleDateChange = (nextDate: string) => {
    setDate(nextDate)
    setSearchParams({ date: nextDate })
  }

  const handleSlotSelect = (slot: TimeSlot) => {
    navigate(`/rooms/${roomId}/book?date=${date}&time=${slot.start}`)
  }

  if (!room) {
    return (
      <div className="page-stack">
        <BookingHero
          title="Sala nu a fost gasita"
          description="Alege o sala disponibila din lista."
          date={date}
          onDateChange={handleDateChange}
        />
        <Link className="text-button page-back-link" to="/">
          <ChevronLeft size={18} />
          Inapoi la sali
        </Link>
      </div>
    )
  }

  return (
    <div className="page-stack">
      <BookingHero
        title={room.name}
        description="Alege un slot disponibil. Dupa selectare vei merge la formularul de rezervare."
        date={date}
        onDateChange={handleDateChange}
      />

      <section className="booking-panel slot-page-panel">
        <div className="panel-heading">
          <div>
            <Link className="text-button page-back-link" to="/">
              <ChevronLeft size={18} />
              Toate salile
            </Link>
            <span className="eyebrow">{room.location}</span>
            <h2>Sloturi disponibile</h2>
          </div>
          <CalendarCheck size={28} />
        </div>

        <SlotPicker
          roomId={room.id}
          date={date}
          reservations={reservations}
          roomBlocks={roomBlocks}
          slots={availability[room.id]}
          selectedSlot=""
          onSelectSlot={handleSlotSelect}
        />

        {message ? (
          <p className="status-message">
            <CheckCircle2 size={18} />
            {message}
          </p>
        ) : null}
      </section>
    </div>
  )
}

export function RoomBookingFormPage() {
  const { roomId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const date = searchParams.get('date') || today
  const startTime = searchParams.get('time') || ''
  const { rooms, reservations, roomBlocks, setReservations, setAvailability, message, setMessage } =
    usePublicBookingData(date)
  const room = findRoom(rooms, roomId)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<ReservationFormData>(() =>
    emptyFormData(roomId, date, startTime),
  )
  const selectedSlot = getPublicBookingSlots().find((slot) => slot.start === startTime)

  useEffect(() => {
    setFormData((current) => ({
      ...current,
      roomId,
      date,
      startTime,
      endTime: selectedSlot?.end,
    }))
  }, [date, roomId, selectedSlot?.end, startTime])

  const handleSubmit = async () => {
    if (!room) {
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
      setMessage(`Rezervare confirmata pentru ${room.name}, ora ${reservation.startTime}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Rezervarea nu a putut fi salvata.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!room) {
    return (
      <div className="page-stack">
        <BookingHero
          title="Sala nu a fost gasita"
          description="Alege o sala disponibila din lista."
          date={date}
          onDateChange={() => undefined}
        />
        <Link className="text-button page-back-link" to="/">
          <ChevronLeft size={18} />
          Inapoi la sali
        </Link>
      </div>
    )
  }

  return (
    <div className="page-stack">
      <BookingHero
        title="Finalizeaza rezervarea"
        description={`${room.name}, ${date}, ora ${startTime || 'neselectata'}.`}
        date={date}
        onDateChange={() => undefined}
      />

      <section className="booking-panel booking-form-page">
        <div className="panel-heading">
          <div>
            <Link className="text-button page-back-link" to={`/rooms/${room.id}?date=${date}`}>
              <ChevronLeft size={18} />
              Inapoi la sloturi
            </Link>
            <span className="eyebrow">{room.location}</span>
            <h2>{room.name}</h2>
          </div>
          <CalendarCheck size={28} />
        </div>

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

function usePublicBookingData(date: string) {
  const [rooms, setRooms] = useState<Room[]>(fallbackRooms)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [availability, setAvailability] = useState<Record<string, AvailabilitySlot[]>>({})
  const [roomBlocks] = useState<RoomBlock[]>(() => getRoomBlocks())
  const [message, setMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    fetchRooms()
      .then((apiRooms) => {
        if (isMounted) {
          setRooms(apiRooms.map(mergeRoomMetadata))
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

  return {
    rooms,
    reservations,
    setReservations,
    availability,
    setAvailability,
    roomBlocks,
    message,
    setMessage,
  }
}

function useAvailableCounts(
  rooms: Room[],
  availability: Record<string, AvailabilitySlot[]>,
  reservations: Reservation[],
  roomBlocks: RoomBlock[],
  date: string,
) {
  return useMemo(() => {
    return new Map(
      rooms.map((room) => [
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
  }, [availability, date, reservations, roomBlocks, rooms])
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

function findRoom(rooms: Room[], roomId: string): Room | undefined {
  return rooms.find((room) => room.id === roomId) ?? fallbackRooms.find((room) => room.id === roomId)
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
