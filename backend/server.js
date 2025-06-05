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
app.use(
  cors({
    origin: ["http://localhost:3000", "https://chatverse.vercel.app", "https://chatverse-frontend.vercel.app"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
)

app.use(express.json())

// Health check route
app.get("/", (req, res) => {
  res.json({
    message: "ChatVerse Backend is running!",
    timestamp: new Date().toISOString(),
    status: "healthy",
  })
})

// API Routes
app.use("/api/auth", authRoutes)
app.use("/api/chats", chatRoutes)
app.use("/api/messages", messageRoutes)

// Create HTTP server
const server = http.createServer(app)

// Initialize Socket.IO with proper CORS
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://chatverse.vercel.app", "https://chatverse-frontend.vercel.app"],
    methods: ["GET", "POST"],
    credentials: true,
    allowEIO3: true,
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Socket.IO middleware for authentication (optional for room-based chat)
io.use((socket, next) => {
  // Try to authenticate, but don't fail if no token
  const token = socket.handshake.auth.token

  if (token) {
    // Use existing auth middleware
    authenticateSocket(socket, (err) => {
      if (err) {
        console.log("Socket auth failed, continuing without auth:", err.message)
        // Continue without authentication for anonymous users
        socket.user = null
      }
      next()
    })
  } else {
    // No token provided, continue as anonymous user
    socket.user = null
    next()
  }
})

// Set up Socket.IO event handlers
setupSocketHandlers(io)

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error:", err)
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
  })
})

// Start server
const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`🚀 ChatVerse Backend running on port ${PORT}`)
  console.log(`📡 Socket.IO server ready for connections`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`)
})

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully")
  server.close(() => {
    console.log("Process terminated")
  })
})
