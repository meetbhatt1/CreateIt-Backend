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
        required: [true, 'Phone number is required'],
        unique: true
    },
    password: {
        type: String,
        required: [true, 'Password is required']
    },
    dob: {
        type: Date,
        required: [true, 'Date of birth is required']
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
    github: {
        type: String,
        required: [false]
    },
    linkedin: {
        type: String,
        required: [false]
    },

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
