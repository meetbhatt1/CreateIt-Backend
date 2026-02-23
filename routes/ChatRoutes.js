import express from 'express'
import ChatRoom from '../models/ChatRoom.js'
import ChatMessage from '../models/ChatMessage.js'
import Team from '../models/Team.js'
import { auth } from '../middleware/AuthMiddleware.js'

const router = express.Router()

/** For slug team-{teamId} or plain teamId (24-char hex), return true if user is team owner or in members (accepted or pending). */
async function isTeamRoomMember(slugOrTeamId, userId) {
    if (!slugOrTeamId || userId == null) return false
    const teamId = String(slugOrTeamId).startsWith('team-')
        ? slugOrTeamId.replace('team-', '')
        : slugOrTeamId
    if (!/^[a-fA-F0-9]{24}$/.test(teamId)) return false
    const team = await Team.findById(teamId).lean()
    if (!team) return false
    const uid = userId != null ? (userId.toString?.() ?? String(userId)) : ''
    if (!uid) return false
    if (String(team.owner) === uid) return true
    return (team.members || []).some(m => {
        const mu = m?.user != null ? String(m.user) : ''
        return mu === uid && (m?.status === 'accepted' || m?.status === 'pending')
    })
}

/** Resolve room by slug. For team rooms, slug may be "team-<id>" or just "<id>" (24-char hex). */
async function findRoomBySlug(slug) {
    if (!slug) return null
    let room = await ChatRoom.findOne({ slug })
    if (room) return room
    const tid = String(slug).startsWith('team-') ? slug.replace('team-', '') : slug
    if (/^[a-fA-F0-9]{24}$/.test(tid)) room = await ChatRoom.findOne({ slug: `team-${tid}` })
    return room ?? null
}

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
            .populate('members', 'fullName email profileImage')
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
        const room = await findRoomBySlug(slug)

        if (!room) return res.status(404).json({ message: 'Room not found' })

        const userId = req.user._id ?? req.user.id
        const userIdStr = userId?.toString?.() ?? String(userId)
        const inRoomMembers = room.members.some(m => (m?.toString?.() ?? m) === userIdStr)
        if (inRoomMembers) {
            return res.status(400).json({ message: 'Already a member' })
        }

        const isTeamRoom = slug.startsWith('team-') || (room.slug && room.slug.startsWith('team-')) || /^[a-fA-F0-9]{24}$/.test(String(slug))
        if (isTeamRoom) {
            const allowed = await isTeamRoomMember(slug, userId) || (room.slug && room.slug !== slug && (await isTeamRoomMember(room.slug, userId)))
            if (!allowed) return res.status(403).json({ message: 'Not a member of this team' })
        }

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
        const room = await findRoomBySlug(slug)

        if (!room) return res.status(404).json({ message: 'Room not found' })

        const userId = req.user._id ?? req.user.id
        const userIdStr = userId?.toString?.() ?? String(userId)
        let isMember = room.members.some(m => (m?.toString?.() ?? m) === userIdStr)
        if (!isMember) {
            isMember = await isTeamRoomMember(slug, userId)
            if (!isMember && room.slug && room.slug !== slug) {
                isMember = await isTeamRoomMember(room.slug, userId)
            }
        }
        if (!isMember) {
            return res.status(403).json({ message: 'Not a member of this room' })
        }

        const query = { room: room._id }
        if (before) query.createdAt = { $lt: new Date(before) }

        const items = await ChatMessage.find(query)
            .populate('sender', 'fullName profileImage')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit, 10))

        const nextCursor = items.length > 0 ? items[items.length - 1].createdAt : null

        return res.json({ messages: items.reverse(), nextCursor })
    } catch (err) {
        return res.status(500).json({ message: 'Failed to load history' })
    }
})

export default router