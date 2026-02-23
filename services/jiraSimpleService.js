import { createJiraClient } from "./jiraOAuthService.js";

/**
 * Super simple function to fetch Jira tasks for a project
 * No fancy recovery, no complex error handling - just fetch the tasks
 */
export const getSimpleJiraTasks = async (userId, projectKey) => {
    try {
        const jira = await createJiraClient(userId);

        // Simple POST request to get tasks
        const response = await jira.post('/search', {
            jql: `project = ${projectKey} ORDER BY created DESC`,
            maxResults: 100,
            fields: ['summary', 'status', 'assignee', 'priority', 'created', 'updated']
        });

        // Return just the basic task data
        return response.data.issues.map(issue => ({
            id: issue.id,
            key: issue.key,
            title: issue.fields.summary,
            status: issue.fields.status?.name || 'To Do',
            assignee: issue.fields.assignee?.displayName || 'Unassigned',
            priority: issue.fields.priority?.name || 'Medium',
            created: issue.fields.created,
            updated: issue.fields.updated
        }));
    } catch (error) {
        console.error('Simple Jira fetch error:', error.message);
        throw new Error(`Failed to fetch Jira tasks: ${error.message}`);
    }
};
