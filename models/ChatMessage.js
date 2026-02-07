import mongoose from 'mongoose'

const ChatMessageSchema = new mongoose.Schema(
    {
        room: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: true, index: true },
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        type: { type: String, enum: ['text', 'code', 'file'], default: 'text' },
        message: { type: String, default: '' },
        meta: { type: mongoose.Schema.Types.Mixed },
        deletedAt: { type: Date }
    },
    { timestamps: true }
)

ChatMessageSchema.index({ room: 1, createdAt: -1 })

export default mongoose.model('ChatMessage', ChatMessageSchema)


