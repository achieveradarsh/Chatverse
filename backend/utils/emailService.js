const nodemailer = require("nodemailer")

const sendEmail = async (to, subject, html) => {
  try {
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
    }

    await transporter.sendMail(mailOptions)
    return { success: true }
  } catch (error) {
    console.error("Email sending failed:", error)
    return { success: false, error: error.message }
  }
}

const sendOTPEmail = async (email, otp) => {
  const subject = "Your ChatVerse Login OTP"
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4f46e5;">ChatVerse Login OTP</h2>
      <p>Your one-time password for ChatVerse login is:</p>
      <h1 style="font-size: 32px; letter-spacing: 5px; background-color: #f3f4f6; padding: 10px; text-align: center; font-family: monospace;">${otp}</h1>
      <p>This OTP will expire in 5 minutes.</p>
      <p>If you didn't request this OTP, please ignore this email.</p>
      <p>Thank you,<br>ChatVerse Team</p>
    </div>
  `

  return await sendEmail(email, subject, html)
}

module.exports = {
  sendEmail,
  sendOTPEmail,
}
