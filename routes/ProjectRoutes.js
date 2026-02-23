import express from 'express';
import {
    createProject,
    getAllProjects,
    getMyProjects,
    getProjectById,
    deleteProject
} from '../controllers/ProjectController.js';
import { auth } from '../middleware/AuthMiddleware.js';
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
    fileFilter: function (req, file, cb) {
        // Allow .zip for zip fields, images for screenshots
        if (file.fieldname === 'screenshots') {
            // Accept images only
            if (!file.mimetype.startsWith('image/')) {
                return cb(new Error('Only image files are allowed for screenshots!'));
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
    { name: 'envFile', maxCount: 1 },
    { name: 'dbFile', maxCount: 1 },
    { name: 'screenshots', maxCount: 10 }
]), createProject);
router.get('/all', getAllProjects);
router.get('/my-projects/:id', auth, getMyProjects);
router.get('/:id', getProjectById);
router.delete('/:userId/:projectId', auth, deleteProject);

export default router;
