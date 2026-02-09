import axios from "axios";
import JiraCredentials from "../models/JiraCredentials.js";

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

        return credentials;
    } catch (error) {
        console.error("Error refreshing JIRA token:", error);
        // If refresh fails, user needs to reconnect
        await JiraCredentials.deleteOne({ _id: credentials._id });
        throw new Error("JIRA token refresh failed. Please reconnect your JIRA account.");
    }
};

/**
 * Create authenticated JIRA axios instance for a user
 */
export const createJiraClient = async (userId) => {
    const credentials = await getUserJiraCredentials(userId);
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


