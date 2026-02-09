import { createJiraClient } from "./jiraOAuthService.js";

/**
 * Map JIRA issue status to CreateIt Kanban status
 */
const mapJiraStatusToKanban = (jiraStatus) => {
    const statusMap = {
        'To Do': 'todo',
        'In Progress': 'inProgress',
        'In Review': 'review',
        'Done': 'done',
        'Review': 'review',
        'Testing': 'review',
        'Closed': 'done',
        'Resolved': 'done'
    };

    // Try exact match first
    if (statusMap[jiraStatus]) {
        return statusMap[jiraStatus];
    }

    // Try case-insensitive match
    const lowerStatus = jiraStatus.toLowerCase();
    for (const [key, value] of Object.entries(statusMap)) {
        if (key.toLowerCase() === lowerStatus) {
            return value;
        }
    }

    // Default mapping based on common patterns
    if (lowerStatus.includes('todo') || lowerStatus.includes('to do') || lowerStatus.includes('backlog')) {
        return 'todo';
    }
    if (lowerStatus.includes('progress') || lowerStatus.includes('doing') || lowerStatus.includes('active')) {
        return 'inProgress';
    }
    if (lowerStatus.includes('review') || lowerStatus.includes('testing') || lowerStatus.includes('qa')) {
        return 'review';
    }
    if (lowerStatus.includes('done') || lowerStatus.includes('closed') || lowerStatus.includes('resolved')) {
        return 'done';
    }

    // Default to todo if unknown
    return 'todo';
};

/**
 * Map JIRA priority to CreateIt priority
 */
const mapJiraPriorityToKanban = (jiraPriority) => {
    if (!jiraPriority) return 'medium';
    
    const priorityMap = {
        'Highest': 'high',
        'High': 'high',
        'Medium': 'medium',
        'Low': 'low',
        'Lowest': 'low'
    };

    return priorityMap[jiraPriority] || 'medium';
};

/**
 * Transform JIRA issue to Kanban task format
 */
export const transformJiraIssueToTask = (issue) => {
    const fields = issue.fields || {};
    const status = fields.status?.name || 'To Do';
    const priority = fields.priority?.name || 'Medium';
    const assignee = fields.assignee?.displayName || fields.assignee?.emailAddress || 'Unassigned';
    
    // Extract description text (handle ADF format)
    let description = '';
    if (fields.description) {
        if (typeof fields.description === 'string') {
            description = fields.description;
        } else if (fields.description.content) {
            // ADF format - extract text from content array
            const extractText = (content) => {
                if (typeof content === 'string') return content;
                if (Array.isArray(content)) {
                    return content.map(item => {
                        if (item.type === 'text') return item.text || '';
                        if (item.content) return extractText(item.content);
                        return '';
                    }).join(' ');
                }
                return '';
            };
            description = extractText(fields.description.content);
        }
    }

    return {
        _id: issue.id,
        id: issue.id, // For compatibility
        key: issue.key,
        title: fields.summary || 'Untitled',
        description: description || '',
        status: mapJiraStatusToKanban(status),
        priority: mapJiraPriorityToKanban(priority),
        assignee: assignee,
        avatar: assignee.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2),
        due: fields.duedate ? new Date(fields.duedate).toISOString().split('T')[0] : null,
        xp: 0, // JIRA issues don't have XP
        createdAt: fields.created ? new Date(fields.created) : new Date(),
        updatedAt: fields.updated ? new Date(fields.updated) : new Date(),
        isJira: true, // Flag to identify JIRA tasks
        jiraIssueId: issue.id,
        jiraIssueKey: issue.key,
        jiraUrl: issue.self
    };
};

/**
 * Get JIRA projects for a user
 */
export const getJiraProjects = async (userId) => {
    const jira = await createJiraClient(userId);
    const response = await jira.get('/project');
    return response.data;
};

/**
 * Get JIRA issues for a project
 */
export const getJiraIssuesForProject = async (userId, projectKey) => {
    const jira = await createJiraClient(userId);
    const jql = `project = ${projectKey} ORDER BY updated DESC`;
    const response = await jira.get('/search', {
        params: { jql, maxResults: 100 }
    });
    return response.data.issues || [];
};

/**
 * Get JIRA issues grouped by status for Kanban
 */
export const getJiraIssuesGrouped = async (userId, projectKey) => {
    const issues = await getJiraIssuesForProject(userId, projectKey);
    const grouped = {
        todo: [],
        inProgress: [],
        review: [],
        done: []
    };

    issues.forEach(issue => {
        const task = transformJiraIssueToTask(issue);
        if (grouped[task.status]) {
            grouped[task.status].push(task);
        } else {
            // If status doesn't match, put in todo
            grouped.todo.push(task);
        }
    });

    return grouped;
};


