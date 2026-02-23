import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import User from "./models/userModel.js";
import JiraCredentials from "./models/JiraCredentials.js";
import { createJiraClient } from "./services/jiraOAuthService.js";

dotenv.config();

const logFile = "jira_test_post_search.txt";
const log = (msg) => {
    console.log(msg);
    fs.appendFileSync(logFile, msg + "\n");
};

if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

async function run() {
    try {
        log("--- Jira POST Search Test Start ---");
        await mongoose.connect(process.env.MONGO_URL);

        const user = await User.findOne({ email: "bhattmeet0802@gmail.com" });
        const jira = await createJiraClient(user._id);

        log("Testing POST /search...");
        try {
            const response = await jira.post('/search', {
                jql: 'project = KAN ORDER BY updated DESC',
                maxResults: 10
            });
            log("POST Search Success! Issues count: " + response.data.issues?.length);
        } catch (e) {
            log("POST Search Error: " + (e.response?.data?.message || e.message));
        }

        log("Testing GET /search/jql...");
        try {
            const response = await jira.get('/search/jql', {
                params: {
                    jql: 'project = KAN ORDER BY updated DESC',
                    maxResults: 10
                }
            });
            log("GET /search/jql Success! Issues count: " + response.data.issues?.length);
        } catch (e) {
            log("GET /search/jql Error: " + (e.response?.data?.message || e.message));
        }

    } catch (err) {
        log("Critical Error: " + err.message);
    } finally {
        await mongoose.disconnect();
    }
}

run();
