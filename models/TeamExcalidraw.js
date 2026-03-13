import mongoose from 'mongoose';

const teamExcalidrawSchema = new mongoose.Schema({
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
    unique: true,
  },
  elements: {
    type: mongoose.Schema.Types.Mixed,
    default: [],
  },
  appState: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

teamExcalidrawSchema.index({ team: 1 });

const TeamExcalidraw = mongoose.model('TeamExcalidraw', teamExcalidrawSchema);
export default TeamExcalidraw;
