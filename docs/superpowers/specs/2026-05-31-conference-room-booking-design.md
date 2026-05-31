# Conference Room Booking App Design

## Goal

Build a separate React + TypeScript frontend repository for booking conference rooms. The first version runs fully in the browser with demo rooms and `localStorage` reservations, while keeping the code boundaries ready for a future Laravel API.

## Users

The app has two interfaces:

- Public user interface: anyone can reserve a room without an account.
- Admin interface: admins can view reservations in a calendar, edit them, cancel them, and create reservations directly.

## Booking Rules

- Reservations use fixed one-hour slots.
- Reservable hours are 09:00 through 21:00, meaning the last slot starts at 20:00 and ends at 21:00.
- Reservations are available every day, including weekends.
- A room cannot have two reservations for the same date and start time.
- Public users provide first name, last name, email, and phone.

## Public Interface

The public route shows demo conference rooms with name, capacity, location, amenities, and availability for the selected date. Users pick a room, choose an available one-hour slot, fill in contact details, and confirm the reservation. Once saved, the slot becomes unavailable.

## Admin Interface

The admin route shows a week-style calendar from 09:00 to 21:00. Reservations appear in the relevant day and hour cells with the room and guest name. Admins can:

- Create a reservation from an empty calendar slot.
- Open reservation details from an occupied slot.
- Edit guest details, room, date, and hour.
- Cancel a reservation.
- Filter by room when the calendar gets dense.

## Technical Design

- React + TypeScript + Vite.
- `react-router-dom` for `/` and `/admin`.
- `localStorage` service for reservations.
- Static room data in a dedicated data module.
- Domain helpers for slots, availability, and conflict validation.
- Components split around clear responsibilities: room cards, slot picker, booking form, admin calendar, and reservation modal.

## Future Laravel Integration

The UI will call a reservation service module rather than reading `localStorage` directly from components. In the Laravel phase, that service can be replaced with API calls while preserving the component contracts.
