import axios from "axios";

const jira = axios.create({
    baseURL: `${process.env.JIRA_BASE_URL}/rest/api/3`,
    auth: {
        username: process.env.JIRA_EMAIL,
        password: process.env.JIRA_API_TOKEN,
    },
    headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
    },
});

export const createJiraIssue = async ({ projectKey, summary, description }) => {
    const res = await jira.post("/issue", {
        fields: {
            project: { key: projectKey },
            summary,
            description: {
                type: "doc",
                version: 1,
                content: [
                    { type: "paragraph", content: [{ type: "text", text: description }] },
                ],
            },
            issuetype: { name: "Task" },
        },
    });
    return res.data;
};

export const transitionJiraIssue = async (issueId, transitionId) => {
    await jira.post(`/issue/${issueId}/transitions`, {
        transition: { id: transitionId },
    });
};
export const updateJiraStatus = async (issueId, transitionId) => {
    await jira.post(`/issue/${issueId}/transitions`, {
        transition: { id: transitionId }
    });
};

export const getJiraIssues = async (jql) => {
    const res = await jira.get("/search", {
        params: { jql }
    });
    return res.data.issues;
};