import User from "../models/userModel.js";
import { XP_CONFIG, LEVEL_THRESHOLD } from "../config/gamification.js";

export const addXP = async (userId, actionType) => {
    try {
        const xpAmount = XP_CONFIG[actionType];

        if (!xpAmount) {
            console.warn(`No XP configured for action: ${actionType}`);
            return;
        }

        const user = await User.findById(userId);
        if (!user) return;

        // Current Level
        const oldLevel = Math.floor(user.xp / LEVEL_THRESHOLD) + 1;

        // Update XP
        user.xp = (user.xp || 0) + xpAmount;

        // New Level
        const newLevel = Math.floor(user.xp / LEVEL_THRESHOLD) + 1;

        await user.save();

        if (newLevel > oldLevel) {
            console.log(`🎉 User ${user.fullName} leveled up to ${newLevel}!`);
            // Future: Send socket notification for level up
        }

        return { newXP: user.xp, newLevel, leveledUp: newLevel > oldLevel };

    } catch (error) {
        console.error("Error adding XP:", error);
    }
};
