const Chat = require("../models/chatModel")
const User = require("../models/userModel")

// @desc    Create or access one-to-one chat
// @route   POST /api/chats
// @access  Private
const accessChat = async (req, res) => {
  const { userId } = req.body

  if (!userId) {
    return res.status(400).json({ message: "UserId param not sent with request" })
  }

  try {
    // Find if chat already exists between the two users
    let chat = await Chat.find({
      isGroupChat: false,
      $and: [{ users: { $elemMatch: { $eq: req.user._id } } }, { users: { $elemMatch: { $eq: userId } } }],
    })
      .populate("users", "-password")
      .populate("latestMessage")

    chat = await User.populate(chat, {
      path: "latestMessage.sender",
      select: "name email avatar",
    })

    if (chat.length > 0) {
      res.status(200).json(chat[0])
    } else {
      // Create a new chat
      const chatData = {
        chatName: "sender",
        isGroupChat: false,
        users: [req.user._id, userId],
      }

      const createdChat = await Chat.create(chatData)
      const fullChat = await Chat.findById(createdChat._id).populate("users", "-password")

      res.status(201).json(fullChat)
    }
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
}

// @desc    Get all chats for a user
// @route   GET /api/chats
// @access  Private
const fetchChats = async (req, res) => {
  try {
    let chats = await Chat.find({ users: { $elemMatch: { $eq: req.user._id } } })
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate("latestMessage")
      .sort({ updatedAt: -1 })

    chats = await User.populate(chats, {
      path: "latestMessage.sender",
      select: "name email avatar",
    })

    res.status(200).json(chats)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
}

// @desc    Create group chat
// @route   POST /api/chats/group
// @access  Private
const createGroupChat = async (req, res) => {
  if (!req.body.users || !req.body.name) {
    return res.status(400).json({ message: "Please fill all the fields" })
  }

  const users = req.body.users

  if (users.length < 2) {
    return res.status(400).json({ message: "More than 2 users are required to form a group chat" })
  }

  // Add current user to the group
  users.push(req.user._id)

  try {
    const groupChat = await Chat.create({
      chatName: req.body.name,
      isGroupChat: true,
      users: users,
      groupAdmin: req.user._id,
    })

    const fullGroupChat = await Chat.findById(groupChat._id)
      .populate("users", "-password")
      .populate("groupAdmin", "-password")

    res.status(201).json(fullGroupChat)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
}

// @desc    Rename group chat
// @route   PUT /api/chats/group/:chatId
// @access  Private
const renameGroup = async (req, res) => {
  const { chatId } = req.params
  const { chatName } = req.body

  try {
    const updatedChat = await Chat.findByIdAndUpdate(chatId, { chatName }, { new: true })
      .populate("users", "-password")
      .populate("groupAdmin", "-password")

    if (!updatedChat) {
      return res.status(404).json({ message: "Chat not found" })
    }

    res.status(200).json(updatedChat)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
}

// @desc    Add user to group
// @route   PUT /api/chats/group/:chatId/add
// @access  Private
const addToGroup = async (req, res) => {
  const { chatId } = req.params
  const { userId } = req.body

  try {
    const chat = await Chat.findById(chatId)

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" })
    }

    // Check if the requester is admin
    if (chat.groupAdmin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only admins can add users" })
    }

    const updatedChat = await Chat.findByIdAndUpdate(chatId, { $push: { users: userId } }, { new: true })
      .populate("users", "-password")
      .populate("groupAdmin", "-password")

    res.status(200).json(updatedChat)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
}

// @desc    Remove user from group
// @route   PUT /api/chats/group/:chatId/remove
// @access  Private
const removeFromGroup = async (req, res) => {
  const { chatId } = req.params
  const { userId } = req.body

  try {
    const chat = await Chat.findById(chatId)

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" })
    }

    // Check if the requester is admin
    if (chat.groupAdmin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only admins can remove users" })
    }

    const updatedChat = await Chat.findByIdAndUpdate(chatId, { $pull: { users: userId } }, { new: true })
      .populate("users", "-password")
      .populate("groupAdmin", "-password")

    res.status(200).json(updatedChat)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
}

module.exports = {
  accessChat,
  fetchChats,
  createGroupChat,
  renameGroup,
  addToGroup,
  removeFromGroup,
}
