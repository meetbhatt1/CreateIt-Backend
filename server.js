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
            // Enforce team membership if slug implies team room: team-{teamId}
            if (slug.startsWith('team-')) {
                const teamId = slug.replace('team-', '')
                const userId = socket.user?.id
                if (!userId) return socket.emit('chat:error', { message: 'Unauthorized' })
                const team = await Team.findById(teamId).lean()
                const isMember = team && (
                    String(team.owner) === String(userId) ||
                    (team.members || []).some(m => String(m.user) === String(userId) && m.status === 'accepted')
                )
                if (!isMember) return socket.emit('chat:error', { message: 'Forbidden' })
            }
            socket.join(room._id.toString())
            socket.emit('chat:joined', { roomId: room._id, slug })
        } catch (e) {
            socket.emit('chat:error', { message: 'Failed to join room' })
        }
    })

    // Typing indicator
    socket.on('chat:typing', ({ roomId, isTyping }) => {
        socket.to(roomId).emit('chat:typing', { userId: socket.user?.id, isTyping })
    })

    // Send message -> persist -> broadcast
    socket.on('chat:send', async ({ roomId, type = 'text', message = '', meta = {}, }) => {
        try {
            if (!socket.user?.id) return socket.emit('chat:error', { message: 'Unauthorized' })
            const doc = await ChatMessage.create({
                room: roomId,
                sender: socket.user?.id,
                type,
                message,
                meta
            })

            const payload = {
                _id: doc._id,
                room: doc.room,
                sender: doc.sender,
                type: doc.type,
                message: doc.message,
                meta: doc.meta,
                createdAt: doc.createdAt
            }
            io.to(roomId).emit('chat:message', payload)
        } catch (e) {
            socket.emit('chat:error', { message: 'Failed to send message' })
        }
    })

    // Delete message (soft)
    socket.on('chat:delete', async ({ messageId, roomId }) => {
        try {
            await ChatMessage.findByIdAndUpdate(messageId, { deletedAt: new Date() })
            io.to(roomId).emit('chat:deleted', { messageId })
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
