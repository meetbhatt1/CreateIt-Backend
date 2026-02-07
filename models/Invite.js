import mongoose from 'mongoose';

const inviteSchema = new mongoose.Schema({
    team: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    role: {
        type: String,
        required: true
    },
    languages: [{
        type: String
    }],
    token: {
        type: String,
        required: true,
        unique: true
    },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'expired'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 604800 // 7 days in seconds
    }
});

const Invite = mongoose.model('Invite', inviteSchema);
export default Invite;