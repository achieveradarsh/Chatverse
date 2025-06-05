const express = require("express")
const { requestOTP, verifyOTPAndLogin, updateProfile } = require("../controllers/authController")
const { protect } = require("../middleware/authMiddleware")

const router = express.Router()

router.post("/request-otp", requestOTP)
router.post("/verify-otp", verifyOTPAndLogin)
router.put("/profile", protect, updateProfile)

module.exports = router
