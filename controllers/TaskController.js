import Task from "../models/TaskModel.js";

export const getTasksByProject = async (req, res) => {
    try {
        const tasks = await Task.find({ projectId: req?.params?.projectId });
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch tasks" });
    }
};

export const createTask = async (req, res) => {
    try {
        const { title, description, priority, status, due, xp, assignee, projectId } = req?.body;

        const task = new Task({
            title,
            description,
            priority,
            status,
            due,
            xp,
            assignee,
            projectId,
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
        const updated = await Task.findByIdAndUpdate(req.params.taskId, req.body, {
            new: true,
        });
        if (!updated) return res.status(404).json({ message: "Task not found" });
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
