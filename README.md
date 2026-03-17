# CreateIt Backend

REST API and real-time server for **CreateIt** — a platform for students to collaborate, learn, and build projects with developers worldwide.

## Tech stack

- **Runtime:** Node.js (ES modules)
- **Framework:** Express 5
- **Database:** MongoDB (Mongoose)
- **Auth:** JWT, Google OAuth 2.0, optional OTP
- **Real-time:** Socket.IO (chat)
- **Security:** Helmet, CORS, rate limiting

## Getting started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- A `.env` file (see **Environment** below)

### Install and run

```bash
npm install
npm run server
```

By default the server listens on port **8000**. Health check: `GET /api/health`.

### Environment

Copy the required variables into a `.env` file in this directory. Core ones:

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default `8000`) |
| `MONGO_URL` or `FALLBACK_MONGO_URL` | MongoDB connection string |
| `JWT_SECRET` | Secret for JWT signing (min 8 chars, 16+ in production) |
| `CLIENT_ID` / `CLIENT_SECRET` | Google OAuth (if using Google login) |

Frontend URL, OAuth callback URLs, and CORS are derived from `NODE_ENV`: in **production** they point to your deployed frontend and backend; in **development** they use `localhost`. You can override with `FRONTEND_URL`, `ATLASSIAN_REDIRECT_URI`, and `GOOGLE_CALLBACK_URL` if needed.

Set `NODE_ENV=production` in production; leave unset or `development` for local.

## API overview

The API is mounted under `/api`. All authenticated routes expect the `Authorization` header with a Bearer JWT (obtained via login or OAuth).

- **Auth** — signup, login, OTP, Google OAuth
- **Projects** — create, list, like, delete (with optional file uploads)
- **Teams** — create, invite, join, Excalidraw and Kanban data
- **Tasks** — CRUD by project or team
- **Comments** — per-project comments
- **Chat** — rooms, DMs, message history (plus Socket.IO for live messages)
- **Jira** — OAuth, projects, issues, sync
- **Dashboard** — stats and activity
- **Mock interview** — problems, daily challenge, MCQ
- **Friends & notifications** — friend requests, project invites, read state
- **Admin** — users, teams, global activity (if enabled)

Responses are JSON. Errors use appropriate HTTP status codes and a `message` (and optional `error`) field.

## Real-time (Socket.IO)

Socket.IO is attached to the same HTTP server. Use the same origin and port. Connection and room joins are authenticated via JWT (query or auth header). See the client integration for event names and payloads.

## Project structure

```
server/
├── config/       # DB, env, passport
├── controllers/  # Request handlers
├── middleware/   # Auth, validation, errors
├── models/       # Mongoose models
├── routes/       # Express routers
├── services/     # Business logic, external APIs
├── utils/        # Helpers (e.g. email)
├── uploads/      # User uploads (gitignored)
└── server.js     # App entry
```

## License

ISC
