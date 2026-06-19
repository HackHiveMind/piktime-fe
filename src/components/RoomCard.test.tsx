// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RoomCard } from './RoomCard'
import type { Room } from '../domain/types'

describe('RoomCard', () => {
  it('renders room photos as circular avatars', () => {
    render(
      <RoomCard
        room={roomWithImage}
        selected={false}
        availableCount={12}
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByAltText('Book LOFT').parentElement).toHaveClass('room-card-avatar')
    expect(screen.getByAltText('Book LOFT').closest('.room-card-heading')).toHaveTextContent('Book LOFT')
  })

  it('shows capacity without amenity tags', () => {
    const { container } = render(
      <RoomCard
        room={roomWithImage}
        selected={false}
        availableCount={12}
        onSelect={vi.fn()}
      />,
    )

    expect(within(container).getByText('12 persoane')).toBeInTheDocument()
    expect(within(container).queryByText('TV')).not.toBeInTheDocument()
  })
})

const roomWithImage: Room = {
  id: 'loft',
  name: 'Book LOFT',
  capacity: 12,
  businessId: 'chisinau',
  location: 'iHUB Chisinau',
  amenities: ['TV'],
  accent: '#74bd45',
  imageUrl: 'https://example.test/loft.jpg',
}
