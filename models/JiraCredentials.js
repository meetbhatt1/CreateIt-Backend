import mongoose from "mongoose";

const jiraCredentialsSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    accessToken: {
        type: String,
        required: true
    },
    refreshToken: {
        type: String,
        required: true
    },
    cloudId: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    connectedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

const JiraCredentials = mongoose.model("JiraCredentials", jiraCredentialsSchema);
export default JiraCredentials;
