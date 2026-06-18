import {
  BarChart3,
  Building2,
  CalendarDays,
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
import type { CSSProperties, DragEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { ReservationForm } from '../components/ReservationForm'
import { rooms as defaultRooms } from '../data/rooms'
import {
  RESERVATION_STATUSES,
  createReservation,
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
  saveReservations,
  upsertRoomBlock,
  upsertReservation,
} from '../services/reservationStore'
import {
  AdminApiAuthError,
  createAdminReservation,
  createAdminRoom,
  deleteAdminReservation,
  fetchAdminRooms,
  fetchAdminReservations,
  redirectToAdminLogin,
  updateAdminReservation,
  updateAdminRoom,
} from '../services/bookingApi'

const today = getToday()
const calendarViews: CalendarView[] = ['week', 'day', 'month']
const calendarViewLabels: Record<CalendarView, string> = {
  week: 'Weekly',
  day: 'Daily',
  month: 'Monthly',
  agenda: 'Agenda',
}

type AdminSection = 'calendar' | 'bookings' | 'customers' | 'rooms' | 'reports'
type BusinessResource = {
  id: string
  name: string
  shortName: string
  accent: string
}

type NewRoomForm = {
  name: string
  capacity: string
  businessId: string
  imageUrl: string
}

type ModalState =
  | { mode: 'create'; date: string; startTime: string; roomId: string; copySourceId?: string }
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

const businessResources: BusinessResource[] = [
  { id: 'chisinau', name: 'iHUB Chisinau', shortName: 'IH', accent: '#74bd45' },
  { id: 'yellow', name: 'iHUB Yellow', shortName: 'IH', accent: '#f7de05' },
]

const ROOMS_STORAGE_KEY = 'ihub-admin-rooms'
const ACTIVE_BUSINESS_STORAGE_KEY = 'ihub-admin-active-business'
const ROOM_IMAGE_MAX_DATA_URL_LENGTH = 900_000
const ROOM_IMAGE_MAX_DIMENSION = 900
const ROOM_IMAGE_QUALITIES = [0.82, 0.72, 0.62, 0.52, 0.42]

export function AdminCalendarPage() {
  const [rooms, setRooms] = useState<Room[]>(() => getStoredRooms())
  const [activeBusinessId, setActiveBusinessId] = useState(() => getStoredActiveBusinessId())
  const [businessMenuOpen, setBusinessMenuOpen] = useState(false)
  const [isAddingRoom, setIsAddingRoom] = useState(false)
  const [newRoomForm, setNewRoomForm] = useState(() => emptyRoomForm(businessResources[0].id))
  const [reservations, setReservations] = useState<Reservation[]>(() => getReservations())
  const [roomBlocks, setRoomBlocks] = useState<RoomBlock[]>(() => getRoomBlocks())
  const [section, setSection] = useState<AdminSection>('calendar')
  const [calendarView, setCalendarView] = useState<CalendarView>('day')
  const [anchorDate, setAnchorDate] = useState(today)
  const [roomFilter, setRoomFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>(null)
  const [formData, setFormData] = useState<ReservationFormData>(() =>
    emptyFormData(defaultRooms[0].id, today, '09:00'),
  )
  const [blockFormData, setBlockFormData] = useState<RoomBlockFormData>(() =>
    emptyBlockFormData(defaultRooms[0].id, '09:00', '10:00'),
  )
  const [additionalDates, setAdditionalDates] = useState<string[]>([])
  const [additionalDateDraft, setAdditionalDateDraft] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let isActive = true

    async function loadAdminData() {
      try {
        const backendRooms = await fetchAdminRooms()

        if (!isActive) {
          return
        }

        const normalizedRooms = withBusinessAssignments(backendRooms)
        saveStoredRooms(normalizedRooms)
        setRooms(normalizedRooms)
      } catch (error) {
        if (error instanceof AdminApiAuthError) {
          redirectToAdminLogin()
          return
        }

        // Keep stored room settings visible when the room API is temporarily unavailable.
      }

      try {
        const backendReservations = await fetchAdminReservations()

        if (!isActive) {
          return
        }

        saveReservations(backendReservations)
        setReservations(backendReservations)
      } catch (error) {
        if (error instanceof AdminApiAuthError) {
          redirectToAdminLogin()
          return
        }

        // Keep the local cache visible when the API is temporarily unavailable.
      }
    }

    loadAdminData()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    saveStoredRooms(rooms)
  }, [rooms])

  useEffect(() => {
    saveStoredActiveBusinessId(activeBusinessId)
  }, [activeBusinessId])

  const calendarDates = useMemo(
    () => getCalendarDates(anchorDate, calendarView),
    [anchorDate, calendarView],
  )
  const activeBusiness =
    businessResources.find((business) => business.id === activeBusinessId) ?? businessResources[0]
  const activeBusinessRooms = useMemo(
    () => rooms.filter((room) => getRoomBusinessId(room) === activeBusiness.id),
    [activeBusiness.id, rooms],
  )
  const activeBusinessRoomIds = useMemo(
    () => new Set(activeBusinessRooms.map((room) => room.id)),
    [activeBusinessRooms],
  )
  const effectiveRoomFilter =
    roomFilter === 'all' || activeBusinessRoomIds.has(roomFilter) ? roomFilter : 'all'
  const visibleReservations = useMemo(
    () =>
      filterReservations(reservations, {
        roomId: effectiveRoomFilter,
        status: statusFilter,
        search,
        dates: calendarDates,
      }).filter((reservation) => activeBusinessRoomIds.has(reservation.roomId)),
    [activeBusinessRoomIds, calendarDates, effectiveRoomFilter, reservations, search, statusFilter],
  )
  const stats = useMemo(() => getReservationStats(reservations, today), [reservations])
  const customers = useMemo(() => buildCustomers(visibleReservations), [visibleReservations])

  const openCreateModal = (date: string, startTime: string, endTime?: string, selectedRoomId?: string) => {
    const fallbackRoomId = activeBusinessRooms[0]?.id ?? rooms[0].id
    const roomId = selectedRoomId ?? (effectiveRoomFilter === 'all' ? fallbackRoomId : effectiveRoomFilter)
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

    const roomId = effectiveRoomFilter === 'all' ? activeBusinessRooms[0]?.id ?? rooms[0].id : effectiveRoomFilter
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
      copySourceId: reservation.id,
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
    const conflict =
      modal?.mode === 'edit'
        ? findConflictingReservation(reservations, formData, ignoreId)
        : undefined

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
      const optimisticReservations: Reservation[] = []
      const reservationRequests: Array<{
        date: string
        optimisticReservation: Reservation
        promise: Promise<Reservation>
      }> = []

      for (const date of parsedDates.dates) {
        const nextFormData = { ...formData, date }
        const blockConflict = findConflictingRoomBlock(roomBlocks, {
          roomId: nextFormData.roomId,
          startTime: nextFormData.startTime,
          endTime: nextFormData.endTime ?? getEndTimeLabel(nextFormData.startTime),
        })

        if (blockConflict) {
          skippedDates.push(date)
          continue
        }

        const reservationConflict = findConflictingReservation(nextReservations, nextFormData)

        if (reservationConflict && nextFormData.status !== 'cancelled') {
          skippedDates.push(date)
          continue
        }

        const optimisticReservation = createReservation(nextFormData)
        optimisticReservations.push(optimisticReservation)
        nextReservations = replaceReservationInMemory(nextReservations, optimisticReservation)
        reservationRequests.push({
          date,
          optimisticReservation,
          promise: createAdminReservation(nextFormData),
        })
      }

      saveReservations(nextReservations)
      setReservations(nextReservations)
      setModal(null)
      setAdditionalDates([])
      setAdditionalDateDraft('')
      setMessage(`Saving ${optimisticReservations.length} booking${optimisticReservations.length === 1 ? '' : 's'}...`)

      Promise.allSettled(reservationRequests.map((request) => request.promise)).then((reservationResults) => {
        const successCount = reservationResults.filter((result) => result.status === 'fulfilled').length

        setReservations((currentReservations) => {
          let resolvedReservations = currentReservations

          reservationResults.forEach((result, index) => {
            const request = reservationRequests[index]

            if (result.status === 'fulfilled') {
              resolvedReservations = replaceReservationInMemory(
                resolvedReservations.filter((reservation) => reservation.id !== request.optimisticReservation.id),
                result.value,
              )
              return
            }

            skippedDates.push(request.date)
            resolvedReservations = resolvedReservations.filter(
              (reservation) => reservation.id !== request.optimisticReservation.id,
            )
          })

          saveReservations(resolvedReservations)

          return resolvedReservations
        })
        setMessage(getBatchCreateMessage(successCount, skippedDates))
      })
      return
    }

    const reservation =
      modal?.mode === 'edit'
        ? await updateAdminReservation(updateReservation(modal.reservation, formData))
        : await createAdminReservation(formData)
    const nextReservations = upsertReservation(reservation)

    setReservations(nextReservations)
    setModal(null)
    setMessage(modal?.mode === 'edit' ? 'Booking updated.' : 'Booking created.')
  }

  const handleMoveReservation = async (
    reservationId: string,
    move: { date: string; startTime?: string; roomId?: string },
  ) => {
    const reservation = reservations.find((item) => item.id === reservationId)

    if (!reservation) {
      return
    }

    const duration = timeToMinutes(reservation.endTime) - timeToMinutes(reservation.startTime)
    const startTime = move.startTime ?? reservation.startTime
    const movedReservation: Reservation = {
      ...reservation,
      date: move.date,
      startTime,
      endTime: move.startTime ? addMinutes(startTime, duration) : reservation.endTime,
      roomId: move.roomId ?? reservation.roomId,
    }

    if (findConflictingReservation(reservations, movedReservation, reservation.id)) {
      setMessage('Exista deja o rezervare pentru sala, data si ora selectata.')
      return
    }

    if (findConflictingRoomBlock(roomBlocks, movedReservation)) {
      setMessage('Sala este blocata in intervalul selectat.')
      return
    }

    const optimisticReservations = reservations.map((item) =>
      item.id === reservation.id ? movedReservation : item,
    )
    setReservations(optimisticReservations)
    saveReservations(optimisticReservations)

    try {
      const savedReservation = await updateAdminReservation(movedReservation)
      const nextReservations = optimisticReservations.map((item) =>
        item.id === savedReservation.id ? savedReservation : item,
      )

      setReservations(nextReservations)
      saveReservations(nextReservations)
      setMessage('Booking moved.')
    } catch (error) {
      setReservations(reservations)
      saveReservations(reservations)
      setMessage(error instanceof Error ? `Booking move failed. ${error.message}` : 'Booking move failed.')
    }
  }

  const handleDeleteReservation = async () => {
    if (modal?.mode !== 'edit') {
      return
    }

    try {
      await deleteAdminReservation(modal.reservation.id)

      const nextReservations = deleteReservation(modal.reservation.id)
      setReservations(nextReservations)
      setModal(null)
      setMessage('Booking removed.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Booking could not be removed.')
    }
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

  const openAddRoomModal = () => {
    setNewRoomForm(emptyRoomForm(activeBusinessId))
    setBusinessMenuOpen(false)
    setIsAddingRoom(true)
  }

  const handleAddRoom = async () => {
    const name = newRoomForm.name.trim()
    const business = getBusinessById(newRoomForm.businessId)

    if (!name) {
      setMessage('Room name is required.')
      return
    }

    const room: Room = {
      id: getUniqueRoomId(name, rooms),
      name,
      capacity: Math.max(1, Number(newRoomForm.capacity) || 1),
      location: business.name,
      amenities: [],
      accent: '#f7de05',
      imageUrl: newRoomForm.imageUrl.trim(),
      businessId: business.id,
    }

    try {
      const savedRoom = await createAdminRoom(room)
      const normalizedRoom = withBusinessAssignments([savedRoom])[0]

      setRooms((currentRooms) => [...currentRooms.filter((item) => item.id !== normalizedRoom.id), normalizedRoom])
      setActiveBusinessId(business.id)
      setRoomFilter(normalizedRoom.id)
      setNewRoomForm(emptyRoomForm(business.id))
      setIsAddingRoom(false)
      setBusinessMenuOpen(false)
      setMessage(`${normalizedRoom.name} added.`)
    } catch (error) {
      setRooms((currentRooms) => [...currentRooms, room])
      setActiveBusinessId(business.id)
      setRoomFilter(room.id)
      setNewRoomForm(emptyRoomForm(business.id))
      setIsAddingRoom(false)
      setBusinessMenuOpen(false)
      setMessage(error instanceof Error ? `${room.name} saved locally. ${error.message}` : `${room.name} saved locally.`)
    }
  }

  const assignRoomBusiness = async (roomId: string, businessId: string) => {
    const business = getBusinessById(businessId)
    const nextRooms = rooms.map((room) =>
      room.id === roomId
        ? { ...room, businessId: business.id, location: business.name, accent: business.accent }
        : room,
    )
    const updatedRoom = nextRooms.find((room) => room.id === roomId)

    setRooms(nextRooms)

    if (!updatedRoom) {
      return
    }

    try {
      const savedRoom = await updateAdminRoom(updatedRoom)
      setRooms((currentRooms) =>
        currentRooms.map((room) => (room.id === roomId ? withBusinessAssignments([savedRoom])[0] : room)),
      )
      setMessage(`Room moved to ${business.name}.`)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Room moved locally to ${business.name}. ${error.message}`
          : `Room moved locally to ${business.name}.`,
      )
    }
  }

  const updateRoomImage = async (roomId: string, imageUrl: string) => {
    const nextRooms = rooms.map((room) => (room.id === roomId ? { ...room, imageUrl } : room))
    const updatedRoom = nextRooms.find((room) => room.id === roomId)

    setRooms(nextRooms)

    if (!updatedRoom) {
      return
    }

    try {
      const savedRoom = await updateAdminRoom(updatedRoom)
      setRooms((currentRooms) =>
        currentRooms.map((room) => (room.id === roomId ? withBusinessAssignments([savedRoom])[0] : room)),
      )
      setMessage('Room image updated.')
    } catch (error) {
      setMessage(error instanceof Error ? `Room image saved locally. ${error.message}` : 'Room image saved locally.')
    }
  }

  const updateNewRoomImageFromFile = async (file: File | null) => {
    if (!file) {
      return
    }

    try {
      const imageUrl = await readImageFile(file)

      setNewRoomForm((currentForm) => ({ ...currentForm, imageUrl }))
      setMessage('Room photo ready.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not prepare room photo.')
    }
  }

  const shiftCalendar = (direction: -1 | 1) => {
    const amount = calendarView === 'day' ? 1 : calendarView === 'month' ? 30 : 7
    setAnchorDate(addDays(anchorDate, amount * direction))
  }

  return (
    <div className="admin-workspace">
      <aside className="admin-sidebar" aria-label="Admin sections">
        <div className="business-switcher">
          <button
            type="button"
            className="admin-sidebar-brand"
            aria-label="Current business"
            aria-expanded={businessMenuOpen}
            onClick={() => setBusinessMenuOpen((isOpen) => !isOpen)}
          >
            <span className="business-avatar">{activeBusiness.shortName}</span>
            <span>
              <strong>{activeBusiness.name}</strong>
              <small>Switch business</small>
            </span>
          </button>
          {businessMenuOpen ? (
            <div className="business-menu">
              <div className="business-menu-heading">
                <span className="business-avatar">{activeBusiness.shortName}</span>
                <strong>{activeBusiness.name}</strong>
              </div>
              <small>Switch Business</small>
              {businessResources.map((business) => (
                <button
                  type="button"
                  key={business.id}
                  className={business.id === activeBusinessId ? 'active' : undefined}
                  aria-label={business.name}
                  onClick={() => {
                    setActiveBusinessId(business.id)
                    setRoomFilter('all')
                    setBusinessMenuOpen(false)
                  }}
                >
                  <span className="business-avatar">{business.shortName}</span>
                  {business.name}
                </button>
              ))}
              <button
                type="button"
                className="business-add-button"
                onClick={openAddRoomModal}
              >
                <Plus size={16} />
                Add room
              </button>
            </div>
          ) : null}
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
                value={effectiveRoomFilter}
                onChange={(event) => setRoomFilter(event.target.value)}
              >
                <option value="all">All Resources</option>
                {activeBusinessRooms.map((room) => (
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
            roomFilter={effectiveRoomFilter}
            rooms={activeBusinessRooms}
            reservations={visibleReservations}
            roomBlocks={roomBlocks}
            onCreate={openCreateModal}
            onEdit={openEditModal}
            onEditBlock={openBlockModal}
            onMove={handleMoveReservation}
          />
        ) : null}

        {section === 'bookings' ? (
          <BookingList rooms={activeBusinessRooms} reservations={visibleReservations} onEdit={openEditModal} />
        ) : null}

        {section === 'customers' ? <CustomerList customers={customers} /> : null}

        {section === 'rooms' ? (
          <RoomOverview
            rooms={activeBusinessRooms}
            businessResources={businessResources}
            reservations={visibleReservations}
            onAddRoom={openAddRoomModal}
            onAssignBusiness={assignRoomBusiness}
            onUpdateImage={updateRoomImage}
            onPhotoError={setMessage}
          />
        ) : null}

        {section === 'reports' ? <ReportsPanel stats={stats} reservations={visibleReservations} /> : null}
      </section>

      {isAddingRoom ? (
        <div className="modal-backdrop">
          <section className="modal-card picktime-modal" role="dialog" aria-modal="true" aria-labelledby="add-room-title">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Resources</span>
                <h2 id="add-room-title">Add room</h2>
              </div>
              <button type="button" className="icon-button" aria-label="Close" onClick={() => setIsAddingRoom(false)}>
                x
              </button>
            </div>
            <div className="form-grid">
              <label>
                Room name
                <input
                  value={newRoomForm.name}
                  onChange={(event) => setNewRoomForm({ ...newRoomForm, name: event.target.value })}
                  placeholder="Podcast Studio"
                />
              </label>
              <label>
                Capacity
                <input
                  type="number"
                  min="1"
                  value={newRoomForm.capacity}
                  onChange={(event) => setNewRoomForm({ ...newRoomForm, capacity: event.target.value })}
                />
              </label>
              <label>
                Business
                <select
                  value={newRoomForm.businessId}
                  onChange={(event) => setNewRoomForm({ ...newRoomForm, businessId: event.target.value })}
                >
                  {businessResources.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Room image URL
                <input
                  value={newRoomForm.imageUrl}
                  onChange={(event) => setNewRoomForm({ ...newRoomForm, imageUrl: event.target.value })}
                  placeholder="https://..."
                />
              </label>
              <label className="secondary-button photo-upload-button">
                <Plus size={18} />
                Add photo
                <input
                  className="photo-file-input"
                  type="file"
                  accept="image/*"
                  aria-label="Upload new room image"
                  onChange={(event) => {
                    void updateNewRoomImageFromFile(event.target.files?.[0] ?? null)
                  }}
                />
              </label>
            </div>
            {newRoomForm.imageUrl ? (
              <img className="room-image-preview" src={newRoomForm.imageUrl} alt="New room preview" />
            ) : null}
            <div className="modal-actions">
              <button type="button" className="text-button" onClick={() => setIsAddingRoom(false)}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={handleAddRoom}>
                Save room
              </button>
            </div>
          </section>
        </div>
      ) : null}

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
                    {activeBusinessRooms.map((room) => (
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
              rooms={activeBusinessRooms}
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
  rooms,
  reservations,
  roomBlocks,
  onCreate,
  onEdit,
  onEditBlock,
  onMove,
}: {
  view: CalendarView
  dates: string[]
  roomFilter: string
  rooms: Room[]
  reservations: Reservation[]
  roomBlocks: RoomBlock[]
  onCreate: (date: string, startTime: string, endTime?: string, roomId?: string) => void
  onEdit: (reservation: Reservation) => void
  onEditBlock: (block: RoomBlock) => void
  onMove: (reservationId: string, move: { date: string; startTime?: string; roomId?: string }) => void
}) {
  if (view === 'agenda') {
    return <BookingList rooms={rooms} reservations={reservations} onEdit={onEdit} />
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
              <div
                className="booking-drop-zone"
                aria-label={`Move booking to ${date}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleReservationDrop(event, (reservationId) => onMove(reservationId, { date }))}
              >
                {dayReservations.slice(0, 3).map((reservation) => (
                  <ReservationChip key={reservation.id} rooms={rooms} reservation={reservation} onEdit={onEdit} />
                ))}
              </div>
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
        rooms={rooms}
        reservations={reservations}
        roomBlocks={roomBlocks}
        onCreate={onCreate}
        onEdit={onEdit}
        onEditBlock={onEditBlock}
        onMove={onMove}
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
            rooms={rooms}
            onCreate={onCreate}
            onEdit={onEdit}
            onMove={onMove}
          />
        ))}
      </div>
    </section>
  )
}

