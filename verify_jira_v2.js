import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import User from "./models/userModel.js";
import JiraCredentials from "./models/JiraCredentials.js";
import { syncJiraCloudId, listAccessibleResources } from "./services/jiraOAuthService.js";
import { getJiraProjects, getJiraIssuesForProject } from "./services/jiraDataService.js";

dotenv.config();

const logFile = "jira_verify_results_v2.txt";
const log = (msg) => {
    console.log(msg);
    fs.appendFileSync(logFile, msg + "\n");
};

if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

async function run() {
    try {
        log("--- Jira Verification V2 Start ---");
        await mongoose.connect(process.env.MONGO_URL);
        log("Connected to DB");

        const user = await User.findOne({ email: "bhattmeet0802@gmail.com" });
        if (!user) {
            log("User not found: bhattmeet0802@gmail.com");
            process.exit(1);
        }

        log("Found user ID: " + user._id);

        try {
            log("Testing getJiraIssuesForProject('KAN')...");
            const issues = await getJiraIssuesForProject(user._id, "KAN");
            log("Fetched issues count: " + issues.length);
        } catch (e) {
            log("getJiraIssuesForProject Error: " + (e.response?.data?.message || e.message));
            if (e.response) {
                log("Status: " + e.response.status);
                log("Data: " + JSON.stringify(e.response.data, null, 2));
            }
            if (e.config) {
                log("URL: " + e.config.url);
                log("Params: " + JSON.stringify(e.config.params));
            }
        }

        log("--- Jira Verification V2 End ---");

    } catch (err) {
        log("Critical Error: " + err.message);
    } finally {
        await mongoose.disconnect();
    }
}

run();
