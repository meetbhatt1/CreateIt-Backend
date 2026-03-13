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
    respondToJoinRequest,
    getExcalidraw,
    putExcalidraw
} from '../controllers/TeamController.js';
import { auth } from '../middleware/AuthMiddleware.js';
import { validateObjectId } from '../middleware/validateObjectId.js';

const router = express.Router();

router.post('/team', auth, createTeam);
router.get('/public', auth, getPublicTeams);
router.post('/:teamId/invite', auth, validateObjectId('teamId'), inviteUser);
router.post('/invite/accept/:token', auth, acceptInvite);
router.get('/:userId/invitations', auth, validateObjectId('userId'), getUserInvitations);
router.post('/invite/:inviteId/respond', auth, validateObjectId('inviteId'), respondToInvite);
router.post('/:teamId/request-join', auth, validateObjectId('teamId'), requestToJoinTeam);
router.get('/owner/requests', auth, getJoinRequests);
router.post('/request/:requestId/respond', auth, validateObjectId('requestId'), respondToJoinRequest);
router.post('/:teamId/join', auth, validateObjectId('teamId'), joinPublicTeam);
router.get('/user/:id', auth, validateObjectId('id'), getTeamsByUser);
router.get('/:teamId', auth, validateObjectId('teamId'), getTeamDetails);
router.get('/:teamId/excalidraw', auth, validateObjectId('teamId'), getExcalidraw);
router.put('/:teamId/excalidraw', auth, validateObjectId('teamId'), putExcalidraw);

export default router;