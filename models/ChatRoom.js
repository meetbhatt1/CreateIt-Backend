import mongoose from 'mongoose'

const ChatRoomSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        description: { type: String },
        members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        slug: { type: String, unique: true, index: true }
    },
    { timestamps: true }
)

export default mongoose.model('ChatRoom', ChatRoomSchema)


