// middleware/SocketAuth.js
import jwt from "jsonwebtoken"

const isProduction = process.env.NODE_ENV === 'production'

export function createSocketAuthMiddleware(io) {
    io.use((socket, next) => {
        try {
            const raw =
                socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization

            const token = raw?.startsWith("Bearer ") ? raw.slice(7) : raw

            if (!token || token === "guest") {
                return next(new Error("Unauthorized: No token provided"))
            }

            const secret = process.env.JWT_SECRET
            if (!secret) return next(new Error("Unauthorized: Server misconfiguration"))

            const decoded = jwt.verify(token, secret)

            socket.user = {
                ...decoded,
                id: decoded.id || decoded._id,
            }

            return next()
        } catch (err) {
            if (!isProduction) console.error("Socket auth failed:", err.message)
            return next(new Error("Unauthorized: Invalid token"))
        }
    })
}
