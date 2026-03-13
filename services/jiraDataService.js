import {
    createJiraClient,
    getUserJiraCredentials,
    recoverJiraCloudId,
    recoverJiraCloudIdForProject,
} from "./jiraOAuthService.js";

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
 * @param {object} issue - Raw JIRA issue
 * @param {string} [siteUrl] - Base URL of Jira site (e.g. https://yoursite.atlassian.net) for "Open in JIRA" link
 */
export const transformJiraIssueToTask = (issue, siteUrl = null) => {
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

    const browseUrl = (siteUrl && issue.key) ? `${siteUrl.replace(/\/$/, "")}/browse/${issue.key}` : null;

    return {
        _id: issue.id,
        id: issue.id, // For compatibility
        key: issue.key,
        title: fields.summary || 'Untitled',
        description: description || '',
        status: mapJiraStatusToKanban(status),
        priority: mapJiraPriorityToKanban(priority),
        assignee: assignee,
        avatar: (assignee && assignee !== 'Unassigned') ? assignee.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : '?',
        due: fields.duedate ? new Date(fields.duedate).toISOString().split('T')[0] : null,
        xp: 0, // JIRA issues don't have XP
        createdAt: fields.created ? new Date(fields.created) : new Date(),
        updatedAt: fields.updated ? new Date(fields.updated) : new Date(),
        isJira: true,
        jiraIssueId: issue.id,
        jiraIssueKey: issue.key,
        jiraUrl: browseUrl || issue.self // Prefer browse URL for frontend "Open in JIRA" button
    };
};

/**
 * Get JIRA projects for a user
 * Normalizes response so frontend always gets an array (handles both array and paginated { values } from API).
 */
export const getJiraProjects = async (userId) => {
    let jira = await createJiraClient(userId);
    try {
        const response = await jira.get('/project');
        const data = response?.data;
        const list = Array.isArray(data) ? data : (data?.values ?? []);
        return list;
    } catch (error) {
        const status = error?.response?.status;
        if (status === 404 || status === 410) {
            await recoverJiraCloudId(userId);
            jira = await createJiraClient(userId);
            const response = await jira.get('/project');
            const data = response?.data;
            const list = Array.isArray(data) ? data : (data?.values ?? []);
            return list;
        }
        throw error;
    }
};

const SEARCH_ENDPOINT = '/search/jql'; // current API; legacy /search is deprecated/removed

/**
 * Get JIRA issues for a project
 */
const ISSUE_FIELDS = ['summary', 'description', 'status', 'assignee', 'priority', 'created', 'updated', 'duedate'];

export const getJiraIssuesForProject = async (userId, projectKey) => {
    let jira = await createJiraClient(userId);
    const payload = {
        jql: `project = ${projectKey} ORDER BY updated DESC`,
        maxResults: 100,
        fields: ISSUE_FIELDS
    };

    try {
        const response = await jira.post(SEARCH_ENDPOINT, payload);
        return response.data.issues || [];
    } catch (error) {
        const status = error?.response?.status;
        if (status === 404 || status === 410) {
            await recoverJiraCloudIdForProject(userId, projectKey);
            jira = await createJiraClient(userId);
            const response = await jira.post(SEARCH_ENDPOINT, payload);
            return response.data.issues || [];
        }
        throw error;
    }
};

/**
 * Get a single JIRA issue by key (for returning full task after create)
 */
export const getJiraIssueByKey = async (userId, issueKey) => {
    const jira = await createJiraClient(userId);
    const response = await jira.get(`/issue/${encodeURIComponent(issueKey)}`);
    return response.data;
};

/**
 * Get JIRA issues grouped by status for Kanban (full task shape + browse URL when siteUrl is stored)
 */
export const getJiraIssuesGrouped = async (userId, projectKey) => {
    const issues = await getJiraIssuesForProject(userId, projectKey);
    const credentials = await getUserJiraCredentials(userId);
    const siteUrl = credentials?.jiraSiteUrl || null;

    const grouped = {
        todo: [],
        inProgress: [],
        review: [],
        done: []
    };

    issues.forEach(issue => {
        const task = transformJiraIssueToTask(issue, siteUrl);
        if (grouped[task.status]) {
            grouped[task.status].push(task);
        } else {
            grouped.todo.push(task);
        }
    });

    return grouped;
};

/**
 * Build ADF description from plain text for JIRA API v3
 */
const descriptionToAdf = (text) => {
    if (text == null || text === '') return undefined;
    const t = String(text).trim();
    if (!t) return undefined;
    return {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }]
    };
};

/**
 * Create a JIRA issue
 * @param {string} userId
 * @param {object} opts - { projectKey, summary, description?, status? }
 * @returns {Promise<object>} Created issue (raw JIRA response)
 */
