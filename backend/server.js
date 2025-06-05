const express = require("express")
const dotenv = require("dotenv")
const cors = require("cors")
const http = require("http")
const { Server } = require("socket.io")
const connectDB = require("./config/db")
const authRoutes = require("./routes/authRoutes")
const chatRoutes = require("./routes/chatRoutes")
const messageRoutes = require("./routes/messageRoutes")
const { authenticateSocket } = require("./middleware/authMiddleware")
const { setupSocketHandlers } = require("./utils/socketHandlers")

// Load environment variables
dotenv.config()

// Connect to MongoDB
connectDB()

// Initialize Express app
const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/chats", chatRoutes)
app.use("/api/messages", messageRoutes)

// Create HTTP server
const server = http.createServer(app)

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === "production" ? "https://chatverse.vercel.app" : "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
})

// Socket.IO middleware for authentication
io.use(authenticateSocket)

// Set up Socket.IO event handlers
setupSocketHandlers(io)

// Start server
const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
