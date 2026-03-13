# CreateIt Backend – API Documentation

Base URL: `/api`  
All authenticated routes require header: `Authorization: Bearer <token>`

---

## 1. Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api` | No | Health check |

**Status codes:** `200` – `{ message: "API is working ✅" }`

---

## 2. Auth (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | No | Register |
| POST | `/api/auth/login` | No | Login |
| GET | `/api/auth/google` | No | Start Google OAuth |
| GET | `/api/auth/google/callback` | No | Google OAuth callback (redirect) |
| POST | `/api/auth/send-otp` | No | Send OTP to email |
| POST | `/api/auth/verify-otp` | No | Verify OTP and get token |

### POST `/api/auth/signup`

**Body:** `fullName`, `email`, `phone`, `password`, `dob` (required); `profileImage`, `collegeName`, `degreeName`, `currentSemester`, `preferredLanguage`, `pastProjects`, `purpose`, `github`, `linkedin` (optional)

**Status codes:**  
- `201` – Registration successful  
- `400` – Validation error or email/phone already exists  
- `500` – Server error  

---

### POST `/api/auth/login`

**Body:** `email`, `password`

**Status codes:**  
- `200` – `{ message, token, user: { fullName, email, _id } }`  
- `404` – User not found  
- `401` – Wrong password  
- `500` – Server error  

---

### POST `/api/auth/send-otp`

**Body:** `email`

**Status codes:**  
- `200` – `{ message: "OTP sent to email" }`  
- `500` – Failed to send OTP  

---

### POST `/api/auth/verify-otp`

**Body:** `email`, `otp`

**Status codes:**  
- `200` – `{ message, token, user: { _id, fullName, email } }`  
- `400` – Invalid or expired OTP  
- `500` – Verification failed  

---

### GET `/api/auth/google` / `/api/auth/google/callback`

Redirects to Google; callback redirects to frontend with `?token=...`.  
**Status codes:** `302` redirects  

---

## 3. Projects (`/api/projects`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/projects/create` | Yes | Create project (multipart) |
| GET | `/api/projects/all` | Optional | List all projects |
| GET | `/api/projects/my-projects/:id` | Yes | My projects (owner or member) |
| GET | `/api/projects/:id` | Optional | Get project by ID |
| POST | `/api/projects/:projectId/like` | Yes | Like/unlike project (toggle) |
| DELETE | `/api/projects/:userId/:projectId` | Yes | Delete project (owner only) |

### POST `/api/projects/create`

**Auth:** Required  

**Body (multipart/form-data):**  
- `title`, `description`, `domain`, `techStack`, `collaborationType`  
- Files: `frontend`, `backend`, `envFile`, `dbFile` (each 1 .zip), `screenshots` (up to 10 images)  

**Status codes:**  
- `201` – `{ success, message, project }`  
- `401` – Unauthorized  
- `500` – Server error  

---

### GET `/api/projects/all`

**Auth:** Optional (sending token adds `likedByMe` per project)  

**Status codes:**  
- `200` – `{ success: true, projects: [...] }` each with `likesCount`, `likedByMe`  
- `500` – Server error  

---

### GET `/api/projects/my-projects/:id`

**Auth:** Required  

**Params:** `id` – user ID (often same as token user)  

**Status codes:**  
- `200` – `{ success: true, projects: [...] }` with `likesCount`, `likedByMe`  
- `500` – Server error  

---

### GET `/api/projects/:id`

**Auth:** Optional  

**Params:** `id` – project ID  

**Status codes:**  
- `200` – Project object with `likesCount`, `likedByMe`  
- `404` – Project not found  
- `500` – Server error  

---

### POST `/api/projects/:projectId/like`

**Auth:** Required  

**Params:** `projectId` – project ID  

**Status codes:**  
- `200` – `{ success: true, likesCount, likedByMe }`  
- `401` – Unauthorized  
- `404` – Project not found  
- `500` – Server error  

---

### DELETE `/api/projects/:userId/:projectId`

**Auth:** Required  

**Params:** `userId`, `projectId`  

**Status codes:**  
- `200` – Deleted successfully  
- `404` – Project not found  
- `403` – Not owner  
- `500` – Server error  

---