export const createJiraIssue = async (userId, { projectKey, summary, description, status }) => {
    let jira = await createJiraClient(userId);
    const body = {
        fields: {
            project: { key: projectKey },
            summary: summary || 'Untitled',
            issuetype: { name: 'Task' }
        }
    };
    if (description != null && String(description).trim()) {
        body.fields.description = descriptionToAdf(description);
    }
    try {
        const response = await jira.post('/issue', body);
        const key = response.data?.key;
        if (key && (status && status !== 'To Do')) {
            try {
                await transitionJiraIssue(userId, key, { status });
            } catch (_) {
                // Issue created; optional initial status transition failed (e.g. workflow)
            }
        }
        return response.data;
    } catch (error) {
        const statusCode = error?.response?.status;
        if (statusCode === 404 || statusCode === 410) {
            await recoverJiraCloudIdForProject(userId, projectKey);
            jira = await createJiraClient(userId);
            const response = await jira.post('/issue', body);
            return response.data;
        }
        throw error;
    }
};

/**
 * Update a JIRA issue (summary, description, priority, assignee, due)
 * @param {string} userId
 * @param {string} issueKey - e.g. PROJ-123
 * @param {object} updates - { summary?, description?, priority?, assignee?, due? }
 */
export const updateJiraIssue = async (userId, issueKey, { summary, description, priority, assignee, due }) => {
    let jira = await createJiraClient(userId);
    const fields = {};
    if (summary !== undefined) fields.summary = summary;
    if (description !== undefined) fields.description = descriptionToAdf(description);
    if (priority !== undefined) {
        const p = { high: 'High', medium: 'Medium', low: 'Low' }[priority] || priority;
        fields.priority = { name: p };
    }
    if (assignee !== undefined) {
        if (assignee === null || assignee === '' || assignee === 'Unassigned') {
            fields.assignee = null;
        } else {
            // JIRA Cloud expects accountId (string). Frontend can pass accountId from assignable users.
            fields.assignee = { accountId: String(assignee) };
        }
    }
    if (due !== undefined) fields.duedate = due ? new Date(due).toISOString().split('T')[0] : null;
    if (Object.keys(fields).length === 0) return;
    try {
        await jira.put(`/issue/${encodeURIComponent(issueKey)}`, { fields });
    } catch (error) {
        const statusCode = error?.response?.status;
        if (statusCode === 404 || statusCode === 410) {
            const projectKey = (issueKey || '').split('-')[0];
            if (projectKey) {
                await recoverJiraCloudIdForProject(userId, projectKey);
                jira = await createJiraClient(userId);
                await jira.put(`/issue/${encodeURIComponent(issueKey)}`, { fields });
            } else throw error;
        } else throw error;
    }
};

/**
 * Delete (or archive) a JIRA issue
 * @param {string} userId
 * @param {string} issueKey
 */
export const deleteJiraIssue = async (userId, issueKey) => {
    let jira = await createJiraClient(userId);
    try {
        await jira.delete(`/issue/${encodeURIComponent(issueKey)}`);
    } catch (error) {
        const statusCode = error?.response?.status;
        if (statusCode === 404 || statusCode === 410) {
            const projectKey = (issueKey || '').split('-')[0];
            if (projectKey) {
                await recoverJiraCloudIdForProject(userId, projectKey);
                jira = await createJiraClient(userId);
                await jira.delete(`/issue/${encodeURIComponent(issueKey)}`);
            } else throw error;
        } else throw error;
    }
};

/** Kanban status names the frontend sends → possible JIRA transition target names */
const KANBAN_STATUS_NAMES = ['To Do', 'In Progress', 'Review', 'Done', 'In Review', 'Closed', 'Resolved', 'Testing'];

/**
 * Find transition id whose target status name matches (case-insensitive)
 */
const findTransitionIdForStatus = (transitions, targetStatusName) => {
    const want = (targetStatusName || '').trim();
    if (!want) return null;
    const lower = want.toLowerCase();
    for (const t of transitions || []) {
        const toName = t.to?.name || '';
        if (toName.toLowerCase() === lower) return t.id;
    }
    for (const t of transitions || []) {
        const toName = (t.to?.name || '').toLowerCase();
        if (toName.includes(lower) || lower.includes(toName)) return t.id;
    }
    return (transitions && transitions[0]) ? transitions[0].id : null;
};

/**
 * Change issue status via JIRA transitions API
 * @param {string} userId
 * @param {string} issueKey
 * @param {object} opts - { status: "To Do" | "In Progress" | "Review" | "Done" }
 */
export const transitionJiraIssue = async (userId, issueKey, { status }) => {
    let jira = await createJiraClient(userId);
    const path = `/issue/${encodeURIComponent(issueKey)}/transitions`;
    let res;
    try {
        res = await jira.get(path);
    } catch (error) {
        const statusCode = error?.response?.status;
        if (statusCode === 404 || statusCode === 410) {
            const projectKey = (issueKey || '').split('-')[0];
            if (projectKey) {
                await recoverJiraCloudIdForProject(userId, projectKey);
                jira = await createJiraClient(userId);
                res = await jira.get(path);
            } else throw error;
        } else throw error;
    }
    const transitions = res.data?.transitions || [];
    const transitionId = findTransitionIdForStatus(transitions, status);
    if (!transitionId) {
        throw new Error(`No transition to status "${status}" found. Available: ${transitions.map(t => t.to?.name).join(', ') || 'none'}`);
    }
    await jira.post(path, { transition: { id: transitionId } });
};


