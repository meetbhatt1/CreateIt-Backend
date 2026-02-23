import axios from "axios";
import {
    isJiraConnected,
    storeJiraCredentials,
    removeJiraCredentials,
    getUserJiraCredentials,
    listAccessibleResources
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

        const resources = resourcesResponse.data || [];

        const hasJiraScope = (resource) => {
            const scopes = Array.isArray(resource?.scopes) ? resource.scopes : [];
            return scopes.some((s) => {
                if (typeof s !== "string") return false;
                if (s === "read:jira-work" || s === "write:jira-work") return true;
                if (s.startsWith("read:jira") || s.startsWith("write:jira")) return true;
                if (s.includes(":jira")) return true;
                return false;
            });
        };

        // Pick the resource that actually has Jira scopes, not just "the first one"
        const jiraResource = resources.find(hasJiraScope) || resources[0];

        const cloudId = jiraResource?.id;
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
 * Debug JIRA OAuth + cloudId mapping (dev helper)
 */
export const debugJira = async (req, res) => {
    try {
        const creds = await getUserJiraCredentials(req.user._id);
        if (!creds) {
            return res.status(200).json({ connected: false });
        }

        const resources = await listAccessibleResources(creds.accessToken);
        const jiraResources = (resources || []).filter((r) =>
            Array.isArray(r?.scopes) && r.scopes.includes("read:jira-work")
        );

        const results = [];
        for (const r of jiraResources) {
            const cloudId = r?.id;
            if (!cloudId) continue;

            try {
                await axios.get(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/myself`, {
                    headers: { Authorization: `Bearer ${creds.accessToken}`, Accept: "application/json" }
                });
                results.push({ id: cloudId, name: r?.name, url: r?.url, ok: true });
            } catch (error) {
                results.push({
                    id: cloudId,
                    name: r?.name,
                    url: r?.url,
                    ok: false,
                    status: error?.response?.status || null,
                    message: error?.response?.data?.message || error.message
                });
            }
        }

        res.status(200).json({
            connected: true,
            storedCloudId: creds.cloudId,
            jiraResources: results
        });
    } catch (error) {
        res.status(500).json({ message: error.message || "Debug failed" });
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
        const upstreamStatus = error?.response?.status;
        const upstreamMessage = error?.response?.data?.message;

        console.error("Fetch JIRA Projects Error full:", error);
        console.error("Fetch JIRA Projects Error status:", upstreamStatus);
        console.error("Fetch JIRA Projects Error message:", upstreamMessage || error.message);

        if (upstreamStatus === 410) {
            // Sites with 410 status should be handled by recoverJiraCloudId in the service.
            // If it escapes to here, it might be a transient Atlassian error.
            console.warn("JIRA site returned 410 - recovery should have been attempted.");
        }

        if (error.message?.includes("not connected")) {
            return res.status(401).json({ message: error.message });
        }

        if (error.message?.includes("reconnect your JIRA account") || error.message?.includes("not accessible")) {
            return res.status(401).json({ message: error.message });
        }

        res.status(upstreamStatus || 500).json({
            message: upstreamMessage || error.message || "Failed to fetch JIRA projects"
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
        const upstreamStatus = error?.response?.status;
        const upstreamMessage = error?.response?.data?.message;

        console.error("Fetch JIRA Issues Error full:", error);
        console.error("Fetch JIRA Issues Error status:", upstreamStatus);
        console.error("Fetch JIRA Issues Error message:", upstreamMessage || error.message);

        if (upstreamStatus === 410) {
            // Transient 410 or recovery failure
            console.warn("JIRA site returned 410 - recovery should have been attempted.");
        }

        if (error.message?.includes("not connected")) {
            return res.status(401).json({ message: error.message });
        }

        if (error.message?.includes("reconnect your JIRA account") || error.message?.includes("not accessible")) {
            return res.status(401).json({ message: error.message });
        }

        res.status(upstreamStatus || 500).json({
            message: upstreamMessage || error.message || "Failed to fetch JIRA issues"
        });
    }
};
