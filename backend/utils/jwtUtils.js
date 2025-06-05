const jwt = require("jsonwebtoken")

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  })
}

const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    return { valid: true, id: decoded.id }
  } catch (error) {
    return { valid: false, error: error.message }
  }
}

module.exports = {
  generateToken,
  verifyToken,
}
