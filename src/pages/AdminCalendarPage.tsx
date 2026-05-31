import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ReservationForm } from '../components/ReservationForm'
import { rooms } from '../data/rooms'
import {
  createReservation,
  findConflictingReservation,
  formatDisplayDate,
  getTimeSlots,
  updateReservation,
} from '../domain/booking'
import type { Reservation, ReservationFormData } from '../domain/types'
import {
  deleteReservation,
  getReservations,
  upsertReservation,
} from '../services/reservationStore'

const today = new Date().toISOString().slice(0, 10)

type ModalState =
  | { mode: 'create'; date: string; startTime: string; roomId: string }
  | { mode: 'edit'; reservation: Reservation }
  | null

export function AdminCalendarPage() {
  const [reservations, setReservations] = useState<Reservation[]>(() => getReservations())
  const [roomFilter, setRoomFilter] = useState('all')
  const [modal, setModal] = useState<ModalState>(null)
  const [formData, setFormData] = useState<ReservationFormData>(() =>
    emptyFormData(rooms[0].id, today, '09:00'),
  )
  const [message, setMessage] = useState('')

  const firstRelevantDate = reservations[0]?.date ?? today
  const [weekStart, setWeekStart] = useState(() => startOfWeek(firstRelevantDate))

  const weekDays = useMemo(() => buildWeekDays(weekStart), [weekStart])
  const visibleReservations = reservations.filter(
    (reservation) => roomFilter === 'all' || reservation.roomId === roomFilter,
  )

  const openCreateModal = (date: string, startTime: string) => {
    const roomId = roomFilter === 'all' ? rooms[0].id : roomFilter
    setFormData(emptyFormData(roomId, date, startTime))
    setModal({ mode: 'create', date, startTime, roomId })
    setMessage('')
  }

  const openEditModal = (reservation: Reservation) => {
    setFormData({
      roomId: reservation.roomId,
      date: reservation.date,
      startTime: reservation.startTime,
      firstName: reservation.firstName,
      lastName: reservation.lastName,
      email: reservation.email,
      phone: reservation.phone,
    })
    setModal({ mode: 'edit', reservation })
    setMessage('')
  }

  const handleSubmit = () => {
    const ignoreId = modal?.mode === 'edit' ? modal.reservation.id : undefined
    const conflict = findConflictingReservation(reservations, formData, ignoreId)

    if (conflict) {
      setMessage('Exista deja o rezervare pentru sala, data si ora selectata.')
      return
    }

    const reservation =
      modal?.mode === 'edit'
        ? updateReservation(modal.reservation, formData)
        : createReservation(formData)
    const nextReservations = upsertReservation(reservation)

    setReservations(nextReservations)
    setModal(null)
    setMessage(modal?.mode === 'edit' ? 'Rezervarea a fost actualizata.' : 'Rezervarea a fost creata.')
  }

  const handleCancelReservation = () => {
    if (modal?.mode !== 'edit') {
      return
    }

    const nextReservations = deleteReservation(modal.reservation.id)
    setReservations(nextReservations)
    setModal(null)
    setMessage('Rezervarea a fost anulata.')
  }

  return (
    <div className="page-stack admin-page">
      <section className="hero-band compact">
        <div>
          <span className="eyebrow">Admin</span>
          <h1>Calendar admin</h1>
          <p>Vezi cine a rezervat, creeaza rezervari, editeaza detalii sau anuleaza direct din calendar.</p>
        </div>
        <div className="admin-actions">
          <label className="date-control">
            Sala
            <select value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)}>
              <option value="all">Toate salile</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="secondary-button" onClick={() => openCreateModal(today, '09:00')}>
            <Plus size={18} />
            Rezervare
          </button>
        </div>
      </section>

      {message ? <p className="status-message standalone">{message}</p> : null}

      <section className="calendar-shell">
        <div className="calendar-toolbar">
          <button type="button" className="icon-button" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ChevronLeft size={20} />
          </button>
          <strong>
            {formatDisplayDate(weekDays[0])} - {formatDisplayDate(weekDays[6])}
          </strong>
          <button type="button" className="icon-button" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="calendar-grid">
          <div className="calendar-corner">Ora</div>
          {weekDays.map((day) => (
            <div key={day} className="calendar-day-header">
              {formatDisplayDate(day)}
            </div>
          ))}

          {getTimeSlots().map((slot) => (
            <CalendarRow
              key={slot.start}
              slotStart={slot.start}
              days={weekDays}
              reservations={visibleReservations}
              onCreate={openCreateModal}
              onEdit={openEditModal}
            />
          ))}
        </div>
      </section>

      <section className="reservation-list">
        <h2>Rezervari</h2>
        <div className="reservation-list-grid">
          {visibleReservations.length === 0 ? (
            <p className="empty-state">Nu exista rezervari salvate.</p>
          ) : (
            visibleReservations.map((reservation) => (
              <button
                type="button"
                key={reservation.id}
                className="reservation-row"
                onClick={() => openEditModal(reservation)}
              >
                <span>
                  <strong>
                    {reservation.firstName} {reservation.lastName}
                  </strong>
                  <small>{getRoomName(reservation.roomId)}</small>
                </span>
                <span>
                  {reservation.date}, {reservation.startTime} - {reservation.endTime}
                </span>
                <Pencil size={16} />
              </button>
            ))
          )}
        </div>
      </section>

      {modal ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="reservation-modal-title">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">{formData.date}, ora {formData.startTime}</span>
                <h2 id="reservation-modal-title">
                  {modal.mode === 'edit' ? 'Editeaza rezervarea' : 'Creeaza rezervare'}
                </h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setModal(null)}>
                x
              </button>
            </div>

            <div className="form-grid">
              <label>
                Data
                <input
                  type="date"
                  value={formData.date}
                  onChange={(event) => setFormData({ ...formData, date: event.target.value })}
                />
              </label>
              <label>
                Ora
                <select
                  value={formData.startTime}
                  onChange={(event) => setFormData({ ...formData, startTime: event.target.value })}
                >
                  {getTimeSlots().map((slot) => (
                    <option key={slot.start} value={slot.start}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <ReservationForm
              rooms={rooms}
              value={formData}
              submitLabel={modal.mode === 'edit' ? 'Salveaza modificarile' : 'Creeaza rezervarea'}
              onChange={setFormData}
              onSubmit={handleSubmit}
            />

            {modal.mode === 'edit' ? (
              <button type="button" className="danger-button" onClick={handleCancelReservation}>
                <Trash2 size={18} />
                Anuleaza rezervarea
              </button>
            ) : null}

            {message ? <p className="form-error">{message}</p> : null}
          </section>
        </div>
      ) : null}
    </div>
  )
}

