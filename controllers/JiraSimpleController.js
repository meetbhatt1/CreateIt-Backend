import { getSimpleJiraTasks } from "../services/jiraSimpleService.js";

/**
 * Simple endpoint to fetch Jira tasks (flat list). For Kanban with full task shape use GET /jira/issues/:projectKey.
 */
export const fetchSimpleTasks = async (req, res) => {
    const { projectKey } = req.params;
    try {
        const tasks = await getSimpleJiraTasks(req.user._id, projectKey);
        res.json({ success: true, tasks });
    } catch (error) {
        const msg = error.message || 'Failed to fetch Jira tasks';
        if (msg.includes('not connected') || msg.includes('connect your JIRA')) {
            return res.status(401).json({ success: false, message: msg });
        }
        if (error?.response?.status === 404 || error?.response?.status === 410) {
            return res.status(error.response.status).json({ success: false, message: msg });
        }
        if (error?.response?.status === 403) {
            return res.status(403).json({ success: false, message: msg });
        }
        console.error('Fetch simple tasks error:', error);
        res.status(500).json({ success: false, message: msg });
    }
};
