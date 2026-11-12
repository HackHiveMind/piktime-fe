// @vitest-environment jsdom

import { afterEach, expect, it, vi } from 'vitest'
import { getBookingLocale } from './bookingLocale'

afterEach(() => vi.restoreAllMocks())

it.each([['ro-MD', 'ro'], ['en-US', 'en'], ['ru-RU', 'ru'], ['de-DE', 'ro']])('normalizes %s to %s', (language, expected) => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue([language])
  expect(getBookingLocale()).toBe(expected)
})

it('uses the first supported browser preference', () => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE', 'ru-RU', 'en-US'])
  expect(getBookingLocale()).toBe('ru')
})
