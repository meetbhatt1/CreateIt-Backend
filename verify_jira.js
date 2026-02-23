import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import User from "./models/userModel.js";
import JiraCredentials from "./models/JiraCredentials.js";
import { syncJiraCloudId, listAccessibleResources } from "./services/jiraOAuthService.js";
import { getJiraProjects } from "./services/jiraDataService.js";

dotenv.config();

const logFile = "jira_verify_results.txt";
const log = (msg) => {
    console.log(msg);
    fs.appendFileSync(logFile, msg + "\n");
};

if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

async function run() {
    try {
        log("--- Jira Verification Start ---");
        await mongoose.connect(process.env.MONGO_URL);
        log("Connected to DB");

        const user = await User.findOne({ email: "bhattmeet0802@gmail.com" });
        if (!user) {
            log("User not found: bhattmeet0802@gmail.com");
            process.exit(1);
        }

        log("Found user ID: " + user._id);

        const creds = await JiraCredentials.findOne({ user: user._id });
        if (!creds) {
            log("Jira credentials not found for user");
            process.exit(1);
        }

        log("Stored CloudId: " + creds.cloudId);
        log("Token expires at: " + creds.expiresAt);

        try {
            log("Testing listAccessibleResources...");
            const resources = await listAccessibleResources(creds.accessToken);
            log("Accessible resources found: " + resources.length);
            resources.forEach(r => {
                log(` - Resource: ${r.name} (${r.id})`);
                log(`   Scopes: ${JSON.stringify(r.scopes)}`);
            });
        } catch (e) {
            log("listAccessibleResources Error: " + (e.response?.data?.message || e.message));
        }

        try {
            log("Running syncJiraCloudId...");
            const syncedCreds = await syncJiraCloudId(user._id);
            log("Synced CloudId: " + syncedCreds.cloudId);
        } catch (e) {
            log("syncJiraCloudId Error: " + e.message);
        }

        try {
            log("Fetching projects (this uses cloudId)...");
            const projects = await getJiraProjects(user._id);
            log("Fetched projects count: " + projects.length);
            projects.forEach(p => log(` - Project: ${p.key} (${p.name})`));
        } catch (e) {
            log("getJiraProjects Error: " + (e.response?.data?.message || e.message));
            if (e.response) {
                log("Status: " + e.response.status);
                log("Data: " + JSON.stringify(e.response.data));
            }
        }

        log("--- Jira Verification End ---");

    } catch (err) {
        log("Critical Error: " + err.message);
    } finally {
        await mongoose.disconnect();
    }
}

run();
