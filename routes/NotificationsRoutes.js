import express from "express";
import { getNotifications, markRead, markAllRead } from "../controllers/NotificationsController.js";
import { auth } from "../middleware/AuthMiddleware.js";
import { validateObjectId } from "../middleware/validateObjectId.js";

const router = express.Router();

router.get("/", auth, getNotifications);
router.post("/:id/read", auth, validateObjectId("id"), markRead);
router.post("/read-all", auth, markAllRead);

export default router;
