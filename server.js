import express from 'express'
import cors from "cors"
import morgan from 'morgan'
import colors from "colors"
import dotenv from "dotenv"
import AuthRoute from './routes/AuthRoute.js'
import ProjectRoutes from './routes/ProjectRoutes.js'
import TeamRoutes from './routes/TeamRoutes.js'
import TaskRoutes from './routes/TaskRoutes.js'
import ChatRoutes from './routes/ChatRoutes.js'
import commentRoutes from './routes/commentRoutes.js'
import JiraRoutes from './routes/JiraRoutes.js'
import DashboardRoutes from './routes/DashboardRoutes.js'
import MockInterviewRoutes from './routes/MockInterviewRoutes.js'
import ChatMessage from './models/ChatMessage.js'
import ChatRoom from './models/ChatRoom.js'
import { createSocketAuthMiddleware } from './middleware/SocketAuth.js'
import Team from './models/Team.js'
import DBConnection from './config/db.js'
import passport from 'passport'
import { createServer } from "http"
import { Server } from "socket.io"

dotenv.config()
DBConnection()

const app = express()

// CORS setup
app.use(cors({
    origin: true, // reflect request origin in dev so LAN devices can connect
    credentials: true
}))
app.use(express.json())
app.use(morgan('dev'))

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

// ✅ Create HTTP server
const httpServer = createServer(app)

// ✅ Attach Socket.IO
const io = new Server(httpServer, {
    cors: {
        origin: true,
        methods: ["GET", "POST"],
        credentials: true
    }
})

// Secure sockets with JWT
createSocketAuthMiddleware(io)

let users = {}

io.on("connection", (socket) => {
    console.log("⚡ User connected:", socket.id, socket.user)

    // Join room by slug
    socket.on('chat:join', async ({ slug, name, description }) => {
        try {
            let room = await ChatRoom.findOne({ slug })
            if (!room) {
                room = await ChatRoom.create({ slug, name: name || slug, description })
            }
            // Enforce team membership if slug implies team room: team-{teamId} or plain 24-char team id
            const teamIdFromSlug = slug.startsWith('team-') ? slug.replace('team-', '') : (/^[a-fA-F0-9]{24}$/.test(String(slug)) ? slug : null)
            if (teamIdFromSlug) {
                const userId = socket.user?.id ?? socket.user?._id
                if (!userId) return socket.emit('chat:error', { message: 'Unauthorized' })
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
            console.log('[chat:join] slug=%s roomId=%s', slug, roomIdStr);
        } catch (e) {
            console.error('[chat:join] Error:', e.message);
            socket.emit('chat:error', { message: 'Failed to join room' });
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
                console.log('[chat:send] Unauthorized: no user');
                return socket.emit('chat:error', { message: 'Unauthorized' });
            }
            if (!roomId) {
                console.log('[chat:send] Missing roomId');
                return socket.emit('chat:error', { message: 'Missing room' });
            }
            // roomId may be ChatRoom._id (24-char hex) or slug (e.g. team-xxx); resolve to ObjectId for DB
            const isObjectId = /^[a-fA-F0-9]{24}$/.test(String(roomId));
            let roomDocId = roomId;
            if (!isObjectId) {
                const room = await ChatRoom.findOne({ slug: roomId });
                if (!room) {
                    console.log('[chat:send] Room not found for slug/id:', roomId);
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
            console.log('[chat:send] OK room=%s msg=%s', roomDocId, (message || '').slice(0, 50));
        } catch (e) {
            console.error('[chat:send] Error:', e.message, e.stack);
            socket.emit('chat:error', { message: e.message || 'Failed to send message' });
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
        console.log("❌ User disconnected:", socket.id)
    })
})

// ✅ Start server
const PORT = process.env.PORT || 8000
httpServer.listen(PORT, () =>
    console.log(`Server running on port ${PORT}`.white.bgMagenta)
)
