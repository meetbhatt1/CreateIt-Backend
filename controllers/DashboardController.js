import Project from "../models/projectModel.js";
import Task from "../models/TaskModel.js";
import Comment from "../models/Comment.js";
import User from "../models/userModel.js";

export const getDashboardStats = async (req, res) => {
    try {
        const userId = req.user._id;

        // Fetch counts
        const projectCount = await Project.countDocuments({
            $or: [
                { owner: userId },
                { 'members.user': userId }
            ]
        });

        const taskCount = await Task.countDocuments({ createdBy: userId });
        const solvedIssuesCount = await Task.countDocuments({ createdBy: userId, status: 'done' });

        // Get user data for XP and Rating
        const user = await User.findById(userId).select('xp rating fullName profileImage');

        res.status(200).json({
            projectCount,
            taskCount,
            solvedIssuesCount,
            xp: user?.xp || 0,
            rating: user?.rating || 0,
            fullName: user?.fullName,
            profileImage: user?.profileImage,
            // Placeholder for features not yet fully modeled
            interviewsCount: 0,
            profileViews: 120
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching dashboard stats", error: error.message });
    }
};

export const getActivityFeed = async (req, res) => {
    try {
        const userId = req.user._id;

        // Get recent projects
        const recentProjects = await Project.find({ owner: userId })
            .sort({ createdAt: -1 })
            .limit(3);

        // Get recent tasks
        const recentTasks = await Task.find({ createdBy: userId })
            .sort({ updatedAt: -1 })
            .limit(3);

        // Get recent comments on user's projects
        const myProjectIds = await Project.find({ owner: userId }).distinct('_id');
        const recentComments = await Comment.find({ projectId: { $in: myProjectIds } })
            .populate('author', 'fullName')
            .sort({ createdAt: -1 })
            .limit(3);

        // Format into common feed structure
        const feed = [
            ...recentProjects.map(p => ({
                id: p._id,
                type: 'project',
                text: `You created project '${p.title}'`,
                time: p.createdAt
            })),
            ...recentTasks.map(t => ({
                id: t._id,
                type: 'task',
                text: `You updated task '${t.title}' to ${t.status}`,
                time: t.updatedAt
            })),
            ...recentComments.map(c => ({
                id: c._id,
                type: 'comment',
                text: `${c.author?.fullName || 'Someone'} commented on your project`,
                time: c.createdAt
            }))
        ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5);

        res.status(200).json(feed);
    } catch (error) {
        res.status(500).json({ message: "Error fetching activity feed", error: error.message });
    }
};
