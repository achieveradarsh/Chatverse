const User = require("../models/userModel")
const { generateOTP, storeOTP, verifyOTP } = require("../utils/otpUtils")
const { sendOTPEmail } = require("../utils/emailService")
const { generateToken } = require("../utils/jwtUtils")

// @desc    Request OTP for login
// @route   POST /api/auth/request-otp
// @access  Public
const requestOTP = async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ message: "Email is required" })
    }

    // Check if user exists, create if not
    let user = await User.findOne({ email })

    if (!user) {
      // Create new user with email
      user = await User.create({
        email,
        name: email.split("@")[0], // Default name from email
        isVerified: false,
      })
    }

    // Generate OTP
    const otp = generateOTP()

    // Store OTP in simulated Redis cache
    storeOTP(email, otp)

    // Send OTP via email
    const emailResult = await sendOTPEmail(email, otp)

    if (!emailResult.success) {
      return res.status(500).json({ message: "Failed to send OTP email" })
    }

    res.status(200).json({
      message: "OTP sent successfully",
      userId: user._id,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
}

// @desc    Verify OTP and login
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTPAndLogin = async (req, res) => {
  try {
    const { email, otp } = req.body

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" })
    }

    // Verify OTP
    const verification = verifyOTP(email, otp)

    if (!verification.valid) {
      return res.status(400).json({ message: verification.message })
    }

    // Find user
    const user = await User.findOne({ email })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Update user verification status
    user.isVerified = true
    await user.save()

    // Generate JWT token
    const token = generateToken(user._id)

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isVerified: user.isVerified,
      token,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
}

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    user.name = req.body.name || user.name
    user.avatar = req.body.avatar || user.avatar

    const updatedUser = await user.save()

    res.status(200).json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      avatar: updatedUser.avatar,
      isVerified: updatedUser.isVerified,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
}

module.exports = {
  requestOTP,
  verifyOTPAndLogin,
  updateProfile,
}
