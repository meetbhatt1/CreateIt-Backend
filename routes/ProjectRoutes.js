import express from 'express';
import {
    createProject,
    getAllProjects,
    getMyProjects,
    getProjectById,
    deleteProject,
    likeProject,
    getProjectsByOwner
} from '../controllers/ProjectController.js';
import { auth, optionalAuth } from '../middleware/AuthMiddleware.js';
import { validateObjectId } from '../middleware/validateObjectId.js';
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Make sure this folder exists
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
    fileFilter: function (req, file, cb) {
        // Allow .zip for zip fields, images for screenshots
        if (file.fieldname === 'screenshots') {
            // Accept images only
            if (!file.mimetype.startsWith('image/')) {
                return cb(new Error('Only image files are allowed for screenshots!'));
            }
        } else if (file.fieldname === 'readme') {
            const ext = path.extname(file.originalname).toLowerCase();
            if (ext !== '.md' && ext !== '.txt') {
                return cb(new Error('Readme must be .md or .txt'));
            }
        } else {
            if (path.extname(file.originalname) !== '.zip') {
                return cb(new Error('Only .zip files are allowed for zip fields!'));
            }
        }
        cb(null, true);
    }
});

const router = express.Router();

router.post('/create', auth, upload.fields([
    { name: 'frontend', maxCount: 1 },
    { name: 'backend', maxCount: 1 },
    { name: 'readme', maxCount: 1 },
    { name: 'envFile', maxCount: 1 },
    { name: 'dbFile', maxCount: 1 },
    { name: 'screenshots', maxCount: 10 }
]), createProject);
router.get('/all', optionalAuth, getAllProjects);
router.get('/by-owner/:userId', auth, validateObjectId('userId'), getProjectsByOwner);
router.get('/my-projects/:id', auth, validateObjectId('id'), getMyProjects);
router.get('/:id', optionalAuth, validateObjectId('id'), getProjectById);
router.post('/:projectId/like', auth, validateObjectId('projectId'), likeProject);
router.delete('/:userId/:projectId', auth, validateObjectId(['userId', 'projectId']), deleteProject);

export default router;
