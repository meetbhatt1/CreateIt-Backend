import axios from "axios";
import JiraCredentials from "../models/JiraCredentials.js";

const ACCESSIBLE_RESOURCES_URL =
    "https://api.atlassian.com/oauth/token/accessible-resources";

const hasJiraScope = (resource) => {
    const scopes = Array.isArray(resource?.scopes) ? resource.scopes : [];
    return scopes.some((s) => {
        if (typeof s !== "string") return false;

        // Classic Jira scopes
        if (s === "read:jira-work" || s === "write:jira-work") return true;

        // Some apps may still get non-granular "read:jira-*" scopes
        if (s.startsWith("read:jira") || s.startsWith("write:jira")) return true;

        // Granular scopes look like "read:issue:jira", "read:project:jira", etc.
        if (s.includes(":jira")) return true;
        if (s.includes("jira")) return true; // More aggressive catch-all

        return false;
    });
};

/**
 * Get JIRA credentials for a user
 */
export const getUserJiraCredentials = async (userId) => {
    const credentials = await JiraCredentials.findOne({ user: userId });
    if (!credentials) {
        return null;
    }

    // Check if token is expired and refresh if needed
    if (credentials.expiresAt < new Date()) {
        return await refreshJiraToken(credentials);
    }

    return credentials;
};

/**
 * Refresh JIRA access token
 */
