import passport from "passport"
import express from "express"
import { googleAuth, LoginUser, sendOTP, SignUpUser, verifyOTP } from "../controllers/AuthController.js"
import { requireAuth, validateLogin, validateRegister } from "../middleware/AuthMiddleware.js"
import rateLimit from "express-rate-limit"
import "../config/passport.js"

const router = express.Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many attempts, try again later" },
  standardHeaders: true,
  legacyHeaders: false,
})

router.post('/signup', authLimiter, validateRegister, SignUpUser)
router.post('/login', authLimiter, validateLogin, LoginUser)
router.post('/send-otp', authLimiter, sendOTP)
router.post('/verify-otp', authLimiter, verifyOTP)

// Google
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));
router.get('/google/callback', passport.authenticate('google', { session: false }), googleAuth);

export default router