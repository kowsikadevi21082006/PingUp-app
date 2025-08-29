import express from 'express';
import { acceptConnectionRequest, createTestUser, discoverUsers, followUser, getAllUsers, getUserConnections, getUserData, getUserProfiles, sendConnectionRequest, unfollowUser, updateUserData } from '../controllers/userController.js';
import { protect } from '../middlewares/auth.js';
import { upload } from '../configs/multer.js';
import { getUserRecentMessages } from '../controllers/messageController.js';

const userRouter = express.Router();

userRouter.get('/data', protect, getUserData)
userRouter.post('/update', upload.fields([{name: 'profile', maxCount: 1}, {name: 'cover', maxCount: 1}]) ,protect ,updateUserData)
userRouter.post('/discover', protect, discoverUsers)
userRouter.post('/follow', protect, followUser)
userRouter.post('/unfollow', protect, unfollowUser)
userRouter.post('/connect', protect, sendConnectionRequest)
userRouter.post('/accept', protect, acceptConnectionRequest)
userRouter.get('/connections', protect, getUserConnections)
userRouter.get('/profiles/:profileId',protect, getUserProfiles)
userRouter.get('/recent-messages', protect, getUserRecentMessages)
userRouter.get('/all', protect, getAllUsers)
userRouter.post('/create-test', protect, createTestUser)

export default userRouter