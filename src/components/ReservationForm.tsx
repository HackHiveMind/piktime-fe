import type { ReservationFormData, Room } from '../domain/types'

type ReservationFormProps = {
  rooms?: Room[]
  value: ReservationFormData
  submitLabel: string
  disabled?: boolean
  onChange: (nextValue: ReservationFormData) => void
  onSubmit: () => void
}

export function ReservationForm({
  rooms,
  value,
  submitLabel,
  disabled = false,
  onChange,
  onSubmit,
}: ReservationFormProps) {
  const updateField = (field: keyof ReservationFormData, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue })
  }

  return (
    <form
      className="booking-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      {rooms ? (
        <label>
          Sala
          <select value={value.roomId} onChange={(event) => updateField('roomId', event.target.value)}>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="form-grid">
        <label>
          Nume
          <input
            required
            value={value.lastName}
            onChange={(event) => updateField('lastName', event.target.value)}
            placeholder="Popescu"
          />
        </label>
        <label>
          Prenume
          <input
            required
            value={value.firstName}
            onChange={(event) => updateField('firstName', event.target.value)}
            placeholder="Ana"
          />
        </label>
      </div>

      <div className="form-grid">
        <label>
          Email
          <input
            required
            type="email"
            value={value.email}
            onChange={(event) => updateField('email', event.target.value)}
            placeholder="ana@gmail.com"
          />
        </label>
        <label>
          Telefon
          <input
            required
            value={value.phone}
            onChange={(event) => updateField('phone', event.target.value)}
            placeholder="069 123 456"
          />
        </label>
      </div>

      <button type="submit" className="primary-button" disabled={disabled}>
        {submitLabel}
      </button>
    </form>
  )
}
