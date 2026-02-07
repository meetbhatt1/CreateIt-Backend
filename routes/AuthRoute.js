import passport from "passport"
import express from "express"
import { googleAuth, LoginUser, sendOTP, SignUpUser, verifyOTP } from "../controllers/AuthController.js"
import { requireAuth, validateLogin, validateRegister } from "../middleware/AuthMiddleware.js"
import "../config/passport.js"

const router = express.Router()

router.post('/signup', validateRegister, SignUpUser)
router.post('/login', validateLogin, LoginUser)

// Google
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));
// Add these routes:
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);

// Modify Google callback to handle new users:
router.get('/google/callback', passport.authenticate('google', { session: false }), googleAuth);

export default router