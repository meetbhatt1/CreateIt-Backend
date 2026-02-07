import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: "",
        },
        priority: {
            type: String,
            enum: ["low", "medium", "high"],
            default: "low",
        },
        status: {
            type: String,
            enum: ["todo", "inProgress", "review", "done"],
            default: "todo",
        },
        due: {
            type: Date,
        },
        xp: {
            type: Number,
            default: 0,
        },
        assignee: {
            type: String, // you can also reference a User ObjectId
            required: true,
        },
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

export default mongoose.models.Task || mongoose.model("Task", taskSchema); 
