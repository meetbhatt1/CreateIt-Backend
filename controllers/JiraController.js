import axios from "axios";
import {
    isJiraConnected,
    storeJiraCredentials,
    removeJiraCredentials,
    getUserJiraCredentials,
    listAccessibleResources,
    updateJiraTokenOnly,
} from "../services/jiraOAuthService.js";
import {
    getJiraProjects,
    getJiraIssuesGrouped,
    getJiraIssueByKey,
    createJiraIssue,
    updateJiraIssue,
    deleteJiraIssue,
    transitionJiraIssue,
    transformJiraIssueToTask,
} from "../services/jiraDataService.js";

/**
 * Initiate JIRA OAuth flow
 */
export const initiateOAuth = async (req, res) => {
    const clientId = process.env.ATLASSIAN_CLIENT_ID;
    const redirectUri = process.env.ATLASSIAN_REDIRECT_URI || "https://createit-zr78.onrender.com/api/jira/oauth/callback";
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
        // const base = process.env.FRONTEND_URL_PROD || process.env.FRONTEND_URL_DEV;
        const base = process.env.FRONTEND_URL_DEV;
        return res.redirect(`${base}/jira/error?message=Authorization failed`);
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
        // const base = process.env.FRONTEND_URL_PROD || process.env.FRONTEND_URL_DEV;
        const base = process.env.FRONTEND_URL_DEV;

        // 2. Get Cloud ID and optional site URL (accessible resources) - can return 410 even with valid token
        let cloudId;
        let siteUrl = null;
        try {
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
            const jiraResource = resources.find(hasJiraScope) || resources[0];
            cloudId = jiraResource?.id;
            if (typeof jiraResource?.url === "string" && jiraResource.url.trim()) {
                siteUrl = jiraResource.url.replace(/\/$/, "");
            }
        } catch (resourcesErr) {
            const status = resourcesErr?.response?.status;
            if (status === 410 || status === 401) {
                // Accessible-resources can return 410 for valid tokens; keep existing cloudId and just update token
                const updated = await updateJiraTokenOnly(userId, access_token, refresh_token, expires_in);
                if (updated) {
                    return res.redirect(`${base}/jira/success`);
                }
            }
            throw resourcesErr;
        }

        if (!cloudId) {
            throw new Error("No JIRA sites found for this account");
        }

        // 3. Store credentials (include siteUrl for "Open in JIRA" browse links)
        await storeJiraCredentials(userId, access_token, refresh_token, cloudId, expires_in, siteUrl);

        res.redirect(`${base}/jira/success`);
    } catch (error) {
        console.error("JIRA Callback Error:", error.response?.data || error.message);
        //  const base = process.env.FRONTEND_URL_PROD || process.env.FRONTEND_URL_DEV;
        const base = process.env.FRONTEND_URL_DEV;
        res.redirect(`${base}/jira/error?message=${encodeURIComponent(error.message)}`);
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
        res.json({ success: true, projects: Array.isArray(projects) ? projects : [] });
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
            return res.status(401).json({ success: false, message: error.message });
        }

        if (error.message?.includes("reconnect your JIRA account") || error.message?.includes("not accessible")) {
            return res.status(401).json({ success: false, message: error.message });
        }

        return res.status(upstreamStatus || 500).json({
            success: false,
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

/**
 * Create JIRA issue — POST /api/jira/issues
 * Body: { projectKey, summary, description?, status? }
 */
export const createIssue = async (req, res) => {
    const { projectKey, summary, description, status } = req.body || {};
    if (!projectKey || !summary) {
        return res.status(400).json({ message: "projectKey and summary are required" });
    }
    try {
        const created = await createJiraIssue(req.user._id, { projectKey, summary, description, status });
        const issueKey = created?.key;
        if (!issueKey) {
            return res.status(201).json(created);
        }
        const credentials = await getUserJiraCredentials(req.user._id);
        const siteUrl = credentials?.jiraSiteUrl || null;
        const fullIssue = await getJiraIssueByKey(req.user._id, issueKey);
        const task = transformJiraIssueToTask(fullIssue, siteUrl);
        return res.status(201).json(task);
    } catch (error) {
        const msg = error.message || "Failed to create JIRA issue";
        const statusCode = error?.response?.status;
        if (error.message?.includes("not connected")) {
            return res.status(401).json({ message: error.message });
        }
        return res.status(statusCode && statusCode >= 400 ? statusCode : 500).json({ message: msg });
    }
};

/**
 * Update JIRA issue — PATCH /api/jira/issues/:issueKey
 * Body: { summary?, description?, priority?, assignee?, due? }
 */
export const updateIssue = async (req, res) => {
    const { issueKey } = req.params;
    const { summary, description, priority, assignee, due } = req.body || {};
    if (!issueKey) {
        return res.status(400).json({ message: "issueKey is required" });
    }
    try {
        await updateJiraIssue(req.user._id, issueKey, { summary, description, priority, assignee, due });
        return res.json({ success: true });
    } catch (error) {
        const msg = error.message || "Failed to update JIRA issue";
        const statusCode = error?.response?.status;
        if (error.message?.includes("not connected")) {
            return res.status(401).json({ message: error.message });
        }
        return res.status(statusCode && statusCode >= 400 ? statusCode : 500).json({ message: msg });
    }
};

/**
 * Delete JIRA issue — DELETE /api/jira/issues/:issueKey
 */
export const deleteIssue = async (req, res) => {
    const { issueKey } = req.params;
    if (!issueKey) {
        return res.status(400).json({ message: "issueKey is required" });
    }
    try {
        await deleteJiraIssue(req.user._id, issueKey);
        return res.json({ success: true });
    } catch (error) {
        const msg = error.message || "Failed to delete JIRA issue";
        const statusCode = error?.response?.status;
        if (error.message?.includes("not connected")) {
            return res.status(401).json({ message: error.message });
        }
        return res.status(statusCode && statusCode >= 400 ? statusCode : 500).json({ message: msg });
    }
};

/**
 * Transition JIRA issue status — PATCH /api/jira/issues/:issueKey/transition
 * Body: { status: "To Do" | "In Progress" | "Review" | "Done" }
 */
export const transitionIssue = async (req, res) => {
    const { issueKey } = req.params;
    const { status } = req.body || {};
    if (!issueKey) {
        return res.status(400).json({ message: "issueKey is required" });
    }
    if (!status) {
        return res.status(400).json({ message: "status is required" });
    }
    try {
        await transitionJiraIssue(req.user._id, issueKey, { status });
        return res.json({ success: true });
    } catch (error) {
        const msg = error.message || "Failed to transition JIRA issue";
        const statusCode = error?.response?.status;
        if (error.message?.includes("not connected")) {
            return res.status(401).json({ message: error.message });
        }
        return res.status(statusCode && statusCode >= 400 ? statusCode : 500).json({ message: msg });
    }
};
