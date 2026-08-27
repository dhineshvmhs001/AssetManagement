# Asset Management

```text
asset/
├── frontend/     React (Vite)
├── backend/      Node + Express
├── infra/
├── .github/
└── doc/
```

## Backend layout

```text
backend/
├── server.js                 start the server
└── src/
    ├── app.js                Express app
    ├── config/               env, later DB
    ├── constants/            roles, asset status
    ├── middleware/           auth, errors
    ├── routes/               URL only — /api/...
    └── controllers/          request → response
```

Request flow: `route → middleware → controller`

## Frontend layout

```text
frontend/src/
├── api/                      talk to backend (one file per module)
├── components/               shared UI (Header, Sidebar, Button)
├── pages/                    one folder per screen + its CSS
└── styles/                   global + responsive.css (phones)
```

Each page: `PageName.jsx` + `PageName.css`  
Do **not** make a separate `mobile.js`. Phone layout uses CSS `@media`.

## Run

Terminal 1:
```bash
cd backend && npm run dev
```

Terminal 2:
```bash
cd frontend && npm run dev
```

- API: http://localhost:5000/api/health  
- Web: http://localhost:5173  
