// Simulated Redis cache for OTPs
const otpCache = new Map()

// Generate a random 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Store OTP in the simulated cache with expiration
const storeOTP = (email, otp) => {
  // OTP expires in 5 minutes (300000 ms)
  const expiresAt = Date.now() + 300000

  otpCache.set(email, {
    otp,
    expiresAt,
  })

  // Set timeout to automatically remove expired OTPs
  setTimeout(() => {
    if (otpCache.has(email) && otpCache.get(email).expiresAt <= Date.now()) {
      otpCache.delete(email)
    }
  }, 300000)
}

// Verify OTP from the simulated cache
const verifyOTP = (email, otp) => {
  if (!otpCache.has(email)) {
    return { valid: false, message: "OTP expired or not found" }
  }

  const storedData = otpCache.get(email)

  if (storedData.expiresAt <= Date.now()) {
    otpCache.delete(email)
    return { valid: false, message: "OTP expired" }
  }

  if (storedData.otp !== otp) {
    return { valid: false, message: "Invalid OTP" }
  }

  // Remove OTP after successful verification
  otpCache.delete(email)
  return { valid: true, message: "OTP verified successfully" }
}

module.exports = {
  generateOTP,
  storeOTP,
  verifyOTP,
}
