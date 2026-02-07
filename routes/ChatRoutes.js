import express from 'express'
import ChatRoom from '../models/ChatRoom.js'
import ChatMessage from '../models/ChatMessage.js'
import { auth } from '../middleware/AuthMiddleware.js'

const router = express.Router()

// Create a room (with authenticated user)
router.post('/rooms', auth, async (req, res) => {
    try {
        const { name, description, slug } = req.body
        const existing = await ChatRoom.findOne({ slug })
        if (existing) return res.status(409).json({ message: 'Room exists' })

        // Create room with current user as the first member
        const room = await ChatRoom.create({
            name,
            description,
            slug,
            members: [req.user._id] // Add creator as member
        })

        return res.json({ room })
    } catch (err) {
        return res.status(500).json({ message: 'Failed to create room' })
    }
})

// Get available rooms with member info
router.get('/available-rooms', auth, async (req, res) => {
    try {
        const rooms = await ChatRoom.find()
            .populate('members', 'name email avatar') // Populate member details
            .select('name description slug members createdAt')

        return res.json({ success: true, rooms })
    } catch (err) {
        return res.status(500).json({ message: 'Failed to fetch rooms' })
    }
})

// Join a room
router.post('/rooms/:slug/join', auth, async (req, res) => {
    try {
        const { slug } = req.params
        const room = await ChatRoom.findOne({ slug })

        if (!room) return res.status(404).json({ message: 'Room not found' })

        // Check if user is already a member
        if (room.members.includes(req.user._id)) {
            return res.status(400).json({ message: 'Already a member' })
        }

        // Add user to members
        room.members.push(req.user._id)
        await room.save()

        return res.json({ success: true, message: 'Joined room successfully' })
    } catch (err) {
        return res.status(500).json({ message: 'Failed to join room' })
    }
})

// Get message history by room slug
router.get('/rooms/:slug/history', auth, async (req, res) => {
    try {
        const { slug } = req.params
        const { before, limit = 20 } = req.query
        const room = await ChatRoom.findOne({ slug })

        if (!room) return res.status(404).json({ message: 'Room not found' })

        // Check if user is a member of the room
        if (!room.members.includes(req.user._id)) {
            return res.status(403).json({ message: 'Not a member of this room' })
        }

        const query = { room: room._id }
        if (before) query.createdAt = { $lt: new Date(before) }

        const items = await ChatMessage.find(query)
            .populate('sender', 'name avatar') // Populate sender info
            .sort({ createdAt: -1 })
            .limit(parseInt(limit, 10))

        const nextCursor = items.length > 0 ? items[items.length - 1].createdAt : null

        return res.json({ messages: items.reverse(), nextCursor })
    } catch (err) {
        return res.status(500).json({ message: 'Failed to load history' })
    }
})

export default router