import Task from "../models/TaskModel.js";
import { addXP } from "../services/GamificationService.js";

export const getTasksByProject = async (req, res) => {
    try {
        const tasks = await Task.find({ projectId: req?.params?.projectId });
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch tasks" });
    }
};

/** GET /api/task/team/:teamId - Get all tasks for a team (Kanban board). Returns flat array. */
export const getTasksByTeam = async (req, res) => {
    try {
        const tasks = await Task.find({ teamId: req.params.teamId }).sort({ createdAt: 1 });
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch team tasks" });
    }
};

export const createTask = async (req, res) => {
    try {
        const { title, description, priority, status, due, assignee, projectId, teamId } = req?.body;
        if (!projectId && !teamId) {
            return res.status(400).json({ message: "Either projectId or teamId is required" });
        }

        const initialStatus = status || "todo";
        const task = new Task({
            title: title || "New task",
            description: description ?? "",
            priority: priority || "medium",
            status: initialStatus,
            due: due || undefined,
            xp: 0,
            assignee: assignee || "Unassigned",
            projectId: projectId || undefined,
            teamId: teamId || undefined,
            statusHistory: [{ status: initialStatus, at: new Date() }],
            createdBy: req?.user?._id,
        });

        const savedTask = await task.save();
        res.status(201).json(savedTask);
    } catch (err) {
        res.status(500).json({ message: "Failed to create task" });
    }
};

export const updateTask = async (req, res) => {
    try {
        const { status } = req.body;
        const task = await Task.findById(req.params.taskId);

        if (!task) return res.status(404).json({ message: "Task not found" });

        const oldStatus = task.status;
        const updatePayload = { ...req.body };
        if (status && status !== oldStatus) {
            const history = (task.statusHistory || []).concat({ status, at: new Date() });
            updatePayload.statusHistory = history;
        }
        const updated = await Task.findByIdAndUpdate(req.params.taskId, updatePayload, {
            new: true,
        });

        // Award XP only for project tasks (not team Kanban) when moved to done
        if (task.projectId && status === 'done' && oldStatus !== 'done') {
            await addXP(req.user._id, 'COMPLETE_TASK');
        }

        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: "Failed to update task" });
    }
};

export const deleteTask = async (req, res) => {
    try {
        const deleted = await Task.findByIdAndDelete(req.params.taskId);
        if (!deleted) return res.status(404).json({ message: "Task not found" });
        res.json({ message: "Task deleted" });
    } catch (err) {
        res.status(500).json({ message: "Failed to delete task" });
    }
};
