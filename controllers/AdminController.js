import User from "../models/userModel.js";
import Team from "../models/Team.js";
import Project from "../models/projectModel.js";
import Comment from "../models/Comment.js";

/**
 * Admin endpoints - for localhost use only. No auth check for simplicity.
 */

/** GET /api/admin/users - list all users */
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("fullName email xp rating createdAt profileImage")
      .sort({ createdAt: -1 })
      .lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** GET /api/admin/teams - list all teams */
export const getAllTeams = async (req, res) => {
  try {
    const teams = await Team.find()
      .populate("owner", "fullName email")
      .sort({ createdAt: -1 })
      .lean();
    res.json(teams);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** GET /api/admin/activity - global activity feed (recent projects, likes, comments) */
export const getGlobalActivity = async (req, res) => {
  try {
    const [recentProjects, recentComments] = await Promise.all([
      Project.find().populate("owner", "fullName").sort({ createdAt: -1 }).limit(20).lean(),
      Comment.find().populate("author", "fullName").populate("projectId", "title").sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    const feed = [
      ...recentProjects.map((p) => ({
        type: "project",
        text: `${p.owner?.fullName || "Someone"} created project "${p.title}"`,
        userName: p.owner?.fullName,
        projectTitle: p.title,
        time: p.createdAt,
      })),
      ...recentComments.map((c) => ({
        type: "comment",
        text: `${c.author?.fullName || "Someone"} commented on project "${c.projectId?.title || "—"}"`,
        userName: c.author?.fullName,
        projectTitle: c.projectId?.title,
        time: c.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 50);

    res.json(feed);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
