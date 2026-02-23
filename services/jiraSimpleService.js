import { createJiraClient, recoverJiraCloudIdForProject } from "./jiraOAuthService.js";
import { getJiraIssuesForProject } from "./jiraDataService.js";

/** Normalize Jira status for Kanban (In Progress, To Do, Done, etc.). */
function normalizeStatus(statusObj) {
    if (!statusObj) return 'To Do';
    const name = statusObj.name ?? statusObj.statusCategory?.name ?? statusObj.id ?? '';
    if (typeof name === 'string' && name.length) return name;
    const category = statusObj.statusCategory?.key;
    if (category === 'indeterminate') return 'In Progress';
    if (category === 'done') return 'Done';
    return 'To Do';
}

/** Map raw Jira issues to simple task shape. Handles /search and /search/jql response shapes. */
function mapIssuesToTasks(responseOrIssues) {
    const data = responseOrIssues?.data ?? responseOrIssues;
    const issues = Array.isArray(data) ? data : (data?.issues ?? data?.values ?? []);
    return issues.map(issue => {
        const f = issue.fields ?? issue;
        const statusObj = f.status ?? f.statusCategory;
        return {
            id: issue.id,
            key: issue.key,
            title: f.summary ?? f.title ?? 'Untitled',
            status: normalizeStatus(statusObj),
            assignee: f.assignee?.displayName ?? f.assignee?.name ?? f.assignee?.emailAddress ?? 'Unassigned',
            priority: f.priority?.name ?? f.priority ?? 'Medium',
            created: f.created,
            updated: f.updated
        };
    });
}

const SEARCH_ENDPOINT = '/search/jql'; // current API; legacy /search is deprecated/removed

export const getSimpleJiraTasks = async (userId, projectKey) => {
    const payload = {
        jql: `project = ${projectKey} ORDER BY updated DESC`,
        maxResults: 100,
        fields: ['summary', 'status', 'assignee', 'priority', 'created', 'updated']
    };

    try {
        let jira = await createJiraClient(userId);
        const response = await jira.post(SEARCH_ENDPOINT, payload);
        return mapIssuesToTasks(response);
    } catch (error) {
        const status = error?.response?.status;
        if (status === 404 || status === 410) {
            try {
                await recoverJiraCloudIdForProject(userId, projectKey);
                const jira = await createJiraClient(userId);
                const response = await jira.post(SEARCH_ENDPOINT, payload);
                return mapIssuesToTasks(response);
            } catch (recoveryErr) {
                try {
                    const issues = await getJiraIssuesForProject(userId, projectKey);
                    return mapIssuesToTasks(issues);
                } catch (fallbackErr) {
                    console.error('Jira 410 recovery and fallback failed:', recoveryErr.message);
                    const raw = recoveryErr?.message || '';
                    const friendly = raw.includes('status code 410') || raw.includes('status code 401')
                        ? 'JIRA connection is no longer valid. Please disconnect and reconnect your JIRA account in Settings.'
                        : (recoveryErr.message || 'JIRA site is no longer available. Please reconnect your JIRA account in Settings.');
                    throw new Error(friendly);
                }
            }
        }
        console.error('Simple Jira fetch error:', error.message);
        const msg = error.response?.data?.errorMessages?.[0] || error.response?.data?.message || error.message;
        throw new Error(msg || 'Failed to fetch Jira tasks');
    }
};
