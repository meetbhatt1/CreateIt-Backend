import express from "express";
import { getDashboardStats, getActivityFeed } from "../controllers/DashboardController.js";
import { auth } from "../middleware/AuthMiddleware.js";

const router = express.Router();

router.get("/stats", auth, getDashboardStats);
router.get("/activity", auth, getActivityFeed);

export default router;
