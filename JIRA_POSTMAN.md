# Test Jira APIs in Postman

Base URL: `http://localhost:8000` (or your server URL)

You need a **JWT** in the `Authorization` header for all requests below.

---

## 1. Get your JWT

**POST** `http://localhost:8000/api/auth/login`

- Body: **raw JSON**
```json
{
  "email": "your@email.com",
  "password": "yourpassword"
}
```

- Copy the `token` from the response. Use it as: `Bearer <token>`.

---

## 2. Jira – Check connection

**GET** `http://localhost:8000/api/jira/connection`

- Headers:
  - `Authorization`: `Bearer <your-jwt-token>`

- Expected: `{ "connected": true }` or `{ "connected": false }`. If false, connect Jira first (OAuth flow from your app).

---

## 3. Jira – Fetch projects

**GET** `http://localhost:8000/api/jira/projects`

- Headers:
  - `Authorization`: `Bearer <your-jwt-token>`

- Expected: `{ "success": true, "projects": [ ... ] }`  
  Each project has a **key** (e.g. `KAN`, `DEV`). You need this **key** for the tasks API.

---

## 4. Jira – Fetch tasks (issues) for a project

**URL must include `/api`.** Correct full URL:

**GET** `http://localhost:8000/api/jira/tasks/<projectKey>`

- If you use a Postman variable `{{dom}}`:
  - If `{{dom}}` = `http://localhost:8000` → use **`{{dom}}/api/jira/tasks/KAN`**
  - If `{{dom}}` = `http://localhost:8000/api` → use **`{{dom}}/jira/tasks/KAN`**
- Replace `KAN` with the **exact project key** from step 3 (case-sensitive).

Example:

**GET** `http://localhost:8000/api/jira/tasks/KAN`

- Headers:
  - `Authorization`: `Bearer <your-jwt-token>`

- Expected: `{ "success": true, "tasks": [ ... ] }`

**If you get 500 "JIRA connection is no longer valid":**

- The path is correct (you reached the server). The error means the stored Jira token/site is invalid for this request.
- Do this once: in your **app** go to **Settings → JIRA → Disconnect**, then **Connect** again and complete Atlassian login.
- Then in Postman call **GET /api/jira/connection** (step 2) — it should show `connected: true`. Then try step 4 again.

If you get 404 or other errors:

1. **projectKey** is the Jira project **key** (short code from step 3), not the project name or id.
2. Use the same JWT as for steps 2 and 3 (same user that has Jira connected).
3. That Jira site has a project with that key.

---

## Quick checklist

| Step | Method | URL | Auth |
|------|--------|-----|------|
| Login | POST | `/api/auth/login` | No (body: email, password) |
| Jira connection | GET | `/api/jira/connection` | Bearer JWT |
| Jira projects | GET | `/api/jira/projects` | Bearer JWT |
| Jira tasks | GET | `/api/jira/tasks/KAN` | Bearer JWT (use your project key instead of KAN) |
