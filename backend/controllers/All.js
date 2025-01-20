import bcrypt from "bcrypt";
import User from "../models/userModel.js";
import jwt from "jsonwebtoken";
import Post from '../models/Post.js';
import Report from '../models/Report.js';
import Question from "../models/questionModel.js";
import ProfilePicture from "../models/profilePicture.js";
import nodemailer from 'nodemailer';
import multer from 'multer';
import path from 'path';




const storage = multer.diskStorage({
    
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Only images are allowed'), false);
        }
        cb(null, true);
    } });


export async function verifyEmail(req, res) {
    try {
        const token = jwt.sign({ id: req.user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        const url = `http://localhost:5000/confirm-email?token=${token}`;

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL,
                pass: process.env.EMAIL_PASS,
            },
        });
        const user = await User.findById(req.user.id);
        console.log("About to transport")
        await transporter.sendMail({
            to: user.email,
            subject: 'Verify Your Email',
            html: `<p>Click <a href="${url}">here</a> to verify your email.</p>`,
        });
        res.status(200).json({ message: 'Verification email sent.' });
    } catch (error) {
        console.error(error);
    }

};


export async function confirmEmail(req, res) {
    try {
        const { token } = req.query;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        await User.findByIdAndUpdate(decoded.id, { verified: true });
        res.redirect('http://localhost:5173/profile');
    } catch (error) {
        res.redirect('http://localhost:5173/login?error=invalid-token');
    }
};

export async function sendPasswordResetEmail(req, res) {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({ message: "User with this email does not exist" });
        }

        const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const resetUrl = `http://localhost:5173/reset-password?token=${resetToken}`;

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL,
                pass: process.env.EMAIL_PASS,
            },
        });

        await transporter.sendMail({
            to: user.email,
            subject: 'Reset Your SoulSpeak Password',
            html: `
                <h2>Password Reset Request</h2>
                <p>Click the link below to reset your password. This link will expire in 1 hour.</p>
                <a href="${resetUrl}">Reset Password</a>
                <p>If you didn't request this, please ignore this email.</p>
                <p>Best regards,<br>SoulSpeak Team</p>
            `,
        });

        res.status(200).json({ message: 'Password reset email sent successfully' });
    } catch (error) {
        console.error('Password reset email error:', error);
        res.status(500).json({ message: 'Error sending password reset email' });
    }
}
export async function resetPassword(req, res) {
    try {
        const { token } = req.body;
        const { password } = req.body;
        console.log(    token, password)
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        user.password = await bcrypt.hash(password, 10);
        await user.save();
        res.status(200).json({ message: "Password reset successfully" });
    }
    catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ message: 'Error resetting password' });
    }
}

export async function signup(request, response) {
    try {
        const body = await request.body;
        const {
            referral,
            mentalCondition,
            name,
            username,
            email,
            password,
            ageGroup,
            gender,
            country,
            goals,
            preferences
        } = body;
        const requiredFields = {
            referral,
            mentalCondition,
            name,
            username,
            email,
            password,
            ageGroup,
            gender,
            country,
            goals,
            preferences
        };
        const missingFields = Object.entries(requiredFields)
            .filter(([_, value]) => !value)
            .map(([key]) => key);

        if (missingFields.length > 0) {
            return response.status(400).json({
                message: `Missing required fields: ${missingFields.join(', ')}`
            });
        }
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            if (existingUser.email === email) {
                return response.status(400).json({
                    message: "Email already in use."
                });
            }
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            referral,
            mentalCondition,
            name,
            username,
            email,
            password: hashedPassword,
            ageGroup,
            gender,
            country,
            goals,
            preferences
        });
        await newUser.save();

        return response.status(201).json({
            message: "User registered successfully.",
            user: {
                username: newUser.username,
                email: newUser.email
            }
        });

    } catch (error) {
        console.error("Error during signup:", error);
        return response.status(500).json({
            message: "Internal server error."
        });
    }
}

