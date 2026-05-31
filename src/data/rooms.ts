import type { Room } from '../domain/types'

export const rooms: Room[] = [
  {
    id: 'orion',
    name: 'Sala Orion',
    capacity: 12,
    location: 'Etaj 1, zona nord',
    amenities: ['TV 75"', 'Whiteboard', 'Video call', 'Apa'],
    accent: '#0f766e',
  },
  {
    id: 'atlas',
    name: 'Sala Atlas',
    capacity: 20,
    location: 'Etaj 2, zona centrala',
    amenities: ['Proiector', 'Sunet', 'Video call', 'Flipchart'],
    accent: '#b45309',
  },
  {
    id: 'nova',
    name: 'Sala Nova',
    capacity: 8,
    location: 'Etaj 1, zona est',
    amenities: ['TV 55"', 'Whiteboard', 'Lumina naturala'],
    accent: '#2563eb',
  },
  {
    id: 'studio',
    name: 'Sala Studio',
    capacity: 6,
    location: 'Parter, zona linistita',
    amenities: ['Podcast setup', 'Monitor', 'Izolare fonica'],
    accent: '#7c3aed',
  },
]

