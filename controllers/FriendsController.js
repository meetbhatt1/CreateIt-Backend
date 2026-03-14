import FriendRequest from "../models/FriendRequest.js";
import Notification from "../models/Notification.js";
import User from "../models/userModel.js";
import Project from "../models/projectModel.js";

/** GET /api/friends - list my friends */
export const getFriends = async (req, res) => {
  try {
    const userId = req.user._id;
    const accepted = await FriendRequest.find({
      status: "accepted",
      $or: [{ from: userId }, { to: userId }],
    })
      .populate("from", "fullName email profileImage xp")
      .populate("to", "fullName email profileImage xp")
      .lean();
    const friendIds = accepted.map((r) =>
      String(r.from._id) === String(userId) ? r.to : r.from
    );
    const friends = await User.find({ _id: { $in: friendIds } })
      .select("fullName email profileImage xp createdAt")
      .lean();
    res.json(friends);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** POST /api/friends/request - send friend request */
export const sendFriendRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const { toUserId } = req.body;
    if (!toUserId || toUserId === String(userId)) {
      return res.status(400).json({ message: "Invalid user" });
    }
    const existing = await FriendRequest.findOne({
      $or: [
        { from: userId, to: toUserId },
        { from: toUserId, to: userId },
      ],
    });
    if (existing) {
      if (existing.status === "accepted") return res.status(400).json({ message: "Already friends" });
      if (existing.status === "pending") return res.status(400).json({ message: "Request already sent" });
      if (existing.status === "rejected") {
        const request = await FriendRequest.findByIdAndUpdate(
          existing._id,
          { from: userId, to: toUserId, status: "pending" },
          { new: true }
        );
        await Notification.create({
          user: toUserId,
          type: "friend_request",
          fromUser: userId,
          ref: request._id,
          text: "sent you a friend request",
        });
        return res.status(201).json({ request });
      }
    }
    const request = await FriendRequest.create({ from: userId, to: toUserId });
    await Notification.create({
      user: toUserId,
      type: "friend_request",
      fromUser: userId,
      ref: request._id,
      text: "sent you a friend request",
    });
    res.status(201).json({ request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** GET /api/friends/requests - list received pending friend requests */
export const getFriendRequests = async (req, res) => {
  try {
    const userId = req.user._id;
    const list = await FriendRequest.find({ to: userId, status: "pending" })
      .populate("from", "fullName email profileImage")
      .sort({ createdAt: -1 })
      .lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** POST /api/friends/requests/:id/accept */
export const acceptFriendRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const request = await FriendRequest.findOneAndUpdate(
      { _id: req.params.id, to: userId, status: "pending" },
      { status: "accepted" },
      { new: true }
    ).populate("from", "fullName email");
    if (!request) return res.status(404).json({ message: "Request not found" });
    await Notification.create({
      user: request.from._id,
      type: "friend_accepted",
      fromUser: userId,
      ref: request._id,
      text: "accepted your friend request",
    });
    res.json({ request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** POST /api/friends/requests/:id/reject */
export const rejectFriendRequest = async (req, res) => {
  try {
    const request = await FriendRequest.findOneAndUpdate(
      { _id: req.params.id, to: req.user._id, status: "pending" },
      { status: "rejected" },
      { new: true }
    );
    if (!request) return res.status(404).json({ message: "Request not found" });
    res.json({ request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** GET /api/friends/discover - list users (for collaborator market) with preferredLanguage and projects uploaded */
export const discoverUsers = async (req, res) => {
  try {
    const userId = req.user._id;
    const users = await User.find({ _id: { $ne: userId } })
      .select("fullName email profileImage xp preferredLanguage createdAt")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const userIds = users.map((u) => u._id);
    const projectStats = await Project.aggregate([
      { $match: { owner: { $in: userIds } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$owner", count: { $sum: 1 }, recent: { $push: "$title" } } },
      { $project: { count: 1, recent: { $slice: ["$recent", 5] } } },
    ]);
    const statsByOwner = Object.fromEntries(projectStats.map((s) => [String(s._id), { projectCount: s.count, recentProjects: Array.isArray(s.recent) ? s.recent : [] }]));
    const withProjects = users.map((u) => ({
      ...u,
      preferredLanguage: Array.isArray(u.preferredLanguage) ? u.preferredLanguage : (u.preferredLanguage ? [u.preferredLanguage] : []),
      projectCount: statsByOwner[String(u._id)]?.projectCount ?? 0,
      recentProjects: statsByOwner[String(u._id)]?.recentProjects ?? [],
    }));
    res.json(withProjects);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** GET /api/friends/profile/:userId - public profile of a user */
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select("fullName email profileImage xp rating collegeName degreeName preferredLanguage github linkedin createdAt")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** GET /api/friends/check/:userId - are we friends / pending? */
export const checkFriendStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const otherId = req.params.userId;
    const rel = await FriendRequest.findOne({
      $or: [
        { from: userId, to: otherId },
        { from: otherId, to: userId },
      ],
    }).lean();
    res.json({ status: rel?.status || null, friends: rel?.status === "accepted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** POST /api/friends/project-invite - invite a user to collaborate on your project */
export const sendProjectInvite = async (req, res) => {
  try {
    const userId = req.user._id;
    const { projectId, toUserId } = req.body;
    if (!projectId || !toUserId) return res.status(400).json({ message: "projectId and toUserId required" });
    const project = await Project.findById(projectId).lean();
    if (!project || String(project.owner) !== String(userId)) return res.status(403).json({ message: "Not your project" });
    await Notification.create({
      user: toUserId,
      type: "project_invite",
      fromUser: userId,
      ref: { projectId, projectTitle: project.title },
      text: `invited you to collaborate on project "${project.title}"`,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
