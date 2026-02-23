import { createJiraClient, recoverJiraCloudIdForProject } from "./jiraOAuthService.js";
import { getJiraIssuesForProject } from "./jiraDataService.js";

/**
 * Map raw Jira issues to simple task shape (from POST /search response or from getJiraIssuesForProject).
 */
function mapIssuesToTasks(responseOrIssues) {
    const issues = Array.isArray(responseOrIssues)
        ? responseOrIssues
        : (responseOrIssues?.data?.issues ?? []);
    return issues.map(issue => ({
        id: issue.id,
        key: issue.key,
        title: issue.fields?.summary ?? 'Untitled',
        status: issue.fields?.status?.name || 'To Do',
        assignee: issue.fields?.assignee?.displayName || 'Unassigned',
        priority: issue.fields?.priority?.name || 'Medium',
        created: issue.fields?.created,
        updated: issue.fields?.updated
    }));
}

export const getSimpleJiraTasks = async (userId, projectKey) => {
    const payload = {
        jql: `project = ${projectKey} ORDER BY updated DESC`,
        maxResults: 100
    };

    try {
        let jira = await createJiraClient(userId);
        const response = await jira.post('/search', payload);
        return mapIssuesToTasks(response);
    } catch (error) {
        const status = error?.response?.status;
        if (status === 404 || status === 410) {
            try {
                await recoverJiraCloudIdForProject(userId, projectKey);
                const jira = await createJiraClient(userId);
                const response = await jira.post('/search', payload);
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
