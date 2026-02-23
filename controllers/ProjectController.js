import Project from '../models/projectModel.js';
import { addXP } from '../services/GamificationService.js';

// Create Project
export const createProject = async (req, res) => {
    try {
        const { title, description, domain, techStack, collaborationType } = req.body;
        const files = req.files;
        const ownerId = req.user?._id;
        if (!ownerId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const newProject = await Project.create({
            title,
            description,
            domain,
            techStack,
            collaborationType,
            owner: ownerId,
            members: [{ user: ownerId, role: 'Core Member' }],
            zipFiles: {
                frontend: files && files.frontend ? files.frontend[0].path : null,
                backend: files && files.backend ? files.backend[0].path : null,
                envFile: files && files.envFile ? files.envFile[0].path : null,
                dbFile: files && files.dbFile ? files.dbFile[0].path : null
            }
        });

        // Award XP
        await addXP(ownerId, 'CREATE_PROJECT');

        res.status(201).json({ success: true, message: 'Project created', project: newProject });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};


export const getProjectById = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate("owner", "name email") // optional
            .populate("members.user", "name email") // optional
            .lean();

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const userId = req.user?._id?.toString?.() ?? req.user?.id?.toString?.();
        const likes = project.likes || [];
        res.json({
            ...project,
            likesCount: likes.length,
            likedByMe: !!userId && likes.some(id => (id && id.toString()) === userId)
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Get All Projects
export const getAllProjects = async (req, res) => {
    try {
        const projects = await Project.find().populate('owner', 'fullName email').sort({ createdAt: -1 }).lean();
        const userId = req.user?._id?.toString?.() ?? req.user?.id?.toString?.();
        const withLikes = projects.map(p => ({
            ...p,
            likesCount: (p.likes && p.likes.length) || 0,
            likedByMe: !!userId && p.likes && p.likes.some(id => (id && id.toString()) === userId)
        }));
        res.json({ success: true, projects: withLikes });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Like / unlike project (toggle)
export const likeProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user?._id ?? req.user?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

        if (!Array.isArray(project.likes)) project.likes = [];
        const idStr = userId.toString();
        const likes = project.likes || [];
        const idx = likes.findIndex(id => (id && id.toString()) === idStr);
        if (idx >= 0) {
            project.likes.splice(idx, 1);
        } else {
            project.likes.push(userId);
        }
        await project.save();

        res.json({
            success: true,
            likesCount: project.likes.length,
            likedByMe: project.likes.some(id => (id && id.toString()) === idStr)
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
export const getMyProjects = async (req, res) => {
    try {
        const userId = req.user?._id ?? req.params.id;

        const myProjects = await Project.find({
            $or: [
                { owner: userId },
                { 'members.user': userId }
            ]
        }).populate('owner', 'fullName').lean();

        const uidStr = userId?.toString?.();
        const withLikes = myProjects.map(p => ({
            ...p,
            likesCount: (p.likes && p.likes.length) || 0,
            likedByMe: !!uidStr && p.likes && p.likes.some(id => (id && id.toString()) === uidStr)
        }));

        res.json({ success: true, projects: withLikes });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Request Access to a Project
export const requestAccess = async (req, res) => {
    try {
        const { projectId, message } = req.body;
        const userId = req.user._id;

        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ success: false, message: "Project not found" });

        const alreadyRequested = project.accessRequests.some(req => req.user.toString() === userId.toString());
        if (alreadyRequested)
            return res.status(400).json({ success: false, message: "Already requested" });

        project.accessRequests.push({ user: userId, message });
        await project.save();

        res.json({ success: true, message: "Access requested" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Approve / Reject Access Request
// export const handleAccessRequest = async (req, res) => {
//     try {
//         const { projectId, requestId, status, role } = req.body; // status = Approved / Rejected
//         const project = await Project.findById(projectId);
//         if (!project) return res.status(404).json({ success: false, message: "Project not found" });

//         const request = project.accessRequests.id(requestId);
// Delete Project (owner only)
// In deleteProject controller
export const deleteProject = async (req, res) => {
    try {
        const { userId, projectId } = req.params;
//         if (!request) return res.status(404).json({ success: false, message: "Request not found" });

//         request.status = status;

//         if (status === 'Approved') {
//             project.members.push({
//                 user: request.user,
//                 role: role || 'Contributor'
//             });
//         }

//         await project.save();
//         res.json({ success: true, message: `Request ${status.toLowerCase()}` });
//     } catch (err) {
//         res.status(500).json({ success: false, message: err.message });
//     }
// };


        // Check if project exists and user is owner
        const project = await Project.findOne({ _id: projectId });

        if (!project) {
            return res.status(404).json({ success: false, message: "Project not found." });
        }

        if (project.owner.toString() !== userId) {
            return res.status(403).json({ success: false, message: "You are not authorized to delete this project." });
        }

        // Delete project
        await Project.deleteOne({ _id: projectId });

        res.status(200).json({
            success: true,
            message: `Project with ID ${req.params.projectId} deleted successfully`,
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
