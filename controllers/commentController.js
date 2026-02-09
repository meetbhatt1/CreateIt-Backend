import Comment from "../models/Comment.js";
import { addXP } from "../services/GamificationService.js";

export const createComment = async (req, res) => {
    try {
        const { text, projectId, parentComment } = req.body;
        const author = req.user._id;

        if (!text || !projectId) {
            return res.status(400).json({ message: "Text and projectId are required" });
        }

        const newComment = new Comment({
            text,
            author,
            projectId,
            parentComment: parentComment || null,
        });

        await newComment.save();

        // Populate author for immediate UI update
        await newComment.populate("author", "fullName profileImage");

        // Award XP
        await addXP(author, 'POST_COMMENT');

        res.status(201).json(newComment);
    } catch (error) {
        res.status(500).json({ message: "Error creating comment", error: error.message });
    }
};

export const getCommentsByProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const comments = await Comment.find({ projectId })
            .populate("author", "fullName profileImage")
            .sort({ createdAt: -1 });

        res.status(200).json(comments);
    } catch (error) {
        res.status(500).json({ message: "Error fetching comments", error: error.message });
    }
};

export const deleteComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user._id;

        const comment = await Comment.findById(commentId);

        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }

        // Check if user is the author
        if (comment.author.toString() !== userId.toString()) {
            return res.status(403).json({ message: "Unauthorized to delete this comment" });
        }

        await Comment.findByIdAndDelete(commentId);

        // Also delete replies if any
        await Comment.deleteMany({ parentComment: commentId });

        res.status(200).json({ message: "Comment deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting comment", error: error.message });
    }
};
