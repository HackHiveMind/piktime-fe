# iHUB Moldova Booking FE

Frontend React + TypeScript pentru rezervarea salilor de conferinta.

## Functionalitati

- Interfata publica pentru rezervari fara cont.
- Sloturi fixe de o ora intre 09:00 si 21:00, inclusiv weekend.
- Formular public cu nume, prenume, email si telefon.
- Interfata admin la `/admin` cu calendar saptamanal.
- Adminul poate crea, edita si anula rezervari.
- Interfata publica foloseste API-ul Laravel pentru sali, disponibilitate si rezervari.
- Interfata admin foloseste momentan `localStorage`.

## Comenzi

```bash
npm install
npm run dev
npm test
npm run build
```

## Backend API

Porneste backend-ul Laravel, apoi seteaza API URL-ul pentru frontend:

```bash
cp .env.example .env
```

Valoarea implicita este:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

Pentru un port diferit, schimba `VITE_API_BASE_URL` in `.env` inainte de `npm run dev`.