## 4. Team (`/api/team`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/team/team` | Yes | Create team |
| GET | `/api/team/public` | Yes | List public teams with open slots |
| GET | `/api/team/:teamId` | Yes | Get team details |
| GET | `/api/team/user/:id` | Yes | Teams for user |
| POST | `/api/team/:teamId/invite` | Yes | Invite user to team |
| GET | `/api/team/:userId/invitations` | Yes | My invitations (pending + history) |
| POST | `/api/team/invite/accept/:token` | Yes | Accept invite by token |
| POST | `/api/team/invite/:inviteId/respond` | Yes | Accept/reject invite by ID |
| POST | `/api/team/:teamId/request-join` | Yes | Request to join team |
| GET | `/api/team/owner/requests` | Yes | Join requests for my teams |
| POST | `/api/team/request/:requestId/respond` | Yes | Approve/reject join request |
| POST | `/api/team/:teamId/join` | Yes | Join public team |

### POST `/api/team/team`

**Body:** `title`, `description`, `visibility`, `members` (array: `userId`, `role`, `languages`; first member is owner)

**Status codes:**  
- `201` – `{ message, team }`  
- `400` – Missing required fields  
- `404` – User not found for invited member  
- `500` – Server error  

---

### GET `/api/team/public`

**Status codes:**  
- `200` – Array of public teams with open slots  
- `401` – Unauthorized  
- `500` – Server error  

---

### GET `/api/team/:teamId`

**Params:** `teamId`  

**Status codes:**  
- `200` – Team with owner and members populated  
- `404` – Team not found  
- `500` – Server error  

---

### GET `/api/team/user/:id`

**Params:** `id` – user ID  

**Status codes:**  
- `200` – Array of teams  
- `500` – Server error  

---

### POST `/api/team/:teamId/invite`

**Params:** `teamId`  

**Body:** `userId`, `role`, `languages`, `sender` (optional)  

**Status codes:**  
- `200` – `{ inviteToken }`  
- `404` – Team not found  
- `403` – Not team owner  
- `400` – Owner self-invite or duplicate pending invite  
- `500` – Server error  

---

### GET `/api/team/:userId/invitations`

**Params:** `userId`  

**Status codes:**  
- `200` – `{ pending: [...], history: [...] }`  
- `500` – Server error  

---

### POST `/api/team/invite/accept/:token`

**Params:** `token` – invite token  

**Status codes:**  
- `200` – `{ success: true, team }`  
- `404` – Invalid/expired token or team not found  
- `500` – Server error  

---

### POST `/api/team/invite/:inviteId/respond`

**Params:** `inviteId`  

**Body:** `accepted` (boolean)  

**Status codes:**  
- `200` – `{ status: 'accepted' | 'rejected' }`  
- `404` – Invite not found  
- `403` – Unauthorized (not invitee)  
- `500` – Server error  

---

### POST `/api/team/:teamId/request-join`

**Params:** `teamId`  

**Body:** `role`  

**Status codes:**  
- `201` – Join request sent  
- `404` – Team not found  
- `400` – Already member or no slot for role  
- `500` – Server error  

---

### GET `/api/team/owner/requests`

**Status codes:**  
- `200` – Array of join requests (user + team populated)  
- `500` – Server error  

---

### POST `/api/team/request/:requestId/respond`

**Params:** `requestId`  

**Body:** `accepted` (boolean)  

**Status codes:**  
- `200` – `{ status: 'accepted' | 'rejected' }`  
- `404` – Request not found  
- `403` – Not team owner  
- `500` – Server error  

---

### POST `/api/team/:teamId/join`

**Params:** `teamId`  

**Body:** `role`  

**Status codes:**  
- `200` – `{ success: true, team }`  
- `404` – Team not found  
- `403` – Team is private  
- `400` – Already member or no slot for role  
- `500` – Server error  

---

## 5. Task (`/api/task`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/task/:projectId` | Yes | Tasks for project |
| POST | `/api/task` | Yes | Create task |
| PUT | `/api/task/:taskId` | Yes | Update task |
| DELETE | `/api/task/:taskId` | Yes | Delete task |

### GET `/api/task/:projectId`

**Params:** `projectId`  

**Status codes:**  
- `200` – Array of tasks  
- `500` – Server error  

---

### POST `/api/task`

**Body:** `title`, `description`, `priority`, `status`, `due`, `xp`, `assignee`, `projectId`  

**Status codes:**  
- `201` – Created task object  
- `500` – Server error  

