import express from "express";
import { createComment, getCommentsByProject, deleteComment } from "../controllers/commentController.js";
import { auth } from "../middleware/AuthMiddleware.js";
import { validateObjectId } from "../middleware/validateObjectId.js";

const router = express.Router();

router.get("/project/:projectId", validateObjectId('projectId'), getCommentsByProject);
router.post("/", auth, createComment);
router.delete("/:commentId", auth, validateObjectId('commentId'), deleteComment);

export default router;
