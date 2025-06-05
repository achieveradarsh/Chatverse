const jwt = require("jsonwebtoken")
const User = require("../models/userModel")
const { verifyToken } = require("../utils/jwtUtils")

const protect = async (req, res, next) => {
  let token

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1]

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET)

      // Get user from the token
      req.user = await User.findById(decoded.id).select("-password")

      next()
    } catch (error) {
      console.error(error)
      res.status(401).json({ message: "Not authorized, token failed" })
    }
  }

  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" })
  }
}

const authenticateSocket = async (socket, next) => {
  const token = socket.handshake.auth.token

  if (!token) {
    return next(new Error("Authentication error: Token not provided"))
  }

  const { valid, id, error } = verifyToken(token)

  if (!valid) {
    return next(new Error(`Authentication error: ${error}`))
  }

  try {
    const user = await User.findById(id)

    if (!user) {
      return next(new Error("Authentication error: User not found"))
    }

    socket.user = user
    next()
  } catch (error) {
    return next(new Error(`Authentication error: ${error.message}`))
  }
}

module.exports = { protect, authenticateSocket }
