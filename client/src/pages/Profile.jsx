import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Loading from '../components/Loading'
import UserProfileInfo from '../components/UserProfileInfo'
import PostCard from '../components/PostCard'
import moment from 'moment'
import ProfileModal from '../components/ProfileModal'
import { useAuth } from '@clerk/clerk-react'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'

const Profile = () => {

  const currentUser = useSelector((state) => state.user.value)

  const {getToken} = useAuth()
  const {profileId} = useParams()
  const [user, setUser] = useState(null)
  const [posts, setPosts] = useState([])
  const [activeTab, setActiveTab] = useState('posts')
  const [showEdit, setShowEdit] = useState(false)
  const [error, setError] = useState(null)

  console.log('currentUser._id', currentUser?._id)

  const fetchUser = async (profileId) => {
    const token = await getToken()
    try {
      console.log('Fetching profile for ID:', profileId);
      setError(null)
      const { data } = await api.get(`/api/user/profiles/${profileId}`, {
        headers: {Authorization: `Bearer ${token}`}
      });
      console.log('Profile response:', data);
      if (data.success) {
        setUser(data.profile)
        setPosts(data.posts)
      } else {
        setError(data.message || 'Profile not found')
        toast.error(data.message || 'Profile not found')
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load profile'
      setError(errorMessage)
      toast.error(errorMessage)
    }
  }

  const createTestUser = async (profileId) => {
    const token = await getToken()
    try {
      console.log('Creating test user for ID:', profileId);
      const { data } = await api.post('/api/user/create-test', {
        userId: profileId,
        email: '',
        full_name: 'Test User',
        username: profileId
      }, {
        headers: {Authorization: `Bearer ${token}`}
      });
      console.log('Create test user response:', data);
      if (data.success) {
        toast.success('User created successfully')
        // Try to fetch the profile again
        fetchUser(profileId)
      } else {
        toast.error(data.message || 'Failed to create user')
      }
    } catch (error) {
      console.error('Error creating test user:', error);
      toast.error('Failed to create user')
    }
  }

  useEffect(() => {
    console.log('Profile useEffect - profileId:', profileId, 'currentUser:', currentUser?._id);
    if (profileId) {
      fetchUser(profileId)
    } else if (currentUser?._id) {
      fetchUser(currentUser._id)
    }
  },[profileId, currentUser])

  // Show loading if currentUser is not loaded yet and no profileId is provided
  if (!profileId && !currentUser?._id) {
    return <Loading />
  }

  // Show error state
  if (error) {
    return (
      <div className='relative h-full overflow-y-scroll bg-gray-50 p-6'>
        <div className='max-w-3xl mx-auto'>
          <div className='bg-white rounded-2xl shadow p-8 text-center'>
            <h2 className='text-2xl font-bold text-gray-800 mb-4'>Profile Not Found</h2>
            <p className='text-gray-600 mb-6'>{error}</p>
            <div className='space-y-4'>
              <button 
                onClick={() => window.history.back()} 
                className='bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors mr-4'
              >
                Go Back
              </button>
              <button 
                onClick={() => {
                  console.log('Creating test user for profileId:', profileId);
                  // Try to create the user manually
                  if (profileId) {
                    createTestUser(profileId);
                  }
                }} 
                className='bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors'
              >
                Try to Create Profile
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return user ? (
    <div className='relative h-full overflow-y-scroll bg-gray-50 p-6'>
      <div className='max-w-3xl mx-auto'>
        {/* profile card */}
        <div className='bg-white rounded-2xl shadow overflow-hidden'>
          {/* Cover Photo */}
          <div className='h-40 md:h-56 bg-gradient-to-r from-indigo-200
          via-purple-200 to-pink-200'>
            {user.cover_photo && <img src={user.cover_photo} alt='' className='w-full h-full object-cover'/>}
          </div>
          {/* User Info */}
          <UserProfileInfo user={user} posts={posts} profileId={profileId} setShowEdit={setShowEdit} />
        </div>
        {/* tabs */}
        <div className='mt-6'>
          <div className='bg-white rounded-xl shadow p-1 flex max-w-md mx-auto'>
            {["posts", "media", "likes"].map((tab)=>(
              <button onClick={()=> setActiveTab(tab)} key={tab} className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                cursor-pointer ${activeTab === tab ? "bg-indigo-600 text-white" : "text-gray-600 hover:text-gray-900" }`}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
            ))}
          </div>
          {/* posts */}
          {activeTab === 'posts' && (
            <div className='mt-6 flex flex-col items-center gap-6'>
              {posts.length > 0 ? (
                posts.map((post)=> <PostCard key={post._id} post={post}/>)
              ) : (
                <div className='text-center text-gray-500 py-8'>
                  <p>No posts yet</p>
                </div>
              )}
            </div>
          )}
          {/* Media */}
          {activeTab === 'media' && (
            <div className='flex flex-wrap mt-6 max-w-6xl'>
              {posts.filter((post)=>post.image_urls && post.image_urls.length > 0).length > 0 ? (
                posts.filter((post)=>post.image_urls && post.image_urls.length > 0).map((post)=> (
                  <>
                  {post.image_urls.map((image, index)=>(
                    <Link target='_blank' to={image} key={index} className='relative group'>
                      <img src={image} key={index} className='w-64 aspect-video object-cover' alt="" />
                      <p className='absolute bottom-0 right-0 text-xs p-1 px-3 backdrop-blur-xl
                      text-white opacity-0 group-hover:opacity-100
                      transition duration-300'>Posted {moment(post.createdAt).fromNow()}</p>
                    </Link>
                  ))}
                  </>
                ))
              ) : (
                <div className='text-center text-gray-500 py-8 w-full'>
                  <p>No media posts yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Edit profile modal */}
      {showEdit && <ProfileModal setShowEdit={setShowEdit} />}
    </div>
  ) : (<Loading />)
}

export default Profile
