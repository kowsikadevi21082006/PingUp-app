import imagekit from "../configs/imageKit.js"
import { inngest } from "../inngest/index.js"
import Connection from "../models/Connection.js"
import Post from "../models/Post.js"
import User from "../models/User.js"
import fs from'fs'


//Get user data using userId
export const getUserData = async (req, res) => {
    try {
        const authData = req.auth();
        console.log('getUserData - auth data:', authData);
        
        const {userId} = authData;
        console.log('getUserData - userId:', userId);
        
        let user = await User.findById(userId)
        console.log('getUserData - existing user:', user ? 'Yes' : 'No');
        
        if(!user){
            // Auto-create a minimal user; detailed sync can fill fields later
            const userData = {
                _id: userId,
                email: authData?.email || '',
                full_name: authData?.full_name || '',
                username: authData?.username || '',
                bio: 'Hey there! I am using PingUp.',
                profile_picture: '',
                cover_photo: '',
                location: '',
                followers: [],
                following: [],
                connections: []
            };
            console.log('Creating new user with data:', userData);
            user = await User.findByIdAndUpdate(userId, userData, { upsert: true, new: true })
            console.log('New user created:', user._id);
        }
        res.json({success: true, user})
    } catch (error) {
        console.log('Error in getUserData:', error);
        res.json({success:false, message: error.message})
    }
}

//Update user data
export const updateUserData = async (req, res) => {
    try {
        const {userId} = req.auth()
        let {username, bio, location, full_name} = req.body;

        const tempUser = await User.findById(userId)

        !username && (username = tempUser.username)

        if(tempUser.username !== username){
            const user = await User.findOne({username})
            if(user){
                //we will not change the username if it is already taken
                username = tempUser.username
            }
        }

        const updatedData = {
            username, bio, location, full_name
        }

        const profile = req.files.profile && req.files.profile[0]
        const cover = req.files.cover && req.files.cover[0]

        if(profile){
            const buffer = fs.readFileSync(profile.path)
            const response = await imagekit.upload({
                file: buffer,
                fileName: profile.originalname,
            })

            const url = imagekit.url({
                path: response.filePath,
                transformation: [
                    {quality: 'auto'},
                    {format: 'webp'},
                    {width: '512'}
                ]
            })
            updatedData.profile_picture = url;
        }

        if(cover){
            const buffer = fs.readFileSync(cover.path)
            const response = await imagekit.upload({
                file: buffer,
                fileName: cover.originalname,
            })

            const url = imagekit.url({
                path: response.filePath,
                transformation: [
                    {quality: 'auto'},
                    {format: 'webp'},
                    {width: '1280'}
                ]
            })
            updatedData.cover_photo = url;
        }

        const user = await User.findByIdAndUpdate(userId, updatedData, {new: true})

        res.json({success: true, user, message: 'Profile Updated Successfully'})

    } catch (error) {
        console.log(error);
        res.json({success:false, message: error.message})
    }
}

//find users using name email location nname
export const discoverUsers = async (req, res) => {
    try {
        const {userId} = req.auth()
        const {input} = req.body;

        const allUsers = await User.find(
            {
                $or: [
                    {username: new RegExp(input, 'i')},
                    {email: new RegExp(input, 'i')},
                    {full_name: new RegExp(input, 'i')},
                    {location: new RegExp(input, 'i')},
                ]
            }
        )
        const filteredUsers = allUsers.filter(user=> user._id !== userId);

        res.json({success: true, users: filteredUsers})

    } catch (error) {
        console.log(error);
        res.json({success:false, message: error.message})
    }
}

//follow user
export const followUser = async (req, res) => {
    try {
        const {userId} = req.auth()
        const {id} = req.body;

        const user = await User.findById(userId)

        if(user.following.includes(id)){
            return res.json({success: false, message: 'You are already following this user'})
        }

        user.following.push(id);
        await user.save()

        const toUser = await User.findById(id)
        toUser.followers.push(userId)
        await toUser.save()

        res.json({success: true, message: 'Now you are following this user'})


    } catch (error) {
        console.log(error);
        res.json({success:false, message: error.message})
    }
}

//unfollow User
export const unfollowUser = async (req, res) => {
    try {
        const {userId} = req.auth()
        const {id} = req.body;

        const user = await User.findById(userId)
        user.following = user.following.filter(user => user !== id);
        await user.save()

        const toUser = await User.findById(id)
        toUser.followers = toUser.followers.filter(user=> user !== userId);
        await toUser.save()

        res.json({success: true, message: 'You are no longer following this user'})


    } catch (error) {
        console.log(error);
        res.json({success:false, message: error.message})
    }
}

//Send connection request
export const sendConnectionRequest = async (req, res) => {
    try {
        const {userId} = req.auth()
        const { id } = req.body;

        //check if user has sent more than 20 connection request in the last 24 hours
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const connectionRequests = await Connection.find({from_user_id: userId,
            createdAt: { $gt: last24Hours}})
        if(connectionRequests.length >= 20){
            return res.json({success: false, message: 'You have sent more than 20 connection requests in the last 24 hours'})
        }

        //check if users are always connected
        const connection = await Connection.findOne({
            $or: [
                {from_user_id: userId, to_user_id: id},
                {from_user_id: id, to_user_id: userId},
            ]
        })

        if (!connection) {
            const newConnection = await Connection.create({
                from_user_id: userId,
                to_user_id: id
            })

            await inngest.send({
                name: 'app/connection-request',
                data: {connectionId: newConnection._id}
            })


            return res.json({success: true, message: 'Connection request sent successfully'})
        }else if(connection && connection.status === 'accepted'){
            return res.json({success: false, message: 'You are already connected with this user'})
        }
        return res.json({success: false, message: 'Connection requests pending'})

    } catch (error) {
        console.log(error);
        res.json({success:false, message: error.message})
    }
}

