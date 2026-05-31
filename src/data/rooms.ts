import type { Room } from '../domain/types'

export const rooms: Room[] = [
  {
    id: 'imeet',
    name: 'iMEET Room',
    capacity: 8,
    location: 'iHUB Green',
    amenities: ['TV', 'Whiteboard', 'Video call', 'Cafea/ceai'],
    accent: '#74bd45',
  },
  {
    id: 'loft',
    name: 'Loft Room',
    capacity: 8,
    location: 'iHUB Yellow',
    amenities: ['Monitor', 'Whiteboard', 'Internet rapid', 'Bucatarie'],
    accent: '#f7de05',
  },
  {
    id: 'green-conference',
    name: 'Green Conference Room',
    capacity: 20,
    location: 'Conference Room',
    amenities: ['Ecran 100 inch', 'Sistem audio/video', 'Flipchart', 'Suport IT'],
    accent: '#74bd45',
  },
  {
    id: 'yellow-conference',
    name: 'Yellow Conference Room',
    capacity: 30,
    location: 'Conference Room',
    amenities: ['Proiector', 'Internet', 'Flipchart', 'Suport IT'],
    accent: '#f7de05',
  },
]
