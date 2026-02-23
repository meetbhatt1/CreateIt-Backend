import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    // Personal Details
    fullName: {
        type: String,
        required: [true, 'User name is required']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true
    },
    phone: {
        type: String,
        required: false,
        unique: true,
        sparse: true
    },
    password: {
        type: String,
        required: false // optional for Google OAuth users
    },
    dob: {
        type: Date,
        required: false
    },
    profileImage: {
        type: String,
        default: "😎"
    },
    // Educational Details
    collegeName: String,
    degreeName: String,
    currentSemester: Number,

    // Profiling Details
    preferredLanguage: [String],
    pastProjects: [String],
    purpose: {
        type: String,
        enum: ['contributor', 'mock-interview', 'opensource-consumer', 'other']
    },
    github: { type: String },
    linkedin: { type: String },

    xp: {
        type: Number,
        default: 0
    },
    rating: {
        type: Number,
        default: 0
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    otp: String,
    otpExpiry: Date,
    // For Google OAuth users
    googleId: String,
    isGoogleAuth: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model("User", userSchema);
