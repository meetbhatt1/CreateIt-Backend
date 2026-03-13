import express from "express";
import { auth } from "../middleware/AuthMiddleware.js";
import { getProblems, getProblem, getDaily, getMockSet, getMcqQuestions, submitMcqAttempt } from "../controllers/MockInterviewController.js";

const router = express.Router();

router.get("/problems", auth, getProblems);
router.get("/problems/:titleSlug", auth, getProblem);
router.get("/daily", auth, getDaily);
router.get("/set", auth, getMockSet);
router.get("/mcq/questions", auth, getMcqQuestions);
router.post("/mcq/submit", auth, submitMcqAttempt);

export default router;
