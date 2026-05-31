# Pictime iHub Booking FE

Frontend React + TypeScript pentru rezervarea salilor de conferinta.

## Functionalitati

- Interfata publica pentru rezervari fara cont.
- Sloturi fixe de o ora intre 09:00 si 21:00, inclusiv weekend.
- Formular public cu nume, prenume, email si telefon.
- Interfata admin la `/admin` cu calendar saptamanal.
- Adminul poate crea, edita si anula rezervari.
- Datele sunt salvate momentan in `localStorage`.

## Comenzi

```bash
npm install
npm run dev
npm test
npm run build
```

## Urmatorul pas backend

Componentele folosesc `src/services/reservationStore.ts` ca layer de persistenta. Cand backend-ul Laravel este gata, acest serviciu poate fi inlocuit cu request-uri API fara sa rescriem fluxurile principale din UI.
