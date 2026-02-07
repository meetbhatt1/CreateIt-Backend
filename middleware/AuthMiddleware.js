import Joi from "joi";
import User from '../models/userModel.js';
import jwt from 'jsonwebtoken';

// Adjusted Validation Schema
const registerValidation = Joi.object({
    fullName: Joi.string().min(3).required().messages({
        'string.empty': '😶 “Forgot to introduce yourself? Say your name!”',
        'string.min': '🧒 “Short names are cool, but 3+ letters, please!”',
    }),

    email: Joi.string().email().required().messages({
        'string.empty': '📩 “Email is a must — how else do we spam you?”',
        'string.email': '🧠 “That’s not an email. It’s a cry for help.”',
    }),

    phone: Joi.string().pattern(/^[6-9]\d{9}$/).required().messages({
        'string.pattern.base': '📞 Call me maybe? That number looks sus...',
        'string.empty': '📞 Phone number is required',
    }),

    password: Joi.string().min(6).required().messages({
        'string.empty': '🛑 “No password? You brave?”',
        'string.min': '🧠 Password should be at least 6 characters!',
    }),

    dob: Joi.date().required().messages({
        'date.base': '🎂 “Time traveler? Give us a real birthday.”',
        'any.required': '🎂 Birthday is required',
    }),

    profileImage: Joi.string().allow('').optional().messages({
        'string.base': '😶 “Pick a face. Any face.”',
    }),

    collegeName: Joi.string().allow('').optional().messages({
        'string.base': '🏫 “Even Hogwarts had a name.”',
    }),

    degreeName: Joi.string().allow('').optional().messages({
        'string.base': '🎓 “Tell us what you’re suffering through.”',
    }),

    currentSemester: Joi.number().optional().messages({
        'number.base': '📚 “Enter your sem — or are you eternally in the 3rd?”',
    }),

    preferredLanguage: Joi.array().items(Joi.string()).optional().messages({
        'array.base': '💬 “Languages should be a list — not just love for JS.”',
    }),

    pastProjects: Joi.array().items(Joi.string()).optional().messages({
        'array.base': '🧠 “Projects go in a list, not a sentence.”',
    }),

    purpose: Joi.string()
        .valid('contributor', 'mock-interview', 'opensource-consumer', 'other')
        .optional(),

    github: Joi.string().uri().allow('').optional().messages({
        'string.uri': '🐙 GitHub should be a valid link!',
    }),

    linkedin: Joi.string().uri().allow('').optional().messages({
        'string.uri': '🔗 LinkedIn should be a valid link!',
    }),
});

// Middleware
export const validateRegister = (req, res, next) => {
    const { error } = registerValidation.validate(req.body, {
        abortEarly: false,
        allowUnknown: false, // ensures no unknown fields are passed
    });

    if (error) {
        const messages = error.details.map(err => err.message);
        return res.status(400).json({ errors: messages });
    }

    next();
};

// Login Validation
const loginValidation = Joi.object({
    email: Joi.string().email().required().messages({
        'string.empty': '📭 “No email? Then how will we haunt your inbox?”',
        'string.email': '📧 “That doesn’t look like a real email. Try again!”'
    }),
    password: Joi.string().min(6).required().messages({
        'string.empty': '🔒 “Password please! We’re not psychic.”',
        'string.min': '🤏 “A tiny password? Make it at least 6 chars.”'
    }),
});

// Login Middleware
export const validateLogin = (req, res, next) => {
    const { error } = loginValidation.validate(req.body, { abortEarly: false });
    if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        return res.status(400).json({ errors: errorMessages });
    }
    next();
};

// Google 
export const requireAuth = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ msg: "Unauthorized" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ msg: "Invalid Token" });
    }
};

export const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        console.log("Token :------------ ", token);
        if (!token) {
            return res.status(401).json({ message: 'Please authenticate' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Decoded Token: -=-=-=-=-=-=-=", decoded);
        const user = await User.findOne({ _id: decoded._id });
        console.log("User +++++++++++", user);
        req.token = token;
        req.user = user;
        console.log("Token:", token);
        console.log("Decoded:", jwt.verify(token, process.env.JWT_SECRET));
        console.log("User:", await User.findOne({ _id: decoded._id }));
        next();
    } catch (error) {
        res.status(404).json({ message: 'Error auth:', error });
    }
};