---

### PUT `/api/task/:taskId`

**Params:** `taskId`  

**Body:** Any task fields (e.g. `status`, `title`, …)  

**Status codes:**  
- `200` – Updated task  
- `404` – Task not found  
- `500` – Server error  

---

### DELETE `/api/task/:taskId`

**Params:** `taskId`  

**Status codes:**  
- `200` – `{ message: "Task deleted" }`  
- `404` – Task not found  
- `500` – Server error  

---

## 6. Chat (`/api/chat`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/chat/rooms` | Yes | Create room |
| GET | `/api/chat/available-rooms` | Yes | List rooms with members |
| POST | `/api/chat/rooms/:slug/join` | Yes | Join room |
| GET | `/api/chat/rooms/:slug/history` | Yes | Message history |

### POST `/api/chat/rooms`

**Body:** `name`, `description`, `slug`  

**Status codes:**  
- `200` – `{ room }`  
- `409` – Room with slug already exists  
- `500` – Server error  

---

### GET `/api/chat/available-rooms`

**Status codes:**  
- `200` – `{ success: true, rooms: [...] }`  
- `500` – Server error  

---

### POST `/api/chat/rooms/:slug/join`

**Params:** `slug` – room slug or `team-<teamId>` or plain team ID (24-char hex)  

**Status codes:**  
- `200` – `{ success: true, message }`  
- `404` – Room not found  
- `400` – Already a member  
- `403` – Not a member of this team  
- `500` – Server error  

---

### GET `/api/chat/rooms/:slug/history`

**Params:** `slug` – room slug or team id  

**Query:** `before` (ISO date, cursor), `limit` (default 20)  

**Status codes:**  
- `200` – `{ messages: [...], nextCursor }`  
- `404` – Room not found  
- `403` – Not a member of this room  
- `500` – Server error  

---

## 7. Comments (`/api/comments`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/comments/project/:projectId` | No | Comments for project |
| POST | `/api/comments` | Yes | Create comment |
| DELETE | `/api/comments/:commentId` | Yes | Delete comment (author only) |

### GET `/api/comments/project/:projectId`

**Params:** `projectId`  

**Status codes:**  
- `200` – Array of comments (author populated)  
- `500` – Server error  

---

### POST `/api/comments`

**Body:** `text`, `projectId` (required); `parentComment` (optional, for replies)  

**Status codes:**  
- `201` – Created comment (author populated)  
- `400` – Text and projectId required  
- `500` – Server error  

---

### DELETE `/api/comments/:commentId`

**Params:** `commentId`  

**Status codes:**  
- `200` – `{ message: "Comment deleted successfully" }`  
- `404` – Comment not found  
- `403` – Not author  
- `500` – Server error  

---

## 8. Jira (`/api/jira`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/jira/oauth/initiate` | Yes | Get Jira OAuth URL |
| GET | `/api/jira/oauth/callback` | No | OAuth callback (redirect) |
| POST | `/api/jira/disconnect` | Yes | Disconnect Jira |
| GET | `/api/jira/connection` | Yes | Connection status |
| GET | `/api/jira/debug` | Yes | Debug OAuth + cloudId |
| GET | `/api/jira/projects` | Yes | Jira projects list |
| GET | `/api/jira/issues/:projectKey` | Yes | Jira issues (grouped) |
| GET | `/api/jira/tasks/:projectKey` | Yes | Jira tasks (simple list) |

### GET `/api/jira/oauth/initiate`

**Status codes:**  
- `200` – `{ authUrl }`  
- `500` – Server error  

---

### GET `/api/jira/oauth/callback`

**Query:** `code`, `state` (from Atlassian redirect)  

**Status codes:**  
- `302` – Redirect to frontend success/error URL  
- No JSON response  

---

### POST `/api/jira/disconnect`

**Status codes:**  
- `200` – `{ message: "JIRA disconnected successfully" }`  
- `500` – Server error  

---

### GET `/api/jira/connection`

**Status codes:**  
- `200` – `{ connected: true | false }`  
- `500` – Server error  

---

### GET `/api/jira/debug`

**Status codes:**  
- `200` – `{ connected, storedCloudId, jiraResources: [...] }`  
- `500` – Server error  

---

### GET `/api/jira/projects`

