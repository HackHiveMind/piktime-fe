import { MapPin, Users } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { Room } from '../domain/types'

type RoomCardProps = {
  room: Room
  selected: boolean
  availableCount: number
  onSelect: () => void
}

export function RoomCard({ room, selected, availableCount, onSelect }: RoomCardProps) {
  return (
    <button
      type="button"
      className={`room-card ${room.imageUrl ? 'has-image' : ''} ${selected ? 'selected' : ''}`}
      style={{ '--room-accent': room.accent } as CSSProperties}
      onClick={onSelect}
    >
      <span className="room-card-accent" />
      <span className="room-card-content">
        <span className="room-card-heading">
          {room.imageUrl ? (
            <span className="room-card-avatar">
              <img src={room.imageUrl} alt={room.name} />
            </span>
          ) : null}
          <span className="room-card-title">{room.name}</span>
        </span>
        <span className="room-card-meta">
          <span>
            <Users size={16} />
            {room.capacity} persoane
          </span>
          <span>
            <MapPin size={16} />
            {room.location}
          </span>
        </span>
        <span className="availability-pill">{availableCount} sloturi libere</span>
      </span>
    </button>
  )
}
