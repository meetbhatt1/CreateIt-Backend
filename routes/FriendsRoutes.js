import express from "express";
import {
  getFriends,
  discoverUsers,
  getProfile,
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  checkFriendStatus,
  sendProjectInvite,
} from "../controllers/FriendsController.js";
import { auth } from "../middleware/AuthMiddleware.js";
import { validateObjectId } from "../middleware/validateObjectId.js";

const router = express.Router();

router.get("/", auth, getFriends);
router.get("/discover", auth, discoverUsers);
router.post("/request", auth, sendFriendRequest);
router.get("/requests", auth, getFriendRequests);
router.post("/requests/:id/accept", auth, validateObjectId("id"), acceptFriendRequest);
router.post("/requests/:id/reject", auth, validateObjectId("id"), rejectFriendRequest);
router.get("/profile/:userId", auth, validateObjectId("userId"), getProfile);
router.get("/check/:userId", auth, validateObjectId("userId"), checkFriendStatus);
router.post("/project-invite", auth, sendProjectInvite);

export default router;
