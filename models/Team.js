import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    visibility: {
        type: Boolean,
        required: true,
        default: true // true = public, false = private
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    members: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        role: {
            type: String,
            required: true
        },
        languages: [{
            type: String
        }],
        status: {
            type: String,
            enum: ['pending', 'accepted'],
            default: 'pending'
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Add index for better performance on queries
teamSchema.index({ title: 'text', description: 'text' });

const Team = mongoose.model('Team', teamSchema);
export default Team;