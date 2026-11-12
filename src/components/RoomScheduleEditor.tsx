import { useEffect, useState } from 'react'
import type { OpeningHours } from '../domain/types'
import { fetchRoomSchedule, saveRoomSchedule } from '../services/bookingApi'

const days = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică']

export function RoomScheduleEditor({ roomId }: { roomId: string }) {
  const [hours, setHours] = useState<OpeningHours | null>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    fetchRoomSchedule(roomId).then((value) => { if (active) setHours(value) })
      .catch(() => { if (active) setMessage('Programul nu a putut fi încărcat.') })
    return () => { active = false }
  }, [roomId])

  async function save() {
    if (!hours) return
    setSaving(true)
    try {
      await saveRoomSchedule(roomId, hours)
      setMessage('Programul a fost salvat.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Programul nu a putut fi salvat.')
    } finally {
      setSaving(false)
    }
  }

  return <section className="booking-panel">
    <h3>Program săptămânal · Europe/Chisinau</h3>
    <p>Intervale între 09:00 și 21:00. Rezervările existente se păstrează; programul se aplică rezervărilor noi și reprogramărilor.</p>
    {hours ? days.map((day, index) => {
      const entry = hours[index]
      return <div className="form-grid" key={day}>
        <label><input type="checkbox" checked={entry !== null} disabled={saving}
          onChange={(event) => setHours(hours.map((value, position) => position === index
            ? event.target.checked ? { open: '09:00', close: '21:00' } : null : value))} /> {day}</label>
        {entry && <>
          <label>Deschidere {day}<input type="time" min="09:00" max="21:00" value={entry.open} disabled={saving}
            onChange={(event) => setHours(hours.map((value, position) => position === index ? { ...entry, open: event.target.value } : value))} /></label>
          <label>Închidere {day}<input type="time" min="09:00" max="21:00" value={entry.close} disabled={saving}
            onChange={(event) => setHours(hours.map((value, position) => position === index ? { ...entry, close: event.target.value } : value))} /></label>
        </>}
      </div>
    }) : <p>Se încarcă programul…</p>}
    <button type="button" className="primary-button" disabled={!hours || saving} onClick={save}>
      {saving ? 'Se salvează…' : 'Salvează programul'}
    </button>
    {message && <p role="status">{message}</p>}
  </section>
}
