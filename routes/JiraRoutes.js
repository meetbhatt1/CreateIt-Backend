import express from "express";
import { auth } from "../middleware/AuthMiddleware.js";
import {
    initiateOAuth,
    handleCallback,
    getConnectionStatus,
    disconnectJira,
    fetchProjects,
    fetchIssues
} from "../controllers/JiraController.js";

const router = express.Router();

// OAuth Routes
router.get("/oauth/initiate", auth, initiateOAuth);
router.get("/oauth/callback", handleCallback); // Public callback
router.post("/disconnect", auth, disconnectJira);
router.get("/connection", auth, getConnectionStatus);

// Data Routes
router.get("/projects", auth, fetchProjects);
router.get("/issues/:projectKey", auth, fetchIssues);

export default router;
