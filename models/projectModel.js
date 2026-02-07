import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const projectSchema = new Schema({
    title: {
        type: String,
        required: [true, 'Project title is required']
    },
    description: {
        type: String,
        required: [true, 'Project description is required']
    },
    domain: {
        type: String,
        enum: ['Web Dev', 'Mobile', 'AI/ML', 'DevOps', 'Blockchain'],
        required: [true, 'Project domain is required']
    },
    techStack: [{
        type: String
    }],
    collaborationType: {
        type: String,
        enum: ['Open Source', 'Team Only', 'Mentored'],
        required: [true, 'Collaboration type is required']
    },
    owner: {
        type: Types.ObjectId,
        ref: 'User',
        required: [true, 'Project owner is required']
    },
    members: [{
        user: { type: Types.ObjectId, ref: 'User', required: false },
        role: {
            type: String,
            enum: ['Core Member', 'Maintainer', 'Reviewer', 'Contributor'],
            required: true
        },
        joinedAt: { type: Date, default: Date.now }
    }],
    // accessRequests: [{
    //     user: { type: Types.ObjectId, ref: 'User', required: true },
    //     message: String,
    //     status: {
    //         type: String,
    //         enum: ['Pending', 'Approved', 'Rejected'],
    //         default: 'Pending'
    //     },
    //     requestedAt: { type: Date, default: Date.now }
    // }]
    zipFiles: {
        frontend: String,
        backend: String,
        envFile: String || null,
        dbFile: String
    },
    screenshots: [String]
}, { timestamps: true });
// });

export default mongoose.models.Project || mongoose.model("Project", projectSchema); 