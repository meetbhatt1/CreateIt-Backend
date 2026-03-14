import Notification from "../models/Notification.js";

/** GET /api/notifications - list for current user */
export const getNotifications = async (req, res) => {
  try {
    const list = await Notification.find({ user: req.user._id })
      .populate("fromUser", "fullName email profileImage")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      readAt: null,
    });
    res.json({ notifications: list, unreadCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** POST /api/notifications/:id/read */
export const markRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { readAt: new Date() }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** POST /api/notifications/read-all */
export const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, readAt: null },
      { readAt: new Date() }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