//get User Connections
export const getUserConnections = async (req, res) => {
    try {
        const {userId} = req.auth()
        const user = await User.findById(userId).populate('connections followers following')

        const connections = user.connections
        const followers = user.followers
        const following = user.following

        const pendingConnections = (await Connection.find({to_user_id: userId,
        status: 'pending'}).populate('from_user_id')).map(connection=>connection.from_user_id)

        res.json({success: true, connections, followers, following, pendingConnections})

    } catch (error) {
        console.log(error);
        res.json({success:false, message: error.message})
    }
}

//Accept connection request
export const acceptConnectionRequest = async (req, res) => {
    try {
        const {userId} = req.auth()
        const {id} = req.body;

        const connection = await Connection.findOne({from_user_id: id, to_user_id: userId})

        if (!connection) {
            return res.json({success: false, message: 'Connection not found'});
        }

        const user = await User.findById(userId);
        user.connections.push(id);
        await user.save()

        const toUser = await User.findById(id);
        toUser.connections.push(userId);
        await toUser.save()

        connection.status = 'accepted';
        await connection.save()

        res.json({success: true, message: 'Connection accepted successfully'});

    } catch (error) {
        console.log(error);
        res.json({success:false, message: error.message})
    }
}


// Test endpoint to list all users
export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({});
        console.log('All users:', users.map(u => ({ _id: u._id, full_name: u.full_name, username: u.username })));
        res.json({ success: true, users: users.map(u => ({ _id: u._id, full_name: u.full_name, username: u.username })) });
    } catch (error) {
        console.log('Error in getAllUsers:', error);
        res.json({ success: false, message: error.message });
    }
};

// Test endpoint to create a user
export const createTestUser = async (req, res) => {
    try {
        const { userId, email, full_name, username } = req.body;
        console.log('Creating test user:', { userId, email, full_name, username });
        
        const user = await User.findByIdAndUpdate(userId, {
            _id: userId,
            email: email || '',
            full_name: full_name || 'Test User',
            username: username || userId,
            bio: 'Hey there! I am using PingUp.',
            profile_picture: '',
            cover_photo: '',
            location: '',
            followers: [],
            following: [],
            connections: []
        }, { upsert: true, new: true });
        
        console.log('Created test user:', user._id);
        res.json({ success: true, user });
    } catch (error) {
        console.log('Error in createTestUser:', error);
        res.json({ success: false, message: error.message });
    }
};

// get user profiles
export const getUserProfiles = async (req, res) => {
    try {
        const { profileId } = req.params;
        const cleanedId = String(profileId || '').trim();
        console.log('getUserProfiles param:', profileId, 'cleaned:', cleanedId, 'len:', cleanedId.length);

        // Since we're using Clerk user IDs as _id (String type), we can directly use findById
        let profile = await User.findById(cleanedId);
        console.log('Profile found by ID:', profile ? 'Yes' : 'No');
        
        // If not found by ID, try to find by username
        if (!profile) {
            profile = await User.findOne({ username: cleanedId });
            console.log('Profile found by username:', profile ? 'Yes' : 'No');
        }

        if (!profile) {
            console.log('No profile found for:', cleanedId);
            // Let's also check if this is the current user trying to access their own profile
            const authData = req.auth();
            console.log('Full auth data:', JSON.stringify(authData, null, 2));
            const { userId } = authData;
            console.log('Current user ID from auth:', userId);
            
            if (userId === cleanedId) {
                console.log('User trying to access their own profile, creating user...');
                // Create the user if they don't exist
                profile = await User.findByIdAndUpdate(userId, {
                    _id: userId,
                    email: authData?.email || '',
                    full_name: authData?.full_name || '',
                    username: authData?.username || '',
                    bio: 'Hey there! I am using PingUp.',
                    profile_picture: '',
                    cover_photo: '',
                    location: '',
                    followers: [],
                    following: [],
                    connections: []
                }, { upsert: true, new: true });
                console.log('Created user profile:', profile._id);
            } else {
                // For other users, we need to create a basic profile if they don't exist
                // This happens when someone tries to view a profile that hasn't been created yet
                console.log('Creating basic profile for user:', cleanedId);
                profile = await User.findByIdAndUpdate(cleanedId, {
                    _id: cleanedId,
                    email: '',
                    full_name: 'User',
                    username: cleanedId,
                    bio: 'Hey there! I am using PingUp.',
                    profile_picture: '',
                    cover_photo: '',
                    location: '',
                    followers: [],
                    following: [],
                    connections: []
                }, { upsert: true, new: true });
                console.log('Created basic profile for user:', profile._id);
            }
        }

        console.log('Found profile:', profile._id, profile.full_name);
        const posts = await Post.find({ user: profile._id }).populate('user');
        console.log('Found posts count:', posts.length);
        
        res.json({ success: true, profile, posts });
    } catch (error) {
        console.log('Error in getUserProfiles:', error);
        res.json({ success: false, message: error.message });
    }
};