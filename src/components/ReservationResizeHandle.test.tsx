// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ReservationResizeHandle } from './ReservationResizeHandle'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function setup(startTime = '10:00', endTime = '11:00') {
  vi.stubGlobal('PointerEvent', MouseEvent)
  const preview = vi.fn()
  const commit = vi.fn()
  render(<ReservationResizeHandle label="Durata" startTime={startTime} endTime={endTime} onPreview={preview} onCommit={commit} />)
  return { preview, commit, handle: screen.getByRole('slider') }
}

it('extends the end time in thirty-minute steps while preserving the start time', () => {
  const { handle, preview, commit } = setup()
  fireEvent.pointerDown(handle, { button: 0, clientY: 100 })
  fireEvent.pointerMove(handle, { clientY: 188 })
  expect(preview).toHaveBeenCalledWith('12:00')
  expect(commit).not.toHaveBeenCalled()
  fireEvent.pointerUp(handle, { clientY: 188 })
  expect(commit).toHaveBeenCalledExactlyOnceWith('12:00')
})

it('clamps resizing between a thirty-minute duration and the end of the day', () => {
  const { handle, preview, commit } = setup('20:00', '20:30')
  fireEvent.pointerDown(handle, { button: 0, clientY: 100 })
  fireEvent.pointerMove(handle, { clientY: 1000 })
  expect(preview).toHaveBeenLastCalledWith('21:00')
  fireEvent.pointerMove(handle, { clientY: -1000 })
  expect(preview).toHaveBeenLastCalledWith('20:30')
  fireEvent.pointerCancel(handle)
  expect(commit).not.toHaveBeenCalled()
})

it('supports extending the booking with the keyboard', () => {
  const { handle, commit } = setup()
  fireEvent.keyDown(handle, { key: 'ArrowDown' })
  expect(commit).toHaveBeenCalledExactlyOnceWith('11:30')
})
