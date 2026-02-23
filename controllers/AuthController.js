import User from '../models/userModel.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sendEmail from '../utils/sendEmail.js';


export const SignUpUser = async (req, res) => {
    try {
        const { fullName, email, phone, password, dob, profileImage, collegeName, degreeName, currentSemester, preferredLanguage, pastProjects, purpose, github, linkedin } = req.body;

        // Check if user already exists!!!!!
        const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
        if (existingUser) {
            return res.status(400).json({ message: "😬 Whose email or phone are you trying?!" });
        }

        // Securing(Hashing) the password!!!!
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user!!!
        const newUser = new User({
            fullName,
            email,
            phone,
            password: hashedPassword,
            dob,
            profileImage,
            collegeName,
            degreeName,
            currentSemester,
            preferredLanguage,
            pastProjects,
            purpose,
            github,
            linkedin
        });

        // Save the user to DB!!
        await newUser.save();

        // Responding..!
        res.status(201).json({ message: "🎉 Registration successful! You’re in the CreateIt now!" });
        // Pending: Tokens
    } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).json({ message: "💥 Server blew up. Try again later." });
    }
};


export const LoginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check user's existstance!!!!
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                message: "🙈 “We looked everywhere... but couldn’t find that email!”"
            });
        }

        // Comparing password!!!
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                message: "🧟 “Wrong password. Even your shadow knew it wasn’t right.”"
            });
        }

        // 3. JWT TOKEN
        const token = jwt.sign(
            { _id: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(200).json({
            message: "🛸 “Login successful! Beam us up, dev!”",
            token,
            user: {
                fullName: user.fullName,
                email: user.email,
                _id: user._id
            }
        });
        // Pending: Tokens
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "😵 “Our server is doing cartwheels right now...”" });
    }
};

// Add to AuthController.js
export const sendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP

        await User.findOneAndUpdate(
            { email },
            { otp, otpExpiry: Date.now() + 15 * 60 * 1000 } // 15 mins expiry
        );

        await sendEmail({
            to: email,
            subject: 'Your CreateIt Verification Code🤫\n Verify before 15 minutes',
            text: `Your OTP is ${otp}`
        });

        res.status(200).json({ message: "OTP sent to email" });
    } catch (error) {
        console.error("sendOTP error:", error);
        res.status(500).json({ message: "Failed to send OTP" });
    }
};

export const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });

        if (!user || user.otp !== otp || user.otpExpiry < Date.now()) {
            return res.status(400).json({ message: "Invalid/expired OTP" });
        }

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();

        const token = jwt.sign(
            { _id: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(200).json({
            message: "Email verified successfully!",
            token,
            user: {
                _id: user._id,
                fullName: user.fullName,
                email: user.email
            }
        });
    } catch (error) {
        console.error("verifyOTP error:", error);
        res.status(500).json({ message: "Verification failed" });
    }
};

export const googleAuth = async (req, res) => {
    let user = await User.findOne({ email: req.user.email });

    if (!user) {
        // Create new user for Google auth
        user = await User.create({
            email: req.user.email,
            fullName: req.user.displayName,
            profileImage: req.user.photos[0].value,
            isGoogleAuth: true,
            isVerified: true // Google users auto-verified
        });
    }

    const token = jwt.sign(
            { _id: req.user._id, id: req.user._id, email: req.user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
    );
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/oauth-success?token=${token}`);
}