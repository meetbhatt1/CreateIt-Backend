import express from "express";
import {
    createTask,
    getTasksByProject,
    getTasksByTeam,
    updateTask,
    deleteTask,
} from "../controllers/TaskController.js";
import { auth } from "../middleware/AuthMiddleware.js";
import { validateObjectId } from "../middleware/validateObjectId.js";

const router = express.Router();

router.get("/team/:teamId", auth, validateObjectId('teamId'), getTasksByTeam);
router.get("/:projectId", auth, validateObjectId('projectId'), getTasksByProject);
router.post("/", auth, createTask);
router.put("/:taskId", auth, validateObjectId('taskId'), updateTask);
router.delete("/:taskId", auth, validateObjectId('taskId'), deleteTask);

export default router;
