import { getSimpleJiraTasks } from "../services/jiraSimpleService.js";

/**
 * Simple endpoint to fetch Jira tasks
 */
export const fetchSimpleTasks = async (req, res) => {
    const { projectKey } = req.params;
    try {
        const tasks = await getSimpleJiraTasks(req.user._id, projectKey);
        res.json({ success: true, tasks });
    } catch (error) {
        console.error('Fetch simple tasks error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch Jira tasks'
        });
    }
};
