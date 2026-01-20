import express from "express";
import cors from "cors"
import cookieParser from "cookie-parser";

const app= express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials:true
}))

//json data store JSON body middleware 1)To read req.body 2)Protect server from very large payloads
app.use(express.json({limit:"16kb"}))

//url data store  URL encoded middleware Used when: Form data , URL encoded data
app.use(express.urlencoded({extended:true, limit:"16kb"}))

//Static files Used to: serve images,serve files
app.use(express.static("public"))

//To read cookies easily
app.use(cookieParser())

//routes import
import userRouter from './routes/user.routes.js'

//routes declaration-- prefix
app.use("/api/v1/user",userRouter)

// http://localhost:8000/users/register


export {app}