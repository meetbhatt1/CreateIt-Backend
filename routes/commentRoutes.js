import express from "express";
import { createComment, getCommentsByProject, deleteComment } from "../controllers/commentController.js";
import { auth } from "../middleware/AuthMiddleware.js";

const router = express.Router();

// Publicly accessible to view comments
router.get("/project/:projectId", getCommentsByProject);

// Protected routes for adding and deleting
router.post("/", auth, createComment);
router.delete("/:commentId", auth, deleteComment);

export default router;
