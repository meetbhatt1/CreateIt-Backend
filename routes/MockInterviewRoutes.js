import express from "express";
import { auth } from "../middleware/AuthMiddleware.js";
import { getProblems, getProblem, getDaily, getMockSet } from "../controllers/MockInterviewController.js";

const router = express.Router();

router.get("/problems", auth, getProblems);
router.get("/problems/:titleSlug", auth, getProblem);
router.get("/daily", auth, getDaily);
router.get("/set", auth, getMockSet);

export default router;
