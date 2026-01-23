import asyncHandler from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

// const generateAccessAndRefreshTokens = async (userId)=>{
//   console.log({
//   ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
//   REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
//   ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY,
//   REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY,
// });

//   try{
//     const user = await User.findById(userId)
//     const accessToken = user.generateAccessToken()
//     const refreshToken = user.generateRefreshToken()

//     user.refreshToken = refreshToken
//     await user.save({ validateBeforeSave :false})

//     return {accessToken,refreshToken}

//   } catch(error){
//     throw new ApiError(500,"Something went wrong while generating refresh and access token")
//   }
// }

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId)

    if (!user) {
      throw new ApiError(404, "User not found while generating tokens")
    }

    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    user.refreshToken = refreshToken
    await user.save({ validateBeforeSave: false })

    return { accessToken, refreshToken }

  } catch (error) {
    console.error("TOKEN ERROR 👉", error)
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token"
    )
  }
}


const registerUser = asyncHandler(async (req, res) => {
  // res.status(200).json({
  //     message: "Chai Aur Code"
  // })

  //get user details from frontend
  //validation - not empty
  //check if user already exists: username,email
  //check for images, check for avatar
  //upload them to cloudinary
  //create user object - create entry in db
  //remove password and refresh token field from response
  //check for user creation
  //return res

  const { fullName, email, username, password } = req.body;
  console.log("email: ", email);

  // if(fullName ===" "){
  //     throw new ApiError(400,"fullname is required")
  // }

  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required !!");
  }
  const normalizedUsername = username.toLowerCase();

  const existedUser = await User.findOne({
    $or: [{ username: normalizedUsername }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  const coverImage = coverImageLocalPath
    ? await uploadOnCloudinary(coverImageLocalPath)
    : null;

 if (!avatar?.url) {
  throw new ApiError(400, "Avatar upload failed");
}

 const user = await User.create({
  fullname: fullName,
  avatar: avatar.url,
  coverImage: coverImage?.url || "",
  email,
  password,
  username: normalizedUsername,
});


  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went Wrong while registering a user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Sucessfully"));
});

const loginUser= asyncHandler(async(req,res) =>{
  // req body -> data
  // username or email
  // find the user
  // password check 
  // access and referesh tokens
  // send cookie

  const {email,username,password} = req.body

  if(!(username || email)){
    throw new ApiError(400, "username or email is required")
  }

  // only for one find 
  // //User.findOne({username})

  const user =await User.findOne({
    $or :[{username},{email}]
  })
  console.log("LOGIN USER ID 👉", user?._id)


  if(!user){
    throw new ApiError(404,"User does not exists")
  }
  const isPasswordValid= await user.isPasswordCorrect(password)

  if(!isPasswordValid){
    throw new ApiError(404,"Invalid User credentials")
  }

  const{accessToken,refreshToken}= await generateAccessAndRefreshTokens(user._id)

  const loggedInUser = await User.findById(user._id).
  select("-password -refreshToken")


  const options ={
    httpOnly:true,
    secure: process.env.NODE_ENV === "production"
  }

  return res
  .status(200).
  cookie("accessToken",accessToken, options)
  .cookie("refreshToken",refreshToken,options)
  .json(
    new ApiResponse(
      200,
      {
        user: loggedInUser, accessToken, refreshToken
      },
      "User Logged in Successfully"
    )
  )

})

const logoutUser = asyncHandler(async(req,res) =>{
  await User.findByIdAndUpdate(
    req.user._id,{
      $set: {
        refreshToken : undefined
      }
    },
    {
      new: true
    }
  )

  const options ={
    httpOnly:true,
    secure: true
  }
  return res
  .status(200)
  .clearCookie("accessToken", options)
  .clearCookie("refreshToken", options)
  .json(new ApiResponse(200,{},"User logged Out"))
})

const refreshAccessToken = asyncHandler( async(req,res) =>{
  const incomingRefreshToken= req.cookies.
  refreshToken || req.body.refreshToken

  if(incomingRefreshToken){
    throw new ApiError(401,"unauthorized request")
  }

  try {
    const decodedToken =jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    )
  
    const user = await User.findById(decodedToken?._id)
  
    if(!user){
      throw new ApiError(401,"Invalid refresh token")
    }
    if(incomingRefreshToken !==user?.refreshToken){
      throw new ApiError(401,"Refresh token is expired or used")
    }
  
    const options ={
      httpOnly :true,
      secure: true
    }
    
    const {accessToken,newrefreshToken}= await generateAccessAndRefreshTokens(user._id)
    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",newrefreshTokenrefreshToken,options)
    .json(
      new ApiResponse(
        200,
        {accessToken, refreshToken : newrefreshToken},
        "Access token refreshed"
      )
    )
  } catch (error) {
    throw new ApiError(401, error?.message ||"Invalid refresh token")
  }
})

export { registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken
 };