export async function login(request, response) {
    try {
        const { email, password } = request.body;
        const user = await User.findOne({ email });
        if (!user) {
            return response.status(401).json({ message: "Invalid email or password." });
        }
        if (user.suspended) {
            return response.status(403).json({ message: "Your account has been suspended." });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return response.status(401).json({ message: "Invalid email or password." });
        }
        const token = jwt.sign(
            { id: user._id, email: user.email, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: "48h" }
        );

        return response.status(200).json({
            message: "Login successful.",
            token,
        });
    } catch (error) {
        console.error("Error during login:", error);
        return response.status(500).json({ message: "Internal server error." });
    }
}

export const profile = async (req, res) => {
    console.log("Received request to get profile");
    try {
        const user = await User.findById(req.user.id);
        console.log("User found:", user);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        res.json({ user });
    } catch (error) {
        res.status(500).json({ message: "Internal server error." });
    }
};


export const updateProfile = async (req, res) => {
    console.log("Received request to update profile");
    try {
        const { name, username, email, password, newPassword, referral,
            mentalCondition,
            ageGroup,
            country,
            goals,
            preferences } = req.body;
        const userId = req.user.id; // Get user ID from the token
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        const emailtaken = await User.findOne({ email })
        if (emailtaken && emailtaken._id != userId) {
            return res.status(400).json({ message: "Email already in use." });
        }
        if (newPassword != "") {
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ message: "Invalid current password." });
            }
            user.password = await bcrypt.hash(newPassword, 10);
        }
        var v = true
        if (user.email != email) v = false;

        const user_updated = await User.findByIdAndUpdate(userId, {
            name,
            username,
            email,
            referral,
            mentalCondition,
            ageGroup,
            country,
            goals,
            preferences,
            verified: v
        }, { new: true });


        await user_updated.save();
        console.log("User updated:", user_updated);
        res.status(200).json({ user: user_updated });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error." });
    }
};

export const uploadProfilePicture = async (req, res) => {
    try {
        const uploadResult = await new Promise((resolve, reject) => {
            upload.single('image')(req, res, (err) => {
                if (err) reject(err);
                resolve(req.file);
            });
        });

        if (!uploadResult) {
            return res.status(400).json({ message: 'No image file provided' });
        }

        const imageUrl = `/uploads/${uploadResult.filename}`;
        
        // Update user's profile picture
        const profilePic = await ProfilePicture.findOneAndUpdate(
            { user: req.user.id },
            { imageUrl: imageUrl },
            { upsert: true, new: true }
        );

        res.status(200).json({ 
            message: 'Profile picture updated successfully',
            imageUrl: imageUrl 
        });

    } catch (error) {
        console.error('Profile picture upload error:', error);
        res.status(500).json({ message: 'Error uploading profile picture' });
    }
};
export const getProfilePicture = async (req, res) => {
    try {
        const profilePic = await ProfilePicture.findOne({ user: req.user.id });
        
        if (!profilePic) {
            console.log('No profile picture found for user:', req.user.id);
            return res.status(200).json({ imageUrl: null });
        }

        res.status(200).json({ imageUrl: profilePic.imageUrl });
        
    } catch (error) {
        console.error('Error fetching profile picture:', error);
        res.status(500).json({ message: 'Error fetching profile picture' });
    }
};


export const createPost = async (req, res) => {
    console.log("Received request to create post");
    try {
        // Handle file upload
        const uploadResult = await new Promise((resolve, reject) => {
            upload.single('image')(req, res, (err) => {
                if (err) reject(err);
                resolve(req.file);
            });
        });

        // Validate required fields
        if (!req.body.content || !req.body.category) {
            return res.status(400).json({
                message: 'Content and category are required'
            });
        }

        // Create and save post
        const newPost = new Post({
            content: req.body.content,
            category: req.body.category,
            author: req.user.id,
            imageUrl: uploadResult ? `/uploads/${uploadResult.filename}` : null
        });

        await newPost.save();
        console.log('Post created:', newPost);
        return res.status(201).json(newPost);

    } catch (error) {
        console.error('Post creation error:', error);
        return res.status(error.status || 500).json({
            message: error.message || 'Error creating post'
        });
    }
};
export const updatePost = async (req, res) => {
    try {
        const uploadResult = await new Promise((resolve, reject) => {
            upload.single('image')(req, res, (err) => {
                if (err) reject(err);
                resolve(req.file);
            });
        });

        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        if (post.author.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to edit this post' });
        }

        post.content = req.body.content;
        
        // Handle image updates
        console.log(req.body.removeImage);
        if (uploadResult) {
            post.imageUrl = `/uploads/${uploadResult.filename}`;
        } else if (req.body.removeImage === 'true') {
            post.imageUrl = null;
        }
        console.log('Post updated:', post);

        await post.save();
        res.json(post);
    } catch (error) {
        res.status(500).json({ message: 'Error updating post' });
    }
};


