// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RoomScheduleEditor } from './RoomScheduleEditor'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('room schedules', () => {
  it('loads the shared schedule and saves a closed weekday to the backend', async () => {
    const hours = Array.from({ length: 7 }, () => ({ open: '09:00', close: '21:00' }))
    const request = vi.fn(async (_url: string, options?: RequestInit) => ({
      ok: true, status: 200,
      json: async () => ({ data: options?.method === 'PUT' ? JSON.parse(String(options.body)) : { opening_hours: hours } }),
    }))
    vi.stubGlobal('fetch', request)
    render(<RoomScheduleEditor roomId="imeet" />)

    fireEvent.click(await screen.findByLabelText('Luni'))
    fireEvent.click(screen.getByRole('button', { name: 'Salvează programul' }))

    await screen.findByText('Programul a fost salvat.')
    expect(request).toHaveBeenLastCalledWith('http://127.0.0.1:8000/api/admin/rooms/imeet/schedule', expect.objectContaining({
      method: 'PUT', body: JSON.stringify({ opening_hours: [null, ...hours.slice(1)] }),
    }))
  })

  it('does not report success when the backend rejects the schedule', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => ({
      ok: !options?.method, status: options?.method ? 422 : 200,
      json: async () => options?.method ? { message: 'Interval invalid.' }
        : { data: { opening_hours: Array.from({ length: 7 }, () => null) } },
    })))
    render(<RoomScheduleEditor roomId="imeet" />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvează programul' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Salvează programul' }))
    await screen.findByText('Interval invalid.')
    expect(screen.queryByText('Programul a fost salvat.')).not.toBeInTheDocument()
  })
})