function DailyResourceCalendar({
  date,
  roomFilter,
  rooms,
  reservations,
  roomBlocks,
  onCreate,
  onEdit,
  onEditBlock,
  onMove,
}: {
  date: string
  roomFilter: string
  rooms: Room[]
  reservations: Reservation[]
  roomBlocks: RoomBlock[]
  onCreate: (date: string, startTime: string, endTime?: string, roomId?: string) => void
  onEdit: (reservation: Reservation) => void
  onEditBlock: (block: RoomBlock) => void
  onMove: (reservationId: string, move: { date: string; startTime?: string; roomId?: string }) => void
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
            onMove={onMove}
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
  onMove,
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
  onMove: (reservationId: string, move: { date: string; startTime?: string; roomId?: string }) => void
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
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) =>
              handleReservationDrop(event, (reservationId) =>
                onMove(reservationId, { date, startTime: slot.value, roomId: room.id }),
              )
            }
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
      draggable
      onDragStart={(event) => handleReservationDragStart(event, reservation.id)}
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
  rooms,
  reservations,
  onCreate,
  onEdit,
  onMove,
}: {
  slotStart: string
  days: string[]
  rooms: Room[]
  reservations: Reservation[]
  onCreate: (date: string, startTime: string, endTime?: string, roomId?: string) => void
  onEdit: (reservation: Reservation) => void
  onMove: (reservationId: string, move: { date: string; startTime?: string; roomId?: string }) => void
}) {
  return (
    <>
      <div className="calendar-time">{slotStart}</div>
      {days.map((day) => {
        const cellReservations = reservations.filter(
          (reservation) => reservation.date === day && reservation.startTime === slotStart,
        )

        return (
          <div
            key={`${day}-${slotStart}`}
            className="calendar-cell"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) =>
              handleReservationDrop(event, (reservationId) =>
                onMove(reservationId, { date: day, startTime: slotStart }),
              )
            }
          >
            {cellReservations.map((reservation) => (
              <ReservationChip key={reservation.id} rooms={rooms} reservation={reservation} onEdit={onEdit} />
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
  rooms,
  reservation,
  onEdit,
}: {
  rooms: Room[]
  reservation: Reservation
  onEdit: (reservation: Reservation) => void
}) {
  const room = getRoom(reservation.roomId, rooms)

  return (
    <button
      type="button"
      className={`reservation-chip status-${reservation.status}`}
      style={{ '--room-accent': room.accent } as CSSProperties}
      draggable
      onDragStart={(event) => handleReservationDragStart(event, reservation.id)}
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

function handleReservationDragStart(event: DragEvent<HTMLElement>, reservationId: string) {
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', reservationId)
}

function handleReservationDrop(event: DragEvent<HTMLElement>, onDrop: (reservationId: string) => void) {
  event.preventDefault()

  const reservationId = event.dataTransfer.getData('text/plain')

  if (reservationId) {
    onDrop(reservationId)
  }
}

function BookingList({
  rooms,
  reservations,
  onEdit,
}: {
  rooms: Room[]
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
                <small>{getRoom(reservation.roomId, rooms).name}</small>
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

function RoomOverview({
  rooms,
  businessResources,
  reservations,
  onAddRoom,
  onAssignBusiness,
  onUpdateImage,
  onPhotoError,
}: {
  rooms: Room[]
  businessResources: BusinessResource[]
  reservations: Reservation[]
  onAddRoom: () => void
  onAssignBusiness: (roomId: string, businessId: string) => void
  onUpdateImage: (roomId: string, imageUrl: string) => void
  onPhotoError: (message: string) => void
}) {
  return (
    <section className="room-admin-section">
      <div className="section-heading-row">
        <h2>Rooms</h2>
        <button type="button" className="primary-button rooms-add-button" onClick={onAddRoom}>
          <Plus size={18} />
          Add room
        </button>
      </div>
      <div className="room-admin-grid">
        {rooms.map((room) => {
          const roomReservations = reservations.filter((reservation) => reservation.roomId === room.id)
          const roomBusinessId = getRoomBusinessId(room)

          return (
            <article
              key={room.id}
              className="room-admin-card"
              style={{ '--room-accent': getBusinessById(roomBusinessId).accent } as CSSProperties}
            >
              <span className="room-card-accent" />
              {room.imageUrl ? (
                <img className="room-admin-image" src={room.imageUrl} alt={`${room.name} preview`} />
              ) : null}
              <strong>{room.name}</strong>
              <small>
                <MapPin size={15} />
                {room.location}
              </small>
              <span>{room.capacity} seats</span>
              <span>{roomReservations.length} visible bookings</span>
              <label className="room-business-setting">
                Business
                <select
                  aria-label={`Business for ${room.name}`}
                  value={roomBusinessId}
                  onChange={(event) => onAssignBusiness(room.id, event.target.value)}
                >
                  {businessResources.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="room-business-setting">
                Image
                <input
                  aria-label={`Image for ${room.name}`}
                  value={room.imageUrl ?? ''}
                  onChange={(event) => onUpdateImage(room.id, event.target.value)}
                  placeholder="https://..."
                />
              </label>
              <label className="secondary-button photo-upload-button room-photo-button">
                <Plus size={18} />
                Add photo for {room.name}
                <input
                  className="photo-file-input"
                  aria-label={`Upload image for ${room.name}`}
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0]

                    if (file) {
                      void readImageFile(file)
                        .then((imageUrl) => onUpdateImage(room.id, imageUrl))
                        .catch((error) => {
                          onPhotoError(error instanceof Error ? error.message : 'Could not prepare room photo.')
                        })
                    }
                  }}
                />
              </label>
              {room.imageUrl ? (
                <button
                  type="button"
                  className="danger-button room-photo-button"
                  aria-label={`Delete photo for ${room.name}`}
                  onClick={() => onUpdateImage(room.id, '')}
                >
                  <Trash2 size={18} />
                  Delete photo
                </button>
              ) : null}
            </article>
          )
        })}
      </div>
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

function getRoom(roomId: string, rooms: Room[] = defaultRooms) {
  return rooms.find((room) => room.id === roomId) ?? rooms[0] ?? defaultRooms[0]
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

function emptyRoomForm(businessId: string): NewRoomForm {
  return {
    name: '',
    capacity: '8',
    businessId,
    imageUrl: '',
  }
}

function getStoredRooms(): Room[] {
  if (typeof localStorage === 'undefined') {
    return withBusinessAssignments(defaultRooms)
  }

  const storedRooms = readStoredRooms()
  if (storedRooms.length === 0) {
    return withBusinessAssignments(defaultRooms)
  }

  return mergeRooms(withBusinessAssignments(defaultRooms), storedRooms)
}

function readStoredRooms(): Room[] {
  try {
    const rawRooms = localStorage.getItem(ROOMS_STORAGE_KEY)
    if (!rawRooms) {
      return []
    }

    const parsedRooms: unknown = JSON.parse(rawRooms)
    if (!Array.isArray(parsedRooms)) {
      return []
    }

    return parsedRooms.filter(isRoom).map((room) => {
      const businessId = getRoomBusinessId(room)
      return {
        ...room,
        businessId,
        location: getBusinessById(businessId).name,
      }
    })
  } catch {
    return []
  }
}

function saveStoredRooms(rooms: Room[]) {
  localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(rooms))
}

function mergeRooms(defaultRooms: Room[], storedRooms: Room[]): Room[] {
  const storedById = new Map(storedRooms.map((room) => [room.id, room]))
  const mergedRooms = defaultRooms.map((room) => storedById.get(room.id) ?? room)
  const defaultIds = new Set(defaultRooms.map((room) => room.id))
  const addedRooms = storedRooms.filter((room) => !defaultIds.has(room.id))

  return [...mergedRooms, ...addedRooms]
}

function isRoom(value: unknown): value is Room {
  if (!value || typeof value !== 'object') {
    return false
  }

  const room = value as Partial<Room>
  return (
    typeof room.id === 'string' &&
    typeof room.name === 'string' &&
    typeof room.capacity === 'number' &&
    typeof room.location === 'string' &&
    Array.isArray(room.amenities) &&
    typeof room.accent === 'string'
  )
}

function getStoredActiveBusinessId(): string {
  if (typeof localStorage === 'undefined') {
    return businessResources[0].id
  }

  return getBusinessById(localStorage.getItem(ACTIVE_BUSINESS_STORAGE_KEY) ?? '').id
}

function saveStoredActiveBusinessId(businessId: string) {
  localStorage.setItem(ACTIVE_BUSINESS_STORAGE_KEY, getBusinessById(businessId).id)
}

function withBusinessAssignments(rooms: Room[]): Room[] {
  return rooms.map((room) => {
    const businessId = getDefaultBusinessId(room)
    return {
      ...room,
      businessId,
      location: getBusinessById(businessId).name,
    }
  })
}

async function readImageFile(file: File): Promise<string> {
  const originalDataUrl = await readFileAsDataUrl(file)

  if (originalDataUrl.length <= ROOM_IMAGE_MAX_DATA_URL_LENGTH) {
    return originalDataUrl
  }

  const compressedDataUrl = await compressImageDataUrl(originalDataUrl)

  if (compressedDataUrl.length <= ROOM_IMAGE_MAX_DATA_URL_LENGTH) {
    return compressedDataUrl
  }

  throw new Error('Photo is too large. Please choose a smaller image.')
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.addEventListener('load', () => {
      resolve(String(reader.result ?? ''))
    })
    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('Could not read image file.'))
    })
    reader.readAsDataURL(file)
  })
}

async function compressImageDataUrl(dataUrl: string): Promise<string> {
  const image = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    return dataUrl
  }

  const scale = Math.min(1, ROOM_IMAGE_MAX_DIMENSION / Math.max(image.width, image.height))
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  let bestDataUrl = dataUrl

  for (const quality of ROOM_IMAGE_QUALITIES) {
    const compressedDataUrl = canvas.toDataURL('image/jpeg', quality)

    if (compressedDataUrl.length < bestDataUrl.length) {
      bestDataUrl = compressedDataUrl
    }

    if (compressedDataUrl.length <= ROOM_IMAGE_MAX_DATA_URL_LENGTH) {
      return compressedDataUrl
    }
  }

  return bestDataUrl
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () => reject(new Error('Could not prepare room photo.')))
    image.src = dataUrl
  })
}

