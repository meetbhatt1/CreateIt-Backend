import axios from "axios";
import {
    isJiraConnected,
    storeJiraCredentials,
    removeJiraCredentials,
    getUserJiraCredentials
} from "../services/jiraOAuthService.js";
import {
    getJiraProjects,
    getJiraIssuesGrouped
} from "../services/jiraDataService.js";

/**
 * Initiate JIRA OAuth flow
 */
export const initiateOAuth = async (req, res) => {
    const clientId = process.env.ATLASSIAN_CLIENT_ID;
    const redirectUri = process.env.ATLASSIAN_REDIRECT_URI || "http://localhost:8000/api/jira/oauth/callback";
    const scope = "read:jira-work read:jira-user write:jira-work offline_access";
    const state = req.user._id; // Use user ID as state to verify callback

    const authUrl = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${clientId}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&response_type=code&prompt=consent`;

    res.json({ authUrl });
};

/**
 * Handle JIRA OAuth callback
 */
export const handleCallback = async (req, res) => {
    const { code, state } = req.query;
    const userId = state; // We used userId as state

    if (!code) {
        return res.redirect(`${process.env.FRONTEND_URL}/jira/error?message=Authorization failed`);
    }

    try {
        // 1. Exchange code for access token
        const tokenResponse = await axios.post('https://auth.atlassian.com/oauth/token', {
            grant_type: 'authorization_code',
            client_id: process.env.ATLASSIAN_CLIENT_ID,
            client_secret: process.env.ATLASSIAN_CLIENT_SECRET,
            code,
            redirect_uri: process.env.ATLASSIAN_REDIRECT_URI
        });

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        // 2. Get Cloud ID (accessible resources)
        const resourcesResponse = await axios.get('https://api.atlassian.com/oauth/token/accessible-resources', {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });

        const cloudId = resourcesResponse.data[0]?.id;
        if (!cloudId) {
            throw new Error("No JIRA sites found for this account");
        }

        // 3. Store credentials
        await storeJiraCredentials(userId, access_token, refresh_token, cloudId, expires_in);

        res.redirect(`${process.env.FRONTEND_URL}/jira/success`);
    } catch (error) {
        console.error("JIRA Callback Error:", error.response?.data || error.message);
        res.redirect(`${process.env.FRONTEND_URL}/jira/error?message=${encodeURIComponent(error.message)}`);
    }
};

/**
 * Get JIRA connection status
 */
export const getConnectionStatus = async (req, res) => {
    try {
        const connected = await isJiraConnected(req.user._id);
        res.json({ connected });
    } catch (error) {
        res.status(500).json({ message: "Error checking JIRA connection" });
    }
};

/**
 * Disconnect JIRA
 */
export const disconnectJira = async (req, res) => {
    try {
        await removeJiraCredentials(req.user._id);
        res.json({ message: "JIRA disconnected successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error disconnecting JIRA" });
    }
};

/**
 * Get JIRA projects
 */
export const fetchProjects = async (req, res) => {
    try {
        const projects = await getJiraProjects(req.user._id);
        res.json(projects);
    } catch (error) {
        console.error("Fetch JIRA Projects Error:", error.message);
        res.status(error.message.includes("not connected") ? 401 : 500).json({
            message: error.message
        });
    }
};

/**
 * Get JIRA issues for a project (Kanban format)
 */
export const fetchIssues = async (req, res) => {
    const { projectKey } = req.params;
    try {
        const issues = await getJiraIssuesGrouped(req.user._id, projectKey);
        res.json(issues);
    } catch (error) {
        console.error("Fetch JIRA Issues Error:", error.message);
        res.status(error.message.includes("not connected") ? 401 : 500).json({
            message: error.message
        });
    }
};
