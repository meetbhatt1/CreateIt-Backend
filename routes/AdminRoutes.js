import express from "express";
import { getAllUsers, getAllTeams, getGlobalActivity } from "../controllers/AdminController.js";

const router = express.Router();

router.get("/users", getAllUsers);
router.get("/teams", getAllTeams);
router.get("/activity", getGlobalActivity);

export default router;