export const refreshJiraToken = async (credentials) => {
    try {
        console.log('[JIRA] Refreshing expired token...');
        const response = await axios.post(
            'https://auth.atlassian.com/oauth/token',
            {
                grant_type: 'refresh_token',
                client_id: process.env.ATLASSIAN_CLIENT_ID,
                client_secret: process.env.ATLASSIAN_CLIENT_SECRET,
                refresh_token: credentials.refreshToken
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        const { access_token, expires_in } = response.data;
        const expiresAt = new Date(Date.now() + expires_in * 1000);

        credentials.accessToken = access_token;
        credentials.expiresAt = expiresAt;
        await credentials.save();

        console.log('[JIRA] Token refreshed successfully');
        return credentials;
    } catch (error) {
        console.error("[JIRA] Token refresh failed:", error.response?.data || error.message);
        // Don't delete credentials immediately - let user try again
        // Only throw error so connection check returns false
        throw new Error("JIRA token expired. Please reconnect your JIRA account in Settings.");
    }
};

/**
 * Create authenticated JIRA axios instance for a user
 */
export const createJiraClient = async (userId) => {
    // Keep stored cloudId aligned with the account's current accessible Jira sites.
    const credentials = await syncJiraCloudId(userId);
    if (!credentials) {
        throw new Error("JIRA not connected. Please connect your JIRA account first.");
    }

    return axios.create({
        baseURL: `https://api.atlassian.com/ex/jira/${credentials.cloudId}/rest/api/3`,
        headers: {
            'Authorization': `Bearer ${credentials.accessToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    });
};

export const listAccessibleResources = async (accessToken) => {
    const resourcesResponse = await axios.get(ACCESSIBLE_RESOURCES_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    return resourcesResponse.data || [];
};

const testJiraCloudId = async ({ cloudId, accessToken }) => {
    // If this cloudId is valid, this request should succeed.
    // Use a "work" endpoint (not /myself) to avoid requiring read:jira-user to validate the site.
    await axios.get(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project/search`, {
        params: { maxResults: 1 },
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
        },
    });
};

const testJiraCloudIdForProject = async ({ cloudId, accessToken, projectKey }) => {
    if (!projectKey) {
        throw new Error("projectKey is required");
    }

    await axios.get(
        `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project/${encodeURIComponent(
            projectKey
        )}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
            },
        }
    );
};

/**
 * Ensure stored cloudId is still valid for the user's Atlassian account.
 * If the saved cloudId is no longer accessible, update to the first available site.
 */
export const syncJiraCloudId = async (userId) => {
    const credentials = await getUserJiraCredentials(userId);
    if (!credentials) {
        throw new Error("JIRA not connected. Please connect your JIRA account first.");
    }

    const resources = await listAccessibleResources(credentials.accessToken);
    const preferred = resources.find((r) => r?.id === credentials.cloudId && hasJiraScope(r));
    const jiraResource = resources.find(hasJiraScope);
    const cloudId = preferred?.id || jiraResource?.id;

    if (!cloudId) {
        await JiraCredentials.deleteOne({ _id: credentials._id });
        throw new Error("No JIRA sites found for this account. Please reconnect your JIRA account.");
    }

    if (credentials.cloudId !== cloudId) {
        credentials.cloudId = cloudId;
        await credentials.save();
    }

    return credentials;
};

/**
 * If we get a 410 from Jira, try *each* accessible Jira site until we find one that works.
 * Updates stored cloudId on success.
 */
export const recoverJiraCloudId = async (userId) => {
    const credentials = await getUserJiraCredentials(userId);
    if (!credentials) {
        throw new Error("JIRA not connected. Please connect your JIRA account first.");
    }

    const resources = await listAccessibleResources(credentials.accessToken);
    const jiraResources = resources.filter(hasJiraScope);

    let lastStatus = null;
    for (const resource of jiraResources) {
        const cloudId = resource?.id;
        if (!cloudId) continue;

        try {
            await testJiraCloudId({ cloudId, accessToken: credentials.accessToken });
            if (credentials.cloudId !== cloudId) {
                credentials.cloudId = cloudId;
                await credentials.save();
            }
            return credentials;
        } catch (error) {
            const status = error?.response?.status ?? null;
            lastStatus = status;
            if (status === 404 || status === 403 || status === 410) continue;
            if (status === 401) break;
            throw error;
        }
    }

    await JiraCredentials.deleteOne({ _id: credentials._id });

    if (lastStatus === 401) {
        throw new Error("JIRA authorization expired or was revoked. Please reconnect your JIRA account in Settings.");
    }

    if (lastStatus === 403) {
        throw new Error("JIRA access was denied for this account. Please reconnect your JIRA account in Settings.");
    }

    throw new Error("JIRA site is no longer accessible (cloudId invalid). Please reconnect your JIRA account in Settings.");
};

/**
 * Recover cloudId by finding the Jira site that contains the given project key.
 * This avoids picking an accessible Jira site that isn't the one backing the project being viewed.
 */
export const recoverJiraCloudIdForProject = async (userId, projectKey) => {
    const credentials = await getUserJiraCredentials(userId);
    if (!credentials) {
        throw new Error("JIRA not connected. Please connect your JIRA account first.");
    }

    const resources = await listAccessibleResources(credentials.accessToken);
    const jiraResources = resources.filter(hasJiraScope);

    let lastStatus = null;
    for (const resource of jiraResources) {
        const cloudId = resource?.id;
        if (!cloudId) continue;

        try {
            await testJiraCloudIdForProject({
                cloudId,
                accessToken: credentials.accessToken,
                projectKey,
            });
            if (credentials.cloudId !== cloudId) {
                credentials.cloudId = cloudId;
                await credentials.save();
            }
            return credentials;
        } catch (error) {
            const status = error?.response?.status ?? null;
            lastStatus = status;

            // Project doesn't exist on this site, or site is inaccessible for this token.
            if (status === 404 || status === 403 || status === 410) continue;

            // Token revoked/expired.
            if (status === 401) break;

            throw error;
        }
    }

    await JiraCredentials.deleteOne({ _id: credentials._id });

    if (lastStatus === 401) {
        throw new Error("JIRA authorization expired or was revoked. Please reconnect your JIRA account in Settings.");
    }

    throw new Error(
        "JIRA project is not accessible on any linked site. Please reconnect your JIRA account in Settings."
    );
};

/**
 * Store JIRA credentials after OAuth callback
 */
export const storeJiraCredentials = async (userId, accessToken, refreshToken, cloudId, expiresIn) => {
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await JiraCredentials.findOneAndUpdate(
        { user: userId },
        {
            accessToken,
            refreshToken,
            cloudId,
            expiresAt,
            connectedAt: new Date()
        },
        { upsert: true, new: true }
    );
};

/**
 * Remove JIRA credentials (disconnect)
 */
export const removeJiraCredentials = async (userId) => {
    await JiraCredentials.deleteOne({ user: userId });
};

/**
 * Check if user has JIRA connected
 */
export const isJiraConnected = async (userId) => {
    const credentials = await JiraCredentials.findOne({ user: userId });
    return !!credentials;
};
