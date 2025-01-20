import express from "express"
import { signup, login, profile, updateProfile, getPosts, createPost, updatePost, deletePost, upvotePost, addComment, getComments, deleteComment, getReports, createReport, companion, companions, verifyEmail, confirmEmail, sendPasswordResetEmail, resetPassword, questions, uploadProfilePicture, getProfilePicture} from "../controllers/All.js"
import { authenticateToken } from "../config/middlewares.js"

const router = express.Router()

router.post("/signup", signup)
router.post("/login", login)
router.get("/profile", authenticateToken, profile)
router.put("/profile", authenticateToken, updateProfile)

router.get('/posts', getPosts)
router.post('/posts', authenticateToken, createPost);
router.put('/posts/:id', authenticateToken, updatePost);
router.delete('/posts/:id', authenticateToken, deletePost);
router.post('/posts/:id/upvote', authenticateToken, upvotePost);
router.post('/posts/:id/comments', authenticateToken, addComment);
router.get('/posts/:id/comments', getComments);
router.delete('/posts/:postId/comments/:commentId', authenticateToken, deleteComment);


router.get('/reports', authenticateToken, getReports);
router.post('/reports', authenticateToken, createReport);

router.post('/companion',authenticateToken,companion)
router.get('/companions',companions)

router.post('/verify-email', authenticateToken, verifyEmail);
router.get('/confirm-email', confirmEmail )
router.post('/reset-password', sendPasswordResetEmail)
router.post('/confirm-reset-password', resetPassword)

router.get('/questions',authenticateToken, questions)

router.post('/upload-profile-picture', authenticateToken, uploadProfilePicture);
router.get('/profile-picture', authenticateToken, getProfilePicture);

export default router