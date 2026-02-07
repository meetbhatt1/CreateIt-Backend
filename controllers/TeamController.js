import User from '../models/userModel.js';
import Team from '../models/Team.js';
import Invite from '../models/Invite.js';
import JoinRequest from '../models/JoinRequests.js';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { formatDistanceToNow } from 'date-fns';

// Helper function to generate token
const generateToken = () => crypto.randomBytes(32).toString('hex');

export const createTeam = async (req, res) => {
    try {
        const { title, description, visibility, members } = req.body;
        const ownerId = req.user._id; // From authenticated user
        console.log("Authenticated User ID:", ownerId); // Should match token's _id

        // Validate input
        if (!title || !description || visibility === undefined || !members || !members.length) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Prepare members array
        const membersData = [{
            user: ownerId,
            role: members[0].role,
            languages: members[0].languages,
            status: 'accepted'
        }];

        // Process additional members
        const invites = [];
        for (let i = 1; i < members.length; i++) {
            const member = members[i];

            if (member.userId) {
                // Convert string ID to ObjectId
                const userId = new mongoose.Types.ObjectId(member.userId);

                // Check if user exists
                const user = await User.findById(userId);
                if (!user) {
                    return res.status(404).json({ message: `User not found for ID: ${member.userId}` });
                }

                membersData.push({
                    user: userId,  // Use ObjectId here
                    role: member.role,
                    languages: member.languages,
                    status: 'pending'
                });

                invites.push({
                    team: null,
                    userId: userId,  // Add userId to invite
                    email: user.email,
                    role: member.role,
                    languages: member.languages,
                    token: generateToken()
                });
            } else {
                membersData.push({
                    user: null,
                    role: member.role,
                    languages: member.languages,
                    status: 'pending'
                });
            }
        }

        // Create team
        const team = await Team.create({
            title,
            description,
            visibility,
            owner: ownerId,
            members: membersData
        });

        // Create invites for existing users
        for (const inviteData of invites) {
            inviteData.team = team._id;
            inviteData.sender = ownerId;
            await Invite.create(inviteData);
        }

        res.status(201).json({ message: "Team Created Successfully", team });
    } catch (error) {
        console.error("Team creation error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const getTeamsByUser = async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.params.id);

        const teams = await Team.aggregate([
            {
                $match: {
                    $or: [
                        { owner: userId },
                        { "members.user": userId }
                    ]
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "owner"
                }
            },
            {
                $unwind: "$owner"
            },
            {
                $lookup: {
                    from: "users",
                    localField: "members.user",
                    foreignField: "_id",
                    as: "memberDetails"
                }
            },
            {
                $project: {
                    title: 1,
                    description: 1,
                    visibility: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    members: 1,
                    "owner._id": 1,
                    "owner.username": 1,
                    "owner.email": 1,
                    memberDetails: {
                        $map: {
                            input: "$memberDetails",
                            as: "member",
                            in: {
                                _id: "$$member._id",
                                username: "$$member.username",
                                email: "$$member.email"
                            }
                        }
                    }
                }
            },
            {
                $sort: {
                    createdAt: -1
                }
            }
        ]);

        res.status(200).json(teams);
    } catch (error) {
        console.error("Error in getTeamsByUser (aggregate):", error);
        res.status(500).json({ message: "Server error", error });
    }
};

// Request to join a team
export const requestToJoinTeam = async (req, res) => {
    try {
        const teamId = req.params.teamId;
        const userId = req.user._id;
        const { role } = req.body;

        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        // Check if user is already a member
        const isMember = team.members.some(
            m => m.user && m.user.toString() === userId.toString()
        );

        if (isMember) {
            return res.status(400).json({ message: 'You are already a member of this team' });
        }

        // Check if slot exists
        const slotExists = team.members.some(
            m => !m.user && m.role === role
        );

        if (!slotExists) {
            return res.status(400).json({ message: 'No available slots for this role' });
        }

        // Create join request
        const joinRequest = new JoinRequest({
            team: teamId,
            user: userId,
            role,
            status: 'pending'
        });

        await joinRequest.save();
        res.status(201).json({ message: "Join request sent successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get join requests for teams I own
export const getJoinRequests = async (req, res) => {
    try {
        const userId = req.user._id;

        // Find teams where I'm the owner
        const teams = await Team.find({ owner: userId }).select('_id');
        const teamIds = teams.map(t => t._id);

        const requests = await JoinRequest.find({
            team: { $in: teamIds }
        })
            .populate('user', 'username email')
            .populate('team', 'title');

        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const respondToJoinRequest = async (req, res) => {
    try {
        const requestId = req.params.requestId;
        const { accepted } = req.body;
        const userId = req.user._id;

        const request = await JoinRequest.findById(requestId)
            .populate('team');

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Verify current user is team owner
        const team = await Team.findById(request.team._id);
        if (team.owner.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        if (accepted) {
            // Add user to team
            const slotIndex = team.members.findIndex(
                m => !m.user && m.role === request.role
            );

            if (slotIndex !== -1) {
                team.members[slotIndex].user = request.user;
                team.members[slotIndex].status = 'accepted';
            } else {
                // Add as new member
                team.members.push({
                    user: request.user,
                    role: request.role,
                    status: 'accepted'
                });
            }

            await team.save();
        }

        // Update request status
        request.status = accepted ? 'accepted' : 'rejected';
        await request.save();

        res.json({ status: request.status });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getPublicTeams = async (req, res) => {
    try {
        const userId = req?.user?._id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        // Get all teams the user is already a member of
        const userTeams = await Team.find({
            "members.user": userId
        }).select("_id");

        const userTeamIds = userTeams.map(team => team._id);

        const teams = await Team.find({
            _id: { $nin: userTeamIds },
            visibility: true,
            "members": {
                $elemMatch: {
                    user: null,
                }
            }
        })
            .populate("owner", "username")
        res.json(teams);
    } catch (error) {
        console.error("getPublicTeams Error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const getTeamDetails = async (req, res) => {
    try {
        const team = await Team.findById(req.params.teamId)
            .populate('owner', 'username email')
            .populate('members.user', 'username email');

        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        res.json(team);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const inviteUser = async (req, res) => {
    try {
        const { userId, role, languages, sender } = req.body;
        const teamId = req.params.teamId;
        console.log("PARAMETER Team ID: ", teamId);

        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        if (team.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only team owner can invite users' });
        }

        // ✅ Prevent inviting the owner
        if (userId.toString() === team.owner.toString()) {
            return res.status(400).json({ message: "You cannot invite yourself (the team owner)." });
        }

        // ✅ Prevent duplicate pending invitations
        const existingInvite = await Invite.findOne({
            team: teamId,
            userId,
            status: 'pending'
        });

        if (existingInvite) {
            return res.status(400).json({ message: "An invitation is already pending for this user." });
        }

        const token = generateToken();
        const invite = await Invite.create({
            team: teamId,
            userId,
            role,
            languages,
            sender,
            token
        });

        // TODO: Send email with invite link
        res.json({ inviteToken: token });
    } catch (error) {
        console.error("INVITE ERROR:", error);
        res.status(500).json({ message: "Something went wrong while inviting the user." });
    }
};

export const respondToInvite = async (req, res) => {
    try {
        const { accepted } = req.body;
        const inviteId = req.params.inviteId;
        const userId = req.user._id;

        const invite = await Invite.findById(inviteId);
        if (!invite) {
            return res.status(404).json({ message: 'Invite not found' });
        }

        // Verify the invite belongs to the current user
        if (invite.userId.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const team = await Team.findById(invite.team);
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        if (accepted) {
            // Add user to team members
            const isAlreadyMember = team.members.some(m =>
                m.user && m.user.toString() === userId.toString()
            );

            if (!isAlreadyMember) {
                team.members.push({
                    user: userId,
                    role: invite.role,
                    languages: invite.languages,
                    status: 'accepted'
                });
                await team.save();
            }
        }

        // Update invite status
        invite.status = accepted ? 'accepted' : 'rejected';
        await invite.save();

        res.json({ status: invite.status });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getUserInvitations = async (req, res) => {
    try {
        console.log("GETUSERINVITATIONS+++++++++++++++++++");
        const userId = new mongoose.Types.ObjectId(req?.params?.userId)
        console.log("USER ID:", userId);
        const pending = await Invite.find({
            userId,
            status: 'pending'
        })
            .populate('team', 'title') // Use 'title' instead of 'name'
            .populate('sender', 'fullName'); // Populate sender

        console.log("PENDING:", pending);

        // Remove Notification references
        const history = await Invite.find({
            userId,
            status: { $in: ['accepted', 'rejected'] }
        })
            .sort({ updatedAt: -1 })
            .limit(10)
            .populate('team', 'title')
            .populate('sender', 'fullName');
        console.log("HISTORY:", history);

        res.json({
            pending: pending.map(invite => ({
                _id: invite._id,
                teamId: invite.team?._id ?? null,
                teamName: invite.team?.title ?? "Unknown Team",
                senderName: invite.sender?.fullName ?? "Unknown Sender",
                role: invite.role,
                message: `Join ${invite.team?.title ?? "Unknown Team"} as ${invite.role}`,
                createdAt: invite.createdAt
            })),
            history: history.map(invite => ({
                _id: invite._id,
                teamName: invite.team?.title ?? "Unknown Team",
                status: invite.status === 'accepted' ? 'Approved' : 'Rejected',
                timestamp: formatDistanceToNow(invite.updatedAt, { addSuffix: true })
            }))
        });


    } catch (error) {
        res.status(500).json({ message: error });
    }
};

export const acceptInvite = async (req, res) => {
    try {
        const { token } = req.params;
        const userId = req.user._id;

        const invite = await Invite.findOne({ token });
        if (!invite) {
            return res.status(404).json({ message: 'Invalid or expired invite token' });
        }

        const team = await Team.findById(invite.team);
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        // Update member status
        const memberIndex = team.members.findIndex(
            m => !m.user && m.role === invite.role
        );

        if (memberIndex !== -1) {
            team.members[memberIndex].user = userId;
            team.members[memberIndex].status = 'accepted';
        } else {
            // Add as new member if slot not found
            team.members.push({
                user: userId,
                role: invite.role,
                languages: invite.languages,
                status: 'accepted'
            });
        }

        await team.save();
        await invite.deleteOne();

        res.json({ success: true, team });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const joinPublicTeam = async (req, res) => {
    try {
        const teamId = req.params.teamId;
        const userId = req.user._id;
        const { role } = req.body; // Get role from request body

        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        if (!team.visibility) {
            return res.status(403).json({ message: 'This team is private' });
        }

        // Check if user is already a member
        const isMember = team.members.some(
            m => m.user && m.user.toString() === userId.toString()
        );

        if (isMember) {
            return res.status(400).json({ message: 'You are already a member of this team' });
        }

        // Find an open slot matching the requested role
        const openSlotIndex = team.members.findIndex(
            m => !m.user && m.role === role
        );

        if (openSlotIndex === -1) {
            return res.status(400).json({
                message: 'No available slots for this role or role does not exist'
            });
        }

        // Assign user to the slot
        team.members[openSlotIndex].user = userId;
        team.members[openSlotIndex].status = 'accepted';

        await team.save();
        res.json({ success: true, team });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};