import mongoose from "mongoose";

const optionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  isCorrect: { type: Boolean, required: true, default: false },
}, { _id: false });

const mcqQuestionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: {
    type: [optionSchema],
    required: true,
    validate: {
      validator: (v) => Array.isArray(v) && v.length >= 2,
      message: "At least 2 options required",
    },
  },
  difficulty: {
    type: String,
    enum: ["EASY", "MEDIUM", "HARD"],
    default: "EASY",
  },
  category: { type: String, default: "general" },
  order: { type: Number, default: 0 },
  visible: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.models.McqQuestion || mongoose.model("McqQuestion", mcqQuestionSchema);
