import express from 'express';
import {
    createTeam,
    getTeamDetails,
    inviteUser,
    acceptInvite,
    joinPublicTeam,
    getTeamsByUser,
    getUserInvitations,
    respondToInvite,
    getPublicTeams,
    requestToJoinTeam,
    getJoinRequests,
    respondToJoinRequest
} from '../controllers/TeamController.js';
import { auth } from '../middleware/AuthMiddleware.js';

const router = express.Router();

router.post('/team', auth, createTeam);
router.get('/public', auth, getPublicTeams);
router.post('/:teamId/invite', auth, inviteUser);
router.post('/invite/accept/:token', auth, acceptInvite);
router.get('/:userId/invitations', auth, getUserInvitations);
router.post('/invite/:inviteId/respond', auth, respondToInvite);
router.post('/:teamId/request-join', auth, requestToJoinTeam);
router.get('/owner/requests', auth, getJoinRequests);
router.post('/request/:requestId/respond', auth, respondToJoinRequest);
router.post('/:teamId/join', auth, joinPublicTeam);
router.get('/user/:id', auth, getTeamsByUser);
router.get('/:teamId', auth, getTeamDetails);

export default router;