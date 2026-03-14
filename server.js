import express from 'express'
import cors from "cors"
import morgan from 'morgan'
import colors from "colors"
import dotenv from "dotenv"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import AuthRoute from './routes/AuthRoute.js'
import ProjectRoutes from './routes/ProjectRoutes.js'
import TeamRoutes from './routes/TeamRoutes.js'
import TaskRoutes from './routes/TaskRoutes.js'
import ChatRoutes from './routes/ChatRoutes.js'
import commentRoutes from './routes/commentRoutes.js'
import JiraRoutes from './routes/JiraRoutes.js'
import DashboardRoutes from './routes/DashboardRoutes.js'
import MockInterviewRoutes from './routes/MockInterviewRoutes.js'
import AdminRoutes from './routes/AdminRoutes.js'
import FriendsRoutes from './routes/FriendsRoutes.js'
import NotificationsRoutes from './routes/NotificationsRoutes.js'
import ChatMessage from './models/ChatMessage.js'
import ChatRoom from './models/ChatRoom.js'
import Notification from './models/Notification.js'
import { createSocketAuthMiddleware } from './middleware/SocketAuth.js'
import Team from './models/Team.js'
import DBConnection from './config/db.js'
import { validateEnv, getCorsOrigin, isProduction } from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'
import passport from 'passport'
import mongoose from 'mongoose'
import { createServer } from "http"
import { Server } from "socket.io"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config()
validateEnv()

const isProd = process.env.NODE_ENV === 'production'
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', isProd ? 'see logs' : reason)
})
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', isProd ? err.message : err)
  process.exit(1)
})

DBConnection()

const app = express()

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(morgan(isProduction ? 'combined' : 'dev'))
app.use(express.json({ limit: '512kb' }))

const corsOrigin = getCorsOrigin()
app.use(cors({
  origin: Array.isArray(corsOrigin) && corsOrigin.length ? corsOrigin : corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 200 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests' },
})
app.use(limiter)

// Serve uploaded files (screenshots, zips, readme)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

// Routes
app.use(passport.initialize())
app.get("/api", (req, res) => {
    res.json({ message: "API is working ✅" })
})
app.use('/api/auth', AuthRoute)
app.use('/api/projects', ProjectRoutes)
app.use('/api/team', TeamRoutes)
app.use('/api/task', TaskRoutes)
app.use('/api/chat', ChatRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/jira', JiraRoutes)
app.use('/api/dashboard', DashboardRoutes)
app.use('/api/mock-interview', MockInterviewRoutes)
app.use('/api/admin', AdminRoutes)
app.use('/api/friends', FriendsRoutes)
app.use('/api/notifications', NotificationsRoutes)

app.get("/api/health", async (req, res) => {
  const dbState = mongoose.connection.readyState
  const ok = dbState === 1
  res.status(ok ? 200 : 503).json({
    ok,
    message: ok ? 'OK' : 'Service unavailable',
    db: dbState === 1 ? 'connected' : 'disconnected',
  })
})

app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'Not found' })
})
app.use(errorHandler)

// ✅ Create HTTP server
const httpServer = createServer(app)

// ✅ Attach Socket.IO
const io = new Server(httpServer, {
    cors: {
        origin: Array.isArray(corsOrigin) && corsOrigin.length ? corsOrigin : true,
        methods: ["GET", "POST"],
        credentials: true
    }
})

// Secure sockets with JWT
createSocketAuthMiddleware(io)

const devLog = (...args) => { if (!isProduction) console.log(...args) }
const devError = (...args) => { if (!isProduction) console.error(...args) }

