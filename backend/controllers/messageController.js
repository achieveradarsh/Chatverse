const Message = require("../models/messageModel")
const User = require("../models/userModel")
const Chat = require("../models/chatModel")

// @desc    Send a new message
// @route   POST /api/messages
// @access  Private
const sendMessage = async (req, res) => {
  const { content, chatId } = req.body

  if (!content || !chatId) {
    return res.status(400).json({ message: "Invalid data passed into request" })
  }

  try {
    // Check if chat exists
    const chat = await Chat.findById(chatId)
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" })
    }

    // Check if user is part of the chat
    if (!chat.users.includes(req.user._id)) {
      return res.status(403).json({ message: "You are not part of this chat" })
    }

    // Create new message
    let message = await Message.create({
      sender: req.user._id,
      content: content,
      chat: chatId,
      deliveredTo: [req.user._id], // Mark as delivered to sender
    })

    // Populate message with sender info
    message = await message.populate("sender", "name avatar")
    message = await message.populate("chat")
    message = await User.populate(message, {
      path: "chat.users",
      select: "name email avatar",
    })

    // Update latest message in chat
    await Chat.findByIdAndUpdate(chatId, { latestMessage: message })

    res.status(201).json(message)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
}

// @desc    Get all messages for a chat
// @route   GET /api/messages/:chatId
// @access  Private
const getMessages = async (req, res) => {
  const { chatId } = req.params
  const { page = 1, limit = 20 } = req.query

  try {
    // Check if chat exists
    const chat = await Chat.findById(chatId)
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" })
    }

    // Check if user is part of the chat
    if (!chat.users.includes(req.user._id)) {
      return res.status(403).json({ message: "You are not part of this chat" })
    }

    // Calculate pagination
    const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)

    // Get messages with pagination
    const messages = await Message.find({ chat: chatId })
      .populate("sender", "name avatar")
      .populate("readBy", "name avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number.parseInt(limit))

    // Get total count for pagination info
    const totalMessages = await Message.countDocuments({ chat: chatId })

    // Mark messages as read by current user
    await Message.updateMany(
      {
        chat: chatId,
        readBy: { $ne: req.user._id },
        sender: { $ne: req.user._id },
      },
      { $addToSet: { readBy: req.user._id } },
    )

    // Mark messages as delivered to current user
    await Message.updateMany(
      {
        chat: chatId,
        deliveredTo: { $ne: req.user._id },
      },
      { $addToSet: { deliveredTo: req.user._id } },
    )

    res.status(200).json({
      messages: messages.reverse(), // Return in chronological order
      pagination: {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        totalPages: Math.ceil(totalMessages / Number.parseInt(limit)),
        totalMessages,
      },
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
}

module.exports = {
  sendMessage,
  getMessages,
}
