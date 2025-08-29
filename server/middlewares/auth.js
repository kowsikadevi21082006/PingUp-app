export const protect = async (req, res, next) => {
    try {
        const authData = await req.auth();
        console.log('Auth middleware - auth data:', authData);
        
        const {userId} = authData;
        if(!userId){
            console.log('Auth middleware - no userId found');
            return res.json({success: false, message: "Not Authenticated"})
        }
        
        console.log('Auth middleware - userId:', userId);
        next()
    } catch (error) {
        console.log('Auth middleware - error:', error);
        res.json({success: false, message: error.message})
    }
}