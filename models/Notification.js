import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["friend_request", "friend_accepted", "message", "project_invite"],
      required: true,
    },
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ref: { type: mongoose.Schema.Types.Mixed },
    text: { type: String },
    readAt: { type: Date },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

export default mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
