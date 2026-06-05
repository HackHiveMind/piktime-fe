import {
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { ReservationForm } from '../components/ReservationForm'
import { rooms } from '../data/rooms'
import {
  RESERVATION_STATUSES,
  createRoomBlock,
  filterReservations,
  findConflictingReservation,
  findConflictingRoomBlock,
  formatDisplayDate,
  getCalendarDates,
  getReservationStats,
  getTimeSlots,
  updateReservation,
} from '../domain/booking'
import type {
  CalendarView,
  Reservation,
  ReservationFormData,
  ReservationStatus,
  Room,
  RoomBlock,
  RoomBlockFormData,
} from '../domain/types'
import {
  deleteRoomBlock,
  deleteReservation,
  getRoomBlocks,
  getReservations,
  upsertRoomBlock,
  upsertReservation,
} from '../services/reservationStore'
import { createAdminReservation } from '../services/bookingApi'

const today = getToday()
const calendarViews: CalendarView[] = ['week', 'day', 'month']
const calendarViewLabels: Record<CalendarView, string> = {
  week: 'Weekly',
  day: 'Daily',
  month: 'Monthly',
  agenda: 'Agenda',
}

type AdminSection = 'calendar' | 'bookings' | 'customers' | 'rooms' | 'reports'

type ModalState =
  | { mode: 'create'; date: string; startTime: string; roomId: string }
  | { mode: 'edit'; reservation: Reservation }
  | { mode: 'block-create' }
  | { mode: 'block-edit'; block: RoomBlock }
  | null

const adminSections: Array<{
  value: AdminSection
  label: string
  icon: typeof CalendarDays
}> = [
  { value: 'calendar', label: 'Calendar', icon: CalendarDays },
  { value: 'bookings', label: 'Bookings', icon: ClipboardList },
  { value: 'customers', label: 'Customers', icon: Users },
  { value: 'rooms', label: 'Rooms', icon: Building2 },
  { value: 'reports', label: 'Reports', icon: BarChart3 },
]

export function AdminCalendarPage() {
  const [reservations, setReservations] = useState<Reservation[]>(() => getReservations())
  const [roomBlocks, setRoomBlocks] = useState<RoomBlock[]>(() => getRoomBlocks())
  const [section, setSection] = useState<AdminSection>('calendar')
  const [calendarView, setCalendarView] = useState<CalendarView>('day')
  const [anchorDate, setAnchorDate] = useState(() => reservations[0]?.date ?? today)
  const [roomFilter, setRoomFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>(null)
  const [formData, setFormData] = useState<ReservationFormData>(() =>
    emptyFormData(rooms[0].id, today, '09:00'),
  )
  const [blockFormData, setBlockFormData] = useState<RoomBlockFormData>(() =>
    emptyBlockFormData(rooms[0].id, '09:00', '10:00'),
  )
  const [additionalDates, setAdditionalDates] = useState<string[]>([])
  const [additionalDateDraft, setAdditionalDateDraft] = useState('')
  const [message, setMessage] = useState('')

  const calendarDates = useMemo(
    () => getCalendarDates(anchorDate, calendarView),
    [anchorDate, calendarView],
  )
  const visibleReservations = useMemo(
    () =>
      filterReservations(reservations, {
        roomId: roomFilter,
        status: statusFilter,
        search,
        dates: calendarDates,
      }),
    [calendarDates, reservations, roomFilter, search, statusFilter],
  )
  const stats = useMemo(() => getReservationStats(reservations, today), [reservations])
  const customers = useMemo(() => buildCustomers(visibleReservations), [visibleReservations])

  const openCreateModal = (date: string, startTime: string, endTime?: string, selectedRoomId?: string) => {
    const roomId = selectedRoomId ?? (roomFilter === 'all' ? rooms[0].id : roomFilter)
    setFormData(emptyFormData(roomId, date, startTime, endTime))
    setModal({ mode: 'create', date, startTime, roomId })
    setAdditionalDates([])
    setAdditionalDateDraft('')
    setMessage('')
  }

  const openBlockModal = (block?: RoomBlock) => {
    if (block) {
      setBlockFormData({
        roomId: block.roomId,
        startTime: block.startTime,
        endTime: block.endTime,
        notes: block.notes,
      })
      setModal({ mode: 'block-edit', block })
      setMessage('')
      return
    }

    const roomId = roomFilter === 'all' ? rooms[0].id : roomFilter
    setBlockFormData(emptyBlockFormData(roomId, '09:00', '10:00'))
    setModal({ mode: 'block-create' })
    setMessage('')
  }

  const openEditModal = (reservation: Reservation) => {
    setFormData({
      roomId: reservation.roomId,
      date: reservation.date,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      firstName: reservation.firstName,
      lastName: reservation.lastName,
      email: reservation.email,
      phone: reservation.phone,
      status: reservation.status,
      notes: reservation.notes,
    })
    setModal({ mode: 'edit', reservation })
    setAdditionalDates([])
    setAdditionalDateDraft('')
    setMessage('')
  }

  const openCopyModal = (reservation: Reservation) => {
    setFormData({
      roomId: reservation.roomId,
      date: reservation.date,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      firstName: reservation.firstName,
      lastName: reservation.lastName,
      email: reservation.email,
      phone: reservation.phone,
      status: reservation.status,
      notes: reservation.notes,
    })
    setModal({
      mode: 'create',
      date: reservation.date,
      startTime: reservation.startTime,
      roomId: reservation.roomId,
    })
    setAdditionalDates([])
    setAdditionalDateDraft('')
    setMessage('')
  }

  const addAdditionalDate = () => {
    if (!isDateInputValue(additionalDateDraft)) {
      setMessage('Alege o data valida inainte sa o adaugi.')
      return
    }

    if (additionalDateDraft === formData.date || additionalDates.includes(additionalDateDraft)) {
      setMessage('Data este deja in lista.')
      return
    }

    setAdditionalDates((current) => [...current, additionalDateDraft].sort())
    setAdditionalDateDraft('')
    setMessage('')
  }

  const removeAdditionalDate = (date: string) => {
    setAdditionalDates((current) => current.filter((item) => item !== date))
  }

  const handleSubmit = async () => {
    if (timeToMinutes(formData.endTime ?? getEndTimeLabel(formData.startTime)) <= timeToMinutes(formData.startTime)) {
      setMessage('Ora de final trebuie sa fie dupa ora de start.')
      return
    }

    const ignoreId = modal?.mode === 'edit' ? modal.reservation.id : undefined
    const conflict = findConflictingReservation(reservations, formData, ignoreId)

    if (conflict && formData.status !== 'cancelled') {
      setMessage('Exista deja o rezervare pentru sala, data si ora selectata.')
      return
    }

    const blockConflict = findConflictingRoomBlock(roomBlocks, {
      roomId: formData.roomId,
      startTime: formData.startTime,
      endTime: formData.endTime ?? getEndTimeLabel(formData.startTime),
    })
    if (blockConflict && formData.status !== 'cancelled') {
      setMessage('Sala este blocata in intervalul selectat.')
      return
    }

    if (modal?.mode === 'create') {
      const parsedDates = getBatchDates(formData.date, additionalDates)

      if (parsedDates.invalid.length > 0) {
        setMessage(`Date invalide: ${parsedDates.invalid.join(', ')}`)
        return
      }

      let nextReservations = reservations
      const skippedDates: string[] = []
      const createdReservations: Reservation[] = []

      for (const date of parsedDates.dates) {
        const nextFormData = { ...formData, date }
        const reservationConflict = findConflictingReservation(nextReservations, nextFormData)
        const blockConflict = findConflictingRoomBlock(roomBlocks, {
          roomId: nextFormData.roomId,
          startTime: nextFormData.startTime,
          endTime: nextFormData.endTime ?? getEndTimeLabel(nextFormData.startTime),
        })

        if (reservationConflict || blockConflict) {
          skippedDates.push(date)
          continue
        }

        try {
          const reservation = await createAdminReservation(nextFormData)
          nextReservations = upsertReservation(reservation)
          createdReservations.push(reservation)
        } catch {
          skippedDates.push(date)
        }
      }

      setReservations(nextReservations)
      setModal(null)
      setAdditionalDates([])
      setAdditionalDateDraft('')
      setMessage(getBatchCreateMessage(createdReservations.length, skippedDates))
      return
    }

    const reservation =
      modal?.mode === 'edit'
        ? updateReservation(modal.reservation, formData)
        : await createAdminReservation(formData)
    const nextReservations = upsertReservation(reservation)

    setReservations(nextReservations)
    setModal(null)
    setMessage(modal?.mode === 'edit' ? 'Booking updated.' : 'Booking created.')
  }

  const handleDeleteReservation = () => {
    if (modal?.mode !== 'edit') {
      return
    }

    const nextReservations = deleteReservation(modal.reservation.id)
    setReservations(nextReservations)
    setModal(null)
    setMessage('Booking removed.')
  }

  const handleBlockSubmit = () => {
    if (timeToMinutes(blockFormData.endTime) <= timeToMinutes(blockFormData.startTime)) {
      setMessage('Ora de final trebuie sa fie dupa ora de start.')
      return
    }

    const ignoreId = modal?.mode === 'block-edit' ? modal.block.id : undefined
    const blockConflict = findConflictingRoomBlock(roomBlocks, blockFormData, ignoreId)
    if (blockConflict) {
      setMessage('Sala este deja blocata in acest interval.')
      return
    }

    const block =
      modal?.mode === 'block-edit'
        ? {
            ...modal.block,
            ...blockFormData,
            notes: blockFormData.notes?.trim() ?? '',
          }
        : createRoomBlock(blockFormData)

    const nextBlocks = upsertRoomBlock(block)
    setRoomBlocks(nextBlocks)
    setModal(null)
    setMessage('Room block saved.')
  }

  const handleUnblock = () => {
    if (modal?.mode !== 'block-edit') {
      return
    }

    const nextBlocks = deleteRoomBlock(modal.block.id)
    setRoomBlocks(nextBlocks)
    setModal(null)
    setMessage('Room unblocked.')
  }

  const handleQuickStatus = (status: ReservationStatus) => {
    if (modal?.mode !== 'edit') {
      return
    }

    const nextReservation = updateReservation(modal.reservation, {
      ...formData,
      status,
    })
    const nextReservations = upsertReservation(nextReservation)

    setReservations(nextReservations)
    setModal(null)
    setMessage(`Booking marked as ${getStatusLabel(status)}.`)
  }

  const shiftCalendar = (direction: -1 | 1) => {
    const amount = calendarView === 'day' ? 1 : calendarView === 'month' ? 30 : 7
    setAnchorDate(addDays(anchorDate, amount * direction))
  }

  return (
    <div className="admin-workspace">
      <aside className="admin-sidebar" aria-label="Admin sections">
        <div className="admin-sidebar-brand">
          <img src="/ihub-logo.png" alt="iHUB Moldova" />
          <span>
            <strong>iHUB Admin</strong>
            <small>Picktime-style workspace</small>
          </span>
        </div>

        <nav className="admin-sidebar-nav">
          {adminSections.map((item) => {
            const Icon = item.icon
            return (
              <button
                type="button"
                key={item.value}
                className={section === item.value ? 'active' : undefined}
                onClick={() => setSection(item.value)}
              >
                <Icon size={18} />
                {item.label}
              </button>
            )
          })}
        </nav>
      </aside>

      <section className="admin-main">
        <header className="admin-header">
          <div>
            <span className="eyebrow">Admin calendar</span>
            <h1>Calendar admin</h1>
          </div>
          <div className="admin-header-actions">
            <button type="button" className="secondary-button admin-block-button" onClick={() => openBlockModal()}>
              Block time
            </button>
            <button type="button" className="primary-button admin-new-button" onClick={() => openCreateModal(today, '09:00', '10:00')}>
              <Plus size={18} />
              New booking
            </button>
          </div>
        </header>

        {message ? <p className="status-message standalone">{message}</p> : null}

        <section className="picktime-toolbar" aria-label="Calendar controls">
          <div className="filter-pill-row">
            <label className="picktime-pill-select">
              <select
                aria-label="Resource"
                value={roomFilter}
                onChange={(event) => setRoomFilter(event.target.value)}
              >
                <option value="all">All Resources</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="picktime-pill-select">
              <select
                aria-label="Status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as ReservationStatus | 'all')}
              >
                <option value="all">All Statuses</option>
                {RESERVATION_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="calendar-nav-group">
            <button type="button" className="text-button" onClick={() => setAnchorDate(today)}>
              Today
            </button>
            <button type="button" className="icon-button" aria-label="Previous period" onClick={() => shiftCalendar(-1)}>
              <ChevronLeft size={20} />
            </button>
            <button type="button" className="icon-button" aria-label="Next period" onClick={() => shiftCalendar(1)}>
              <ChevronRight size={20} />
            </button>
            <input
              aria-label="Calendar date"
              type="date"
              value={anchorDate}
              onChange={(event) => setAnchorDate(event.target.value)}
            />
          </div>

          <div className="view-switcher" aria-label="Calendar view">
            {calendarViews.map((view) => (
              <button
                type="button"
                key={view}
                className={calendarView === view ? 'active' : undefined}
                onClick={() => setCalendarView(view)}
              >
                {calendarViewLabels[view]}
              </button>
            ))}
          </div>

          <label className="search-control">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search booking, customer, phone"
            />
          </label>
        </section>

        {section === 'calendar' ? (
          <CalendarSection
            view={calendarView}
            dates={calendarDates}
            roomFilter={roomFilter}
            reservations={visibleReservations}
            roomBlocks={roomBlocks}
            onCreate={openCreateModal}
            onEdit={openEditModal}
            onEditBlock={openBlockModal}
          />
        ) : null}

        {section === 'bookings' ? (
          <BookingList reservations={visibleReservations} onEdit={openEditModal} />
        ) : null}

        {section === 'customers' ? <CustomerList customers={customers} /> : null}

        {section === 'rooms' ? <RoomOverview reservations={visibleReservations} /> : null}

        {section === 'reports' ? <ReportsPanel stats={stats} reservations={visibleReservations} /> : null}
      </section>

      {modal ? (
        <div className="modal-backdrop" role="presentation">
          {modal.mode === 'block-create' || modal.mode === 'block-edit' ? (
            <section className="modal-card picktime-modal" role="dialog" aria-modal="true" aria-labelledby="block-modal-title">
              <div className="modal-heading">
                <div>
                  <span className="eyebrow">
                    {blockFormData.startTime} - {blockFormData.endTime}
                  </span>
                  <h2 id="block-modal-title">
                    {modal.mode === 'block-edit' ? 'Blocked time' : 'Block time'}
                  </h2>
                </div>
                <button type="button" className="icon-button" aria-label="Close modal" onClick={() => setModal(null)}>
                  x
                </button>
              </div>

              <div className="form-grid">
                <label>
                  Room
                  <select
                    value={blockFormData.roomId}
                    onChange={(event) => setBlockFormData({ ...blockFormData, roomId: event.target.value })}
                  >
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Start time
                  <select
                    value={blockFormData.startTime}
                    onChange={(event) => {
                      const nextStartTime = event.target.value
                      const nextEndTime =
                        timeToMinutes(blockFormData.endTime) > timeToMinutes(nextStartTime)
                          ? blockFormData.endTime
                          : addMinutes(nextStartTime, 60)

                      setBlockFormData({
                        ...blockFormData,
                        startTime: nextStartTime,
                        endTime: nextEndTime,
                      })
                    }}
                  >
                    {getStartTimeOptions().map((slot) => (
                      <option key={slot.value} value={slot.value}>
                        {slot.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  End time
                  <select
                    value={blockFormData.endTime}
                    onChange={(event) => setBlockFormData({ ...blockFormData, endTime: event.target.value })}
                  >
                    {getEndTimeOptions(blockFormData.startTime).map((slot) => (
                      <option key={slot.value} value={slot.value}>
                        {slot.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Notes
                  <textarea
                    value={blockFormData.notes ?? ''}
                    onChange={(event) => setBlockFormData({ ...blockFormData, notes: event.target.value })}
                    placeholder="Internal notes"
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="primary-button" onClick={handleBlockSubmit}>
                  Block room
                </button>
                {modal.mode === 'block-edit' ? (
                  <button type="button" className="danger-button" onClick={handleUnblock}>
                    Unblock
                  </button>
                ) : null}
              </div>

              {message ? <p className="form-error">{message}</p> : null}
            </section>
          ) : (
          <section className="modal-card picktime-modal" role="dialog" aria-modal="true" aria-labelledby="reservation-modal-title">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">
                  {formData.date}, {formData.startTime} - {formData.endTime ?? getEndTimeLabel(formData.startTime)}
                </span>
                <h2 id="reservation-modal-title">
                  {modal.mode === 'edit' ? 'Booking details' : 'New booking'}
                </h2>
              </div>
              <button type="button" className="icon-button" aria-label="Close modal" onClick={() => setModal(null)}>
                x
              </button>
            </div>

            <div className="form-grid">
              <label>
                Date
                <input
                  type="date"
                  value={formData.date}
                  onChange={(event) => setFormData({ ...formData, date: event.target.value })}
                />
              </label>
              <label>
                Start time
                <select
                  value={formData.startTime}
                  onChange={(event) => {
                    const nextStartTime = event.target.value
                    const nextEndTime =
                      timeToMinutes(formData.endTime ?? '') > timeToMinutes(nextStartTime)
                        ? formData.endTime
                        : addMinutes(nextStartTime, 60)

                    setFormData({ ...formData, startTime: nextStartTime, endTime: nextEndTime })
                  }}
                >
                  {getStartTimeOptions().map((slot) => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                End time
                <select
                  value={formData.endTime ?? getEndTimeLabel(formData.startTime)}
                  onChange={(event) => setFormData({ ...formData, endTime: event.target.value })}
                >
                  {getEndTimeOptions(formData.startTime).map((slot) => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {modal.mode === 'create' ? (
              <div className="multi-date-field">
                <div className="multi-date-picker">
                  <label>
                    Additional date
                    <input
                      type="date"
                      value={additionalDateDraft}
                      onChange={(event) => setAdditionalDateDraft(event.target.value)}
                    />
                  </label>
                  <button type="button" className="secondary-button" onClick={addAdditionalDate}>
                    Add date
                  </button>
                </div>
                {additionalDates.length > 0 ? (
                  <div className="selected-date-list" aria-label="Selected additional dates">
                    {additionalDates.map((date) => (
                      <span key={date} className="selected-date-chip">
                        {date}
                        <button
                          type="button"
                          aria-label={`Remove ${date}`}
                          onClick={() => removeAdditionalDate(date)}
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <small>Occupied dates are skipped automatically.</small>
              </div>
            ) : null}

            <ReservationForm
              rooms={rooms}
              value={formData}
              submitLabel={modal.mode === 'edit' ? 'Save changes' : 'Create booking(s)'}
              onChange={setFormData}
              onSubmit={handleSubmit}
            />

            <div className="form-grid admin-extra-fields">
              <label>
                Status
                <select
                  value={formData.status ?? 'confirmed'}
                  onChange={(event) =>
                    setFormData({ ...formData, status: event.target.value as ReservationStatus })
                  }
                >
                  {RESERVATION_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Notes
                <textarea
                  value={formData.notes ?? ''}
                  onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
                  placeholder="Internal notes"
                />
              </label>
            </div>

            {modal.mode === 'edit' ? (
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => handleQuickStatus('confirmed')}>
                  <CheckCircle2 size={18} />
                  Confirm
                </button>
                <button type="button" className="text-button" onClick={() => handleQuickStatus('no-show')}>
                  Mark no-show
                </button>
                <button type="button" className="text-button" onClick={() => openCopyModal(modal.reservation)}>
                  Copy booking
                </button>
                <button type="button" className="danger-button" onClick={handleDeleteReservation}>
                  <Trash2 size={18} />
                  Delete booking
                </button>
              </div>
            ) : null}

            {message ? <p className="form-error">{message}</p> : null}
          </section>
          )}
        </div>
      ) : null}
    </div>
  )
}

function DashboardStats({
  stats,
}: {
  stats: ReturnType<typeof getReservationStats>
}) {
  const items = [
    { label: 'Today', value: stats.today },
    { label: 'Upcoming', value: stats.upcoming },
    { label: 'Pending', value: stats.pending },
    { label: 'Cancelled', value: stats.cancelled },
  ]

  return (
    <section className="admin-stat-grid" aria-label="Booking metrics">
      {items.map((item) => (
        <article key={item.label} className="admin-stat-card">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </article>
      ))}
    </section>
  )
}

function CalendarSection({
  view,
  dates,
  roomFilter,
  reservations,
  roomBlocks,
  onCreate,
  onEdit,
  onEditBlock,
}: {
  view: CalendarView
  dates: string[]
  roomFilter: string
  reservations: Reservation[]
  roomBlocks: RoomBlock[]
  onCreate: (date: string, startTime: string, endTime?: string, roomId?: string) => void
  onEdit: (reservation: Reservation) => void
  onEditBlock: (block: RoomBlock) => void
}) {
  if (view === 'agenda') {
    return <BookingList reservations={reservations} onEdit={onEdit} />
  }

  if (view === 'month') {
    return (
      <section className="month-grid">
        {dates.map((date) => {
          const dayReservations = reservations.filter((reservation) => reservation.date === date)

          return (
            <article key={date} className="month-cell">
              <div className="month-cell-heading">
                <strong>{formatDisplayDate(date)}</strong>
                <button type="button" className="cell-create-button" onClick={() => onCreate(date, '09:00')}>
                  <Plus size={14} />
                </button>
              </div>
              {dayReservations.slice(0, 3).map((reservation) => (
                <ReservationChip key={reservation.id} reservation={reservation} onEdit={onEdit} />
              ))}
              {dayReservations.length > 3 ? <small>+{dayReservations.length - 3} more</small> : null}
            </article>
          )
        })}
      </section>
    )
  }

  if (view === 'day') {
    return (
      <DailyResourceCalendar
        date={dates[0]}
        roomFilter={roomFilter}
        reservations={reservations}
        roomBlocks={roomBlocks}
        onCreate={onCreate}
        onEdit={onEdit}
        onEditBlock={onEditBlock}
      />
    )
  }

  return (
    <section className="calendar-shell picktime-calendar">
      <div className="calendar-grid" style={{ gridTemplateColumns: `80px repeat(${dates.length}, minmax(168px, 1fr))` }}>
        <div className="calendar-corner">Time</div>
        {dates.map((day) => (
          <div key={day} className="calendar-day-header">
            {formatDisplayDate(day)}
          </div>
        ))}

        {getTimeSlots().map((slot) => (
          <CalendarRow
            key={slot.start}
            slotStart={slot.start}
            days={dates}
            reservations={reservations}
            onCreate={onCreate}
            onEdit={onEdit}
          />
        ))}
      </div>
    </section>
  )
}

function DailyResourceCalendar({
  date,
  roomFilter,
  reservations,
  roomBlocks,
  onCreate,
  onEdit,
  onEditBlock,
}: {
  date: string
  roomFilter: string
  reservations: Reservation[]
  roomBlocks: RoomBlock[]
  onCreate: (date: string, startTime: string, endTime?: string, roomId?: string) => void
  onEdit: (reservation: Reservation) => void
  onEditBlock: (block: RoomBlock) => void
}) {
  const [dragSelection, setDragSelection] = useState<{
    roomId: string
    startTime: string
    endTime: string
  } | null>(null)
  const visibleRooms = roomFilter === 'all' ? rooms : rooms.filter((room) => room.id === roomFilter)
  const displaySlots = getDisplayTimeSlots()

  const beginSelection = (roomId: string, startTime: string) => {
    setDragSelection({ roomId, startTime, endTime: startTime })
  }

  const updateSelection = (roomId: string, endTime: string) => {
    setDragSelection((selection) =>
      selection && selection.roomId === roomId ? { ...selection, endTime } : selection,
    )
  }

  const finishSelection = (roomId: string, endTime: string) => {
    if (!dragSelection || dragSelection.roomId !== roomId) {
      return
    }

    const range = getSelectionRange(dragSelection.startTime, endTime)
    setDragSelection(null)
    onCreate(date, range.startTime, range.endTime, roomId)
  }

  return (
    <section className="daily-resource-calendar" aria-label="Daily resource calendar">
      <div
        className="daily-resource-grid"
        style={{ gridTemplateColumns: `62px repeat(${visibleRooms.length}, minmax(138px, 1fr))` }}
      >
        <div className="daily-resource-corner" />
        {visibleRooms.map((room) => (
          <div key={room.id} className="daily-resource-header">
            <span className="resource-avatar" style={{ '--room-accent': room.accent } as CSSProperties}>
              {room.name.slice(0, 1)}
            </span>
            <span>Book {room.name}</span>
          </div>
        ))}

        {displaySlots.map((slot) => (
          <DailyResourceRow
            key={slot.value}
            date={date}
            slot={slot}
            visibleRooms={visibleRooms}
            reservations={reservations}
            roomBlocks={roomBlocks}
            onEdit={onEdit}
            onEditBlock={onEditBlock}
            dragSelection={dragSelection}
            onBeginSelection={beginSelection}
            onUpdateSelection={updateSelection}
            onFinishSelection={finishSelection}
          />
        ))}
      </div>
    </section>
  )
}

function DailyResourceRow({
  date,
  slot,
  visibleRooms,
  reservations,
  roomBlocks,
  onEdit,
  onEditBlock,
  dragSelection,
  onBeginSelection,
  onUpdateSelection,
  onFinishSelection,
}: {
  date: string
  slot: { value: string; label: string; isBookable: boolean }
  visibleRooms: Room[]
  reservations: Reservation[]
  roomBlocks: RoomBlock[]
  onEdit: (reservation: Reservation) => void
  onEditBlock: (block: RoomBlock) => void
  dragSelection: { roomId: string; startTime: string; endTime: string } | null
  onBeginSelection: (roomId: string, startTime: string) => void
  onUpdateSelection: (roomId: string, endTime: string) => void
  onFinishSelection: (roomId: string, endTime: string) => void
}) {
  return (
    <>
      <div className="daily-time-label">{slot.label}</div>
      {visibleRooms.map((room) => {
        const cellReservations = reservations.filter(
          (reservation) =>
            reservation.date === date &&
            reservation.roomId === room.id &&
            reservation.startTime === slot.value,
        )
        const cellBlocks = roomBlocks.filter(
          (block) => block.roomId === room.id && block.startTime === slot.value,
        )
        const selectionRange =
          dragSelection && dragSelection.roomId === room.id
            ? getSelectionRange(dragSelection.startTime, dragSelection.endTime)
            : null
        const isSelectionStart = selectionRange?.startTime === slot.value

        return (
          <div
            key={`${room.id}-${slot.value}`}
            className={`daily-resource-cell ${
              selectionRange && isSlotInSelection(selectionRange, slot.value) ? 'selecting' : ''
            }`}
          >
            {isSelectionStart ? (
              <span className="selection-time-label">
                {formatCompactTime(selectionRange.startTime)} - {formatCompactTime(selectionRange.endTime)}
              </span>
            ) : null}
            {cellReservations.map((reservation) => (
              <ReservationBlock key={reservation.id} reservation={reservation} onEdit={onEdit} />
            ))}
            {cellBlocks.map((block) => (
              <RoomBlockBlock key={block.id} block={block} room={room} onEdit={onEditBlock} />
            ))}
            {slot.isBookable ? (
              <button
                type="button"
                className="daily-create-hitarea"
                onMouseDown={() => onBeginSelection(room.id, slot.value)}
                onMouseEnter={() => onUpdateSelection(room.id, slot.value)}
                onMouseUp={() => onFinishSelection(room.id, slot.value)}
                aria-label={`Select ${room.name} ${date} ${slot.value}`}
              />
            ) : null}
          </div>
        )
      })}
    </>
  )
}

function RoomBlockBlock({
  block,
  room,
  onEdit,
}: {
  block: RoomBlock
  room: Room
  onEdit: (block: RoomBlock) => void
}) {
  const span = getDurationSlotSpan(block.startTime, block.endTime)

  return (
    <button
      type="button"
      className="daily-room-block"
      style={{ '--block-span': span } as CSSProperties}
      onClick={() => onEdit(block)}
      aria-label={`Blocked ${room.name} ${formatCompactTime(block.startTime)} - ${formatCompactTime(block.endTime)}`}
    >
      <strong>
        Blocked {room.name} {formatCompactTime(block.startTime)} - {formatCompactTime(block.endTime)}
      </strong>
      <span>Blocked indefinitely</span>
    </button>
  )
}

function ReservationBlock({
  reservation,
  onEdit,
}: {
  reservation: Reservation
  onEdit: (reservation: Reservation) => void
}) {
  return (
    <button
      type="button"
      className={`daily-reservation-block status-${reservation.status}`}
      onClick={() => onEdit(reservation)}
    >
      <span>
        {formatCompactTime(reservation.startTime)} - {formatCompactTime(reservation.endTime)}
      </span>
      <strong>
        {reservation.firstName} {reservation.lastName}
      </strong>
    </button>
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
  onCreate: (date: string, startTime: string, endTime?: string, roomId?: string) => void
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
              <ReservationChip key={reservation.id} reservation={reservation} onEdit={onEdit} />
            ))}
            <button
              type="button"
              className="cell-create-button"
              onClick={() => onCreate(day, slotStart)}
              aria-label={`Create booking ${day} ${slotStart}`}
            >
              <Plus size={14} />
            </button>
          </div>
        )
      })}
    </>
  )
}

function ReservationChip({
  reservation,
  onEdit,
}: {
  reservation: Reservation
  onEdit: (reservation: Reservation) => void
}) {
  const room = getRoom(reservation.roomId)

  return (
    <button
      type="button"
      className={`reservation-chip status-${reservation.status}`}
      style={{ '--room-accent': room.accent } as CSSProperties}
      onClick={() => onEdit(reservation)}
    >
      <strong>
        {reservation.firstName} {reservation.lastName}
      </strong>
      <span>{room.name}</span>
      <small>{getStatusLabel(reservation.status)}</small>
    </button>
  )
}

function BookingList({
  reservations,
  onEdit,
}: {
  reservations: Reservation[]
  onEdit: (reservation: Reservation) => void
}) {
  return (
    <section className="reservation-list">
      <div className="section-heading-row">
        <h2>Bookings</h2>
        <span>{reservations.length} results</span>
      </div>
      <div className="reservation-list-grid">
        {reservations.length === 0 ? (
          <p className="empty-state">No bookings match the current filters.</p>
        ) : (
          reservations.map((reservation) => (
            <button
              type="button"
              key={reservation.id}
              className="reservation-row"
              onClick={() => onEdit(reservation)}
            >
              <span>
                <strong>
                  {reservation.firstName} {reservation.lastName}
                </strong>
                <small>{getRoom(reservation.roomId).name}</small>
              </span>
              <span>
                {reservation.date}, {reservation.startTime} - {reservation.endTime}
              </span>
              <span className={`status-pill status-${reservation.status}`}>
                {getStatusLabel(reservation.status)}
              </span>
            </button>
          ))
        )}
      </div>
    </section>
  )
}

function CustomerList({
  customers,
}: {
  customers: Array<{
    email: string
    name: string
    phone: string
    bookings: number
  }>
}) {
  return (
    <section className="reservation-list">
      <div className="section-heading-row">
        <h2>Customers</h2>
        <span>{customers.length} contacts</span>
      </div>
      <div className="customer-grid">
        {customers.map((customer) => (
          <article key={customer.email} className="customer-card">
            <strong>{customer.name}</strong>
            <span>
              <Mail size={15} />
              {customer.email}
            </span>
            <span>
              <Phone size={15} />
              {customer.phone}
            </span>
            <small>{customer.bookings} bookings</small>
          </article>
        ))}
        {customers.length === 0 ? <p className="empty-state">No customers match the filters.</p> : null}
      </div>
    </section>
  )
}

function RoomOverview({ reservations }: { reservations: Reservation[] }) {
  return (
    <section className="room-admin-grid">
      {rooms.map((room) => {
        const roomReservations = reservations.filter((reservation) => reservation.roomId === room.id)

        return (
          <article key={room.id} className="room-admin-card" style={{ '--room-accent': room.accent } as CSSProperties}>
            <span className="room-card-accent" />
            <strong>{room.name}</strong>
            <small>
              <MapPin size={15} />
              {room.location}
            </small>
            <span>{room.capacity} seats</span>
            <span>{roomReservations.length} visible bookings</span>
          </article>
        )
      })}
    </section>
  )
}

function ReportsPanel({
  stats,
  reservations,
}: {
  stats: ReturnType<typeof getReservationStats>
  reservations: Reservation[]
}) {
  return (
    <section className="reports-panel">
      <DashboardStats stats={stats} />
      <article className="reservation-list">
        <h2>Operational snapshot</h2>
        <p>
          {reservations.length} bookings are visible in the current date range and filters.
          Pending bookings should be confirmed before the meeting starts.
        </p>
      </article>
    </section>
  )
}

function buildCustomers(reservations: Reservation[]) {
  const customers = new Map<string, {
    email: string
    name: string
    phone: string
    bookings: number
  }>()

  reservations.forEach((reservation) => {
    const existing = customers.get(reservation.email)
    if (existing) {
      existing.bookings += 1
      return
    }

    customers.set(reservation.email, {
      email: reservation.email,
      name: `${reservation.firstName} ${reservation.lastName}`,
      phone: reservation.phone,
      bookings: 1,
    })
  })

  return Array.from(customers.values())
}

function getRoom(roomId: string) {
  return rooms.find((room) => room.id === roomId) ?? rooms[0]
}

function getStatusLabel(status: ReservationStatus): string {
  return RESERVATION_STATUSES.find((item) => item.value === status)?.label ?? 'Confirmed'
}

function emptyFormData(roomId: string, date: string, startTime: string, endTime?: string): ReservationFormData {
  return {
    roomId,
    date,
    startTime,
    endTime: endTime ?? addMinutes(startTime, 60),
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    status: 'confirmed',
    notes: '',
  }
}

function emptyBlockFormData(roomId: string, startTime: string, endTime: string): RoomBlockFormData {
  return {
    roomId,
    startTime,
    endTime,
    notes: '',
  }
}

function getBatchDates(primaryDate: string, additionalDates: string[]): {
  dates: string[]
  invalid: string[]
} {
  const rawDates = [primaryDate, ...additionalDates]
    .map((date) => date.trim())
    .filter(Boolean)
  const invalid = rawDates.filter((date) => !isDateInputValue(date))
  const dates = Array.from(new Set(rawDates.filter((date) => isDateInputValue(date))))

  return { dates, invalid }
}

function isDateInputValue(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false
  }

  return addDays(date, 0) === date
}

function getBatchCreateMessage(createdCount: number, skippedDates: string[]): string {
  const createdLabel = createdCount === 1 ? 'booking' : 'bookings'

  if (skippedDates.length === 0) {
    return `Created ${createdCount} ${createdLabel}.`
  }

  const skippedLabel = skippedDates.length === 1 ? 'date' : 'dates'
  return `Created ${createdCount} ${createdLabel}. Skipped ${skippedDates.length} occupied ${skippedLabel}: ${skippedDates.join(', ')}.`
}

function getEndTimeLabel(startTime: string): string {
  return addMinutes(startTime, 60)
}

function addDays(date: string, days: number): string {
  const nextDate = new Date(`${date}T12:00:00`)
  nextDate.setDate(nextDate.getDate() + days)
  return [
    nextDate.getFullYear(),
    String(nextDate.getMonth() + 1).padStart(2, '0'),
    String(nextDate.getDate()).padStart(2, '0'),
  ].join('-')
}

function getToday(): string {
  return addDays(new Date().toISOString().slice(0, 10), 0)
}

function getDisplayTimeSlots() {
  const slots: Array<{ value: string; label: string; isBookable: boolean }> = []

  for (let minutes = 8 * 60; minutes <= 21 * 60; minutes += 30) {
    const hour = Math.floor(minutes / 60)
    const minute = minutes % 60
    const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

    slots.push({
      value,
      label: formatSlotLabel(hour, minute),
      isBookable: hour >= 9 && hour <= 21,
    })
  }

  return slots
}

function formatSlotLabel(hour: number, minute: number): string {
  const suffix = hour >= 12 ? 'pm' : 'am'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12

  return minute === 0
    ? `${displayHour}${suffix}`
    : `${displayHour}:${String(minute).padStart(2, '0')}${suffix}`
}

function formatCompactTime(time: string): string {
  const hour = Number(time.slice(0, 2))
  const minute = Number(time.slice(3, 5))
  return formatSlotLabel(hour, minute).replace(':00', '')
}

function getStartTimeOptions() {
  return getDisplayTimeSlots()
    .filter((slot) => timeToMinutes(slot.value) >= 9 * 60 && timeToMinutes(slot.value) < 21 * 60)
    .map((slot) => ({ value: slot.value, label: slot.value }))
}

function getEndTimeOptions(startTime: string) {
  return getDisplayTimeSlots()
    .filter(
      (slot) =>
        timeToMinutes(slot.value) > timeToMinutes(startTime) &&
        timeToMinutes(slot.value) <= 21 * 60,
    )
    .map((slot) => ({ value: slot.value, label: slot.value }))
}

function getSelectionRange(firstTime: string, secondTime: string) {
  const firstMinutes = timeToMinutes(firstTime)
  const secondMinutes = timeToMinutes(secondTime)

  if (firstMinutes === secondMinutes) {
    return {
      startTime: firstTime,
      endTime: addMinutes(firstTime, 30),
    }
  }

  return firstMinutes < secondMinutes
    ? { startTime: firstTime, endTime: secondTime }
    : { startTime: secondTime, endTime: firstTime }
}

function isSlotInSelection(
  selection: { startTime: string; endTime: string },
  slotTime: string,
): boolean {
  const slotMinutes = timeToMinutes(slotTime)

  return slotMinutes >= timeToMinutes(selection.startTime) && slotMinutes < timeToMinutes(selection.endTime)
}

function getDurationSlotSpan(startTime: string, endTime: string): number {
  return Math.max(1, Math.ceil((timeToMinutes(endTime) - timeToMinutes(startTime)) / 30))
}

function addMinutes(time: string, minutesToAdd: number): string {
  const minutes = timeToMinutes(time) + minutesToAdd
  const hours = Math.floor(minutes / 60)
  const minutesPart = minutes % 60

  return `${String(hours).padStart(2, '0')}:${String(minutesPart).padStart(2, '0')}`
}

function timeToMinutes(time: string): number {
  if (!time) {
    return 0
  }

  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}