function CalendarRow({
  slotStart,
  days,
  reservations,
  onCreate,
  onEdit,
}: {
  slotStart: string
  days: string[]
  reservations: Reservation[]
  onCreate: (date: string, startTime: string) => void
  onEdit: (reservation: Reservation) => void
}) {
  return (
    <>
      <div className="calendar-time">{slotStart}</div>
      {days.map((day) => {
        const cellReservations = reservations.filter(
          (reservation) => reservation.date === day && reservation.startTime === slotStart,
        )

        return (
          <div key={`${day}-${slotStart}`} className="calendar-cell">
            {cellReservations.map((reservation) => (
              <button
                type="button"
                key={reservation.id}
                className="reservation-chip"
                onClick={() => onEdit(reservation)}
              >
                <strong>
                  {reservation.firstName} {reservation.lastName}
                </strong>
                <span>{getRoomName(reservation.roomId)}</span>
              </button>
            ))}
            <button
              type="button"
              className="cell-create-button"
              onClick={() => onCreate(day, slotStart)}
              aria-label={`Creeaza rezervare ${day} ${slotStart}`}
            >
              <Plus size={14} />
            </button>
          </div>
        )
      })}
    </>
  )
}

function getRoomName(roomId: string): string {
  return rooms.find((room) => room.id === roomId)?.name ?? 'Sala necunoscuta'
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

function startOfWeek(date: string): string {
  const nextDate = new Date(`${date}T12:00:00`)
  const day = nextDate.getDay() || 7
  nextDate.setDate(nextDate.getDate() - day + 1)
  return toDateInputValue(nextDate)
}

function buildWeekDays(startDate: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(startDate, index))
}

function addDays(date: string, days: number): string {
  const nextDate = new Date(`${date}T12:00:00`)
  nextDate.setDate(nextDate.getDate() + days)
  return toDateInputValue(nextDate)
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10)
}

