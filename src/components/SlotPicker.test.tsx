// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SlotPicker } from './SlotPicker'

afterEach(cleanup)

it('disables all slots until the server supplies availability', () => {
  render(<SlotPicker roomId="imeet" date="2030-11-04" reservations={[]} roomBlocks={[]}
    selectedSlot="" onSelectSlot={vi.fn()} />)
  for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
})

it('does not apply a dated block to a different date', () => {
  render(<SlotPicker roomId="imeet" date="2030-11-05" reservations={[]} roomBlocks={[
    { id: '1', roomId: 'imeet', date: '2030-11-04', startTime: '10:00', endTime: '11:00', notes: '', createdAt: '' },
  ]} slots={[{ start: '10:00', end: '11:00', label: '10:00', available: true }]}
    selectedSlot="" onSelectSlot={vi.fn()} />)
  expect(screen.getByRole('button', { name: /10:00Liber/ })).toBeEnabled()
})
