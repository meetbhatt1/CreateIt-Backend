import express from "express";
import {
    createTask,
    getTasksByProject,
    updateTask,
    deleteTask,
} from "../controllers/TaskController.js";
import { auth } from "../middleware/AuthMiddleware.js";

const router = express.Router();

router.get("/:projectId", auth, getTasksByProject);
router.post("/", auth, createTask);
router.put("/:taskId", auth, updateTask);
router.delete("/:taskId", auth, deleteTask);

export default router;