function getDefaultBusinessId(room: Room): string {
  if (room.businessId) {
    return room.businessId
  }

  if (room.id === 'loft') {
    return 'yellow'
  }

  if (room.id === 'yellow-conference') {
    return 'yellow'
  }

  if (room.id === 'green-conference') {
    return 'chisinau'
  }

  return 'chisinau'
}

function getRoomBusinessId(room: Room): string {
  return getBusinessById(room.businessId ?? getDefaultBusinessId(room)).id
}

function getBusinessById(businessId: string): BusinessResource {
  return businessResources.find((business) => business.id === businessId) ?? businessResources[0]
}

function getUniqueRoomId(name: string, rooms: Room[]): string {
  const baseId = slugify(name) || 'room'
  const existingIds = new Set(rooms.map((room) => room.id))

  if (!existingIds.has(baseId)) {
    return baseId
  }

  let index = 2
  while (existingIds.has(`${baseId}-${index}`)) {
    index += 1
  }

  return `${baseId}-${index}`
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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

function replaceReservationInMemory(
  reservations: Reservation[],
  reservation: Reservation,
): Reservation[] {
  const reservationStart = timeToMinutes(reservation.startTime)
  const reservationEnd = timeToMinutes(reservation.endTime)

  const filteredReservations = reservations.filter((item) => {
    if (item.id === reservation.id) {
      return false
    }

    if (item.roomId !== reservation.roomId || item.date !== reservation.date) {
      return true
    }

    const itemStart = timeToMinutes(item.startTime)
    const itemEnd = timeToMinutes(item.endTime)

    return !(itemStart < reservationEnd && reservationStart < itemEnd)
  })

  return [reservation, ...filteredReservations]
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