io.on("connection", (socket) => {
    devLog("⚡ User connected:", socket.id)

    // Join room by slug
    socket.on('chat:join', async ({ slug, name, description }) => {
        try {
            let room = await ChatRoom.findOne({ slug })
            if (!room) {
                room = await ChatRoom.create({ slug, name: name || slug, description })
            }
            const userId = socket.user?.id ?? socket.user?._id
            if (!userId) return socket.emit('chat:error', { message: 'Unauthorized' })
            // DM room: only allow if user is in room.members
            if (slug && String(slug).startsWith('dm-')) {
                const inMembers = (room.members || []).some(m => String(m) === String(userId))
                if (!inMembers) return socket.emit('chat:error', { message: 'Not a participant' })
            }
            // Enforce team membership if slug implies team room: team-{teamId} or plain 24-char team id
            const teamIdFromSlug = slug.startsWith('team-') ? slug.replace('team-', '') : (/^[a-fA-F0-9]{24}$/.test(String(slug)) ? slug : null)
            if (teamIdFromSlug) {
                const team = await Team.findById(teamIdFromSlug).lean()
                const isMember = team && (
                    String(team.owner) === String(userId) ||
                    (team.members || []).some(m => String(m.user) === String(userId) && (m.status === 'accepted' || m.status === 'pending'))
                )
                if (!isMember) return socket.emit('chat:error', { message: 'Forbidden' })
            }
            const roomIdStr = room._id.toString();
            socket.join(roomIdStr);
            socket.emit('chat:joined', { roomId: roomIdStr, slug });
            devLog('[chat:join] slug=%s roomId=%s', slug, roomIdStr);
        } catch (e) {
            if (isProduction) socket.emit('chat:error', { message: 'Failed to join room' });
            else { console.error('[chat:join] Error:', e.message); socket.emit('chat:error', { message: e.message || 'Failed to join room' }); }
        }
    })

    // Typing indicator
    socket.on('chat:typing', ({ roomId, isTyping }) => {
        if (roomId) socket.to(String(roomId)).emit('chat:typing', { userId: socket.user?.id ?? socket.user?._id, isTyping });
    })

    // Send message -> persist -> broadcast
    socket.on('chat:send', async ({ roomId, type = 'text', message = '', meta = {}, }) => {
        try {
            const uid = socket.user?.id ?? socket.user?._id;
            if (!uid) {
                return socket.emit('chat:error', { message: 'Unauthorized' });
            }
            if (!roomId) {
                return socket.emit('chat:error', { message: 'Missing room' });
            }
            // roomId may be ChatRoom._id (24-char hex) or slug (e.g. team-xxx); resolve to ObjectId for DB
            const isObjectId = /^[a-fA-F0-9]{24}$/.test(String(roomId));
            let roomDocId = roomId;
            if (!isObjectId) {
                const room = await ChatRoom.findOne({ slug: roomId });
                if (!room) {
                    return socket.emit('chat:error', { message: 'Room not found' });
                }
                roomDocId = room._id.toString();
            }
            const doc = await ChatMessage.create({
                room: roomDocId,
                sender: uid,
                type,
                message,
                meta
            });

            const payload = {
                _id: doc._id,
                room: doc.room,
                sender: doc.sender,
                type: doc.type,
                message: doc.message,
                meta: doc.meta,
                createdAt: doc.createdAt
            };
            io.to(String(roomDocId)).emit('chat:message', payload);
            devLog('[chat:send] OK room=%s', roomDocId);
            // If DM room, notify the other user
            const roomDoc = await ChatRoom.findById(roomDocId);
            if (roomDoc && roomDoc.slug && String(roomDoc.slug).startsWith('dm-')) {
                const other = (roomDoc.members || []).find(m => String(m) !== String(uid));
                if (other) {
                    await Notification.create({
                        user: other,
                        type: 'message',
                        fromUser: uid,
                        ref: doc._id,
                        text: message ? message.slice(0, 80) : 'Sent a message',
                    });
                }
            }
        } catch (e) {
            if (!isProduction) console.error('[chat:send] Error:', e.message);
            socket.emit('chat:error', { message: isProduction ? 'Failed to send message' : (e.message || 'Failed to send message') });
        }
    })

    // Delete message (soft)
    socket.on('chat:delete', async ({ messageId, roomId }) => {
        try {
            await ChatMessage.findByIdAndUpdate(messageId, { deletedAt: new Date() });
            io.to(String(roomId)).emit('chat:deleted', { messageId });
        } catch (e) {
            socket.emit('chat:error', { message: 'Failed to delete' })
        }
    })

    socket.on("disconnect", () => {
        devLog("❌ User disconnected:", socket.id)
    })
})

const PORT = process.env.PORT || 8000
const server = httpServer.listen(PORT, () => {
    if (!isProduction) console.log(`Server running on port ${PORT}`.white.bgMagenta)
})

function gracefulShutdown(signal) {
    server.close(() => {
        mongoose.connection.close(false).then(() => {
            process.exit(0)
        }).catch(() => process.exit(1))
    })
    setTimeout(() => process.exit(1), 10000)
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
