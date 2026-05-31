# Conference Room Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first browser-only React + TypeScript conference room booking app with public booking and admin calendar management.

**Architecture:** The app uses Vite, React Router, domain helpers for booking rules, and a storage service that hides `localStorage` from components. This keeps the frontend usable now and easy to connect to a Laravel API later.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, React Router, lucide-react, CSS.

---

## File Structure

- `src/domain/booking.ts`: booking constants, slot generation, conflict checks, reservation creation/update helpers.
- `src/domain/types.ts`: shared room, reservation, and form types.
- `src/domain/booking.test.ts`: tests for slot and conflict behavior.
- `src/services/reservationStore.ts`: `localStorage` persistence wrapper.
- `src/services/reservationStore.test.ts`: tests for storage behavior.
- `src/data/rooms.ts`: four demo conference rooms.
- `src/pages/UserBookingPage.tsx`: public room and slot booking flow.
- `src/pages/AdminCalendarPage.tsx`: admin calendar, reservation creation, editing, and canceling.
- `src/components/*.tsx`: focused UI components.
- `src/App.tsx`, `src/main.tsx`: routing and bootstrap.
- `src/styles.css`: app styling.

## Tasks

### Task 1: Scaffold and Test Harness

- [ ] Create Vite React TypeScript app in the current directory.
- [ ] Install runtime dependencies: `react-router-dom`, `lucide-react`.
- [ ] Install test dependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`.
- [ ] Configure `npm test` to run Vitest.

### Task 2: Booking Domain, Test First

- [ ] Write failing tests for slot generation, conflict detection, and reservation creation in `src/domain/booking.test.ts`.
- [ ] Run `npm test -- src/domain/booking.test.ts` and verify the tests fail because the domain module is missing.
- [ ] Implement `src/domain/types.ts` and `src/domain/booking.ts`.
- [ ] Run `npm test -- src/domain/booking.test.ts` and verify the tests pass.

### Task 3: Reservation Store, Test First

- [ ] Write failing tests for loading, saving, upserting, and canceling reservations in `src/services/reservationStore.test.ts`.
- [ ] Run `npm test -- src/services/reservationStore.test.ts` and verify the tests fail because the store module is missing.
- [ ] Implement `src/services/reservationStore.ts`.
- [ ] Run `npm test -- src/services/reservationStore.test.ts` and verify the tests pass.

### Task 4: Public Booking UI

- [ ] Create demo room data.
- [ ] Build room cards, slot picker, and booking form components.
- [ ] Build `UserBookingPage` with date selection, room selection, slot selection, validation, and reservation saving.

### Task 5: Admin Calendar UI

- [ ] Build week calendar helpers and admin page state.
- [ ] Render 09:00-21:00 rows across seven days.
- [ ] Support room filtering.
- [ ] Add modal flow for creating, editing, and canceling reservations.

### Task 6: App Shell and Styling

- [ ] Configure routes for `/` and `/admin`.
- [ ] Style the public and admin interfaces with responsive layouts.
- [ ] Verify text and controls fit at desktop and mobile widths.

### Task 7: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Start the Vite dev server.
- [ ] Open the app in the browser and verify public booking and admin calendar flows.
