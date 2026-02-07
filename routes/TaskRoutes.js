import express from "express";
import {
    createTask,
    getTasksByProject,
    updateTask,
    deleteTask,
} from "../controllers/TaskController.js";

const router = express.Router();

router.get("/:projectId", getTasksByProject);
router.post("/", createTask);
router.put("/:taskId", updateTask);
router.delete("/:taskId", deleteTask);

export default router;