export const getPosts = async (req, res) => {
    try {
        const { category } = req.query;
        const query = category && category !== 'all' ? { category } : {};

        const posts = await Post.find(query)
            .sort({ createdAt: -1 })
            .populate('author', 'username avatar');
        res.json(posts);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching posts' });
    }
};

export const deletePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        if (post.author.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to delete this post' });
        }

        await post.deleteOne();
        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting post' });
    }
};

export const upvotePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const upvoteIndex = post.upvotes.indexOf(req.user.id);
        if (upvoteIndex === -1) {
            post.upvotes.push(req.user.id);
        } else {
            post.upvotes.splice(upvoteIndex, 1);
        }
        await post.save();
        res.json(post);
    } catch (error) {
        res.status(500).json({ message: 'Error updating upvote' });
    }
};

export const addComment = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const comment = {
            user: req.user.id,
            content: req.body.content
        };
        post.comments.push(comment);
        await post.save();

        const populatedPost = await Post.findById(post._id)
            .populate('comments.user', 'username avatar _id');

        res.json(populatedPost);
    } catch (error) {
        res.status(500).json({ message: 'Error adding comment' });
    }
};

export const getComments = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate('comments.user', 'username avatar _id');
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }
        res.json(post.comments);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching comments' });
    }
};

export const deleteComment = async (req, res) => {
    console.log("Received request to delete a comment");
    try {
        const post = await Post.findById(req.params.postId);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const comment = post.comments.id(req.params.commentId);
        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        if (comment.user.toString() !== req.user.id) {
            console.log("Post not authorized to delete this comment");
            return res.status(403).json({ message: 'Not authorized to delete this comment' });
        }
        console.log("Comment found and authorized to delete");
        post.comments.pull({ _id: req.params.commentId });
        await post.save();
        console.log("Comment deleted successfully");

        const populatedPost = await Post.findById(post._id)
            .populate('comments.user', 'username avatar');

        res.json(populatedPost);
    } catch (error) {
        res.status(500).json({ message: 'Error deleting comment' });
    }
};


export const getReports = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (user.email == "admin@gmail.com") {
            const reports = await Report.find();
            return res.status(200).json(reports);
        }
        const reports = await Report.find({userEmail: user.email});

        res.status(200).json(reports);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createReport = async (req, res) => {
    console.log("Received request to create a report");
    try {
        const { userEmail, type, details } = req.body;
        const newReport = new Report({
            userEmail,
            type,
            details
        });
        console.log("New report created:", newReport);
        await newReport.save();
        res.status(201).json(newReport);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};


export const companion = async (req, res) => {
    console.log("Received request to update companion status");
    try {
        const id = req.user.id;
        await User.findByIdAndUpdate(id, {
            isCompanion: true
        })
        return res.status(200).json({ message: "Companion status updated successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Something went wrong" });
    }
};

export const companions = async (req, res) => {
    console.log("Received request to get companions");
    try {
        const companions = await User.find({ isCompanion: true });
        res.status(200).json(companions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Something went wrong" });
    }
};

export const questions = async (req, res) => {
    console.log("Received request to get questions");
    try {
        const questions = await Question.find();
        res.status(200).json(questions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Something went wrong" });
    }
};