**Status codes:**  
- `200` – `{ success: true, projects: [...] }`  
- `401` – Not connected or token invalid  
- `410` / `500` – Upstream Jira error  

---

### GET `/api/jira/issues/:projectKey`

**Params:** `projectKey` – Jira project key (e.g. KAN)  

**Status codes:**  
- `200` – Issues object (grouped)  
- `401` – Not connected  
- `410` / `500` – Upstream error  

---

### GET `/api/jira/tasks/:projectKey`

**Params:** `projectKey` – Jira project key  

**Status codes:**  
- `200` – `{ success: true, tasks: [...] }`  
- `500` – Server error (e.g. not connected)  

---

## 9. Dashboard (`/api/dashboard`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dashboard/stats` | Yes | User stats (projects, tasks, XP, etc.) |
| GET | `/api/dashboard/activity` | Yes | Activity feed |

### GET `/api/dashboard/stats`

**Status codes:**  
- `200` – `{ projectCount, taskCount, solvedIssuesCount, xp, rating, fullName, profileImage, interviewsCount, profileViews }`  
- `500` – Server error  

---

### GET `/api/dashboard/activity`

**Status codes:**  
- `200` – Array of `{ id, type, text, time }` (project/task/comment)  
- `500` – Server error  

---

## 10. Mock Interview (`/api/mock-interview`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/mock-interview/problems` | Yes | List problems (LeetCode) |
| GET | `/api/mock-interview/problems/:titleSlug` | Yes | Get single problem |
| GET | `/api/mock-interview/daily` | Yes | Daily challenge |
| GET | `/api/mock-interview/set` | Yes | Build mock set by difficulty counts |
| GET | `/api/mock-interview/mcq/questions` | Yes | List visible MCQ questions (no answers) |
| POST | `/api/mock-interview/mcq/submit` | Yes | Submit MCQ attempt and get score |

### GET `/api/mock-interview/problems`

**Query:** `difficulty`, `categorySlug`, `limit` (default 50), `offset` (default 0)  

**Status codes:**  
- `200` – `{ success: true, problems: [...] }`  
- `500` – Server error  

---

### GET `/api/mock-interview/problems/:titleSlug`

**Params:** `titleSlug` – problem slug  

**Status codes:**  
- `200` – `{ success: true, problem }`  
- `400` – titleSlug required  
- `404` – Problem not found  
- `500` – Server error  

---

### GET `/api/mock-interview/daily`

**Status codes:**  
- `200` – `{ success: true, daily }`  
- `500` – Server error  

---

### GET `/api/mock-interview/set`

**Query:** `easy`, `medium`, `hard` (counts per difficulty; default 1, 2, 1)  

**Status codes:**  
- `200` – `{ success, problems: [...], errors: [] }`  
- `500` – Server error  

---

### GET `/api/mock-interview/mcq/questions`

**Auth:** Required  

**Query:** `limit` (default 10, max 50), `category` (string), `difficulty` (`EASY` \| `MEDIUM` \| `HARD`)  

**Response:** `{ data: [ { id, questionText, options: [ { id, text } ], difficulty, category, order } ] }` — only visible questions; options do not include correct answer.  

**Status codes:**  
- `200` – Success  
- `500` – Server error  

---

### POST `/api/mock-interview/mcq/submit`

**Auth:** Required  

**Body:** `{ attemptId?: string, answers: [ { questionId, selectedOptionId } ] }`  

**Response:** `{ data: { attemptId, totalQuestions, correctCount, scorePercent, passed, results: [ { questionId, selectedOptionId, correctOptionId, isCorrect } ] } }`  

**Status codes:**  
- `200` – Success  
- `400` – Missing or empty `answers`  
- `500` – Server error  

---

## Summary: Status codes used

| Code | Meaning |
|------|--------|
| 200 | OK |
| 201 | Created |
| 302 | Redirect (e.g. OAuth) |
| 400 | Bad request / validation / business rule |
| 401 | Unauthorized / invalid or missing token |
| 403 | Forbidden (no permission) |
| 404 | Not found |
| 409 | Conflict (e.g. duplicate) |
| 410 | Gone (e.g. Jira site) |
| 500 | Internal server error |

**Auth:**  
- **Yes** = `Authorization: Bearer <token>` required; otherwise `401`.  
- **Optional** = Token not required; if sent, used to add fields like `likedByMe`.  
- **No** = Public endpoint.
