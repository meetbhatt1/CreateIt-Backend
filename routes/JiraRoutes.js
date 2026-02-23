import express from "express";
import { auth } from "../middleware/AuthMiddleware.js";
import {
    initiateOAuth,
    handleCallback,
    getConnectionStatus,
    disconnectJira,
    fetchProjects,
    fetchIssues,
    debugJira
} from "../controllers/JiraController.js";
import { fetchSimpleTasks } from "../controllers/JiraSimpleController.js";

const router = express.Router();

// OAuth Routes
router.get("/oauth/initiate", auth, initiateOAuth);
router.get("/oauth/callback", handleCallback); // Public callback
router.post("/disconnect", auth, disconnectJira);
router.get("/connection", auth, getConnectionStatus);
router.get("/debug", auth, debugJira);

// Data Routes
router.get("/projects", auth, fetchProjects);
router.get("/issues/:projectKey", auth, fetchIssues);
router.get("/tasks/:projectKey", auth, fetchSimpleTasks); // NEW: Simple tasks endpoint

export default router;
