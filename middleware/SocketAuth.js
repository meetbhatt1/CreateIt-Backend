// middleware/SocketAuth.js
import jwt from "jsonwebtoken"

export function createSocketAuthMiddleware(io) {
    io.use((socket, next) => {
        try {
            // Check for token from handshake
            const raw =
                socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization

            // Strip Bearer prefix if present
            const token = raw?.startsWith("Bearer ") ? raw.slice(7) : raw

            if (!token || token === "guest") {
                return next(new Error("Unauthorized: No token provided"))
            }

            const secret = process.env.JWT_SECRET
            const decoded = jwt.verify(token, secret)

            // ✅ Normalize user object
            socket.user = {
                ...decoded,
                id: decoded.id || decoded._id,
            }

            return next()
        } catch (err) {
            console.error("❌ Socket auth failed:", err.message)
            return next(new Error("Unauthorized: Invalid token"))
        }
    })
}
