const User = require("../models/userModel")
const Chat = require("../models/chatModel")
const Message = require("../models/messageModel")

const setupSocketHandlers = (io) => {
  // Store active users
  const activeUsers = new Map()

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.user._id}`)

    // Add user to active users
    activeUsers.set(socket.user._id.toString(), socket.id)

    // Update user status to online
    User.findByIdAndUpdate(socket.user._id, { status: "online", lastSeen: Date.now() }, { new: true }).then((user) => {
      // Broadcast user online status to relevant users
      io.emit("user status", {
        userId: user._id,
        status: "online",
      })
    })

    // Join personal room for direct messages
    socket.join(socket.user._id.toString())

    // Handle joining chat rooms
    socket.on("join chat", (chatId) => {
      socket.join(chatId)
      console.log(`User ${socket.user._id} joined chat: ${chatId}`)
    })

    // Handle leaving chat rooms
    socket.on("leave chat", (chatId) => {
      socket.leave(chatId)
      console.log(`User ${socket.user._id} left chat: ${chatId}`)
    })

    // Handle new message
    socket.on("new message", async (messageData) => {
      try {
        const { chatId, content } = messageData

        // Check if chat exists
        const chat = await Chat.findById(chatId).populate("users")
        if (!chat) {
          return socket.emit("error", { message: "Chat not found" })
        }

        // Create new message
        const newMessage = await Message.create({
          sender: socket.user._id,
          content,
          chat: chatId,
          deliveredTo: [socket.user._id], // Mark as delivered to sender
        })

        // Populate message details
        const populatedMessage = await Message.findById(newMessage._id)
          .populate("sender", "name avatar")
          .populate("chat")

        // Update latest message in chat
        await Chat.findByIdAndUpdate(chatId, { latestMessage: newMessage._id })

        // Send message to all users in the chat
        io.to(chatId).emit("message received", populatedMessage)

        // Update chat list for all users in the chat
        chat.users.forEach((user) => {
          if (user._id.toString() !== socket.user._id.toString()) {
            io.to(user._id.toString()).emit("chat updated", {
              chatId,
              latestMessage: populatedMessage,
            })
          }
        })
      } catch (error) {
        console.error("Socket error:", error)
        socket.emit("error", { message: "Failed to send message" })
      }
    })

    // Handle typing indicator
    socket.on("typing", (chatId) => {
      socket.to(chatId).emit("typing", {
        chatId,
        userId: socket.user._id,
      })
    })

    // Handle stop typing
    socket.on("stop typing", (chatId) => {
      socket.to(chatId).emit("stop typing", {
        chatId,
        userId: socket.user._id,
      })
    })

    // Handle message delivery status
    socket.on("message delivered", async ({ messageId }) => {
      try {
        await Message.findByIdAndUpdate(messageId, { $addToSet: { deliveredTo: socket.user._id } }, { new: true })

        // Get the updated message
        const message = await Message.findById(messageId)

        // Notify sender about delivery
        if (message && message.sender.toString() !== socket.user._id.toString()) {
          const senderId = message.sender.toString()
          if (activeUsers.has(senderId)) {
            io.to(activeUsers.get(senderId)).emit("message status updated", {
              messageId,
              userId: socket.user._id,
              status: "delivered",
            })
          }
        }
      } catch (error) {
        console.error("Socket error:", error)
      }
    })

    // Handle message read status
    socket.on("message read", async ({ messageId }) => {
      try {
        await Message.findByIdAndUpdate(
          messageId,
          {
            $addToSet: {
              readBy: socket.user._id,
              deliveredTo: socket.user._id,
            },
          },
          { new: true },
        )

        // Get the updated message
        const message = await Message.findById(messageId)

        // Notify sender about read status
        if (message && message.sender.toString() !== socket.user._id.toString()) {
          const senderId = message.sender.toString()
          if (activeUsers.has(senderId)) {
            io.to(activeUsers.get(senderId)).emit("message status updated", {
              messageId,
              userId: socket.user._id,
              status: "read",
            })
          }
        }
      } catch (error) {
        console.error("Socket error:", error)
      }
    })

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.user._id}`)

      // Remove user from active users
      activeUsers.delete(socket.user._id.toString())

      // Update user status to offline
      User.findByIdAndUpdate(socket.user._id, { status: "offline", lastSeen: Date.now() }, { new: true }).then(
        (user) => {
          // Broadcast user offline status to relevant users
          io.emit("user status", {
            userId: user._id,
            status: "offline",
            lastSeen: user.lastSeen,
          })
        },
      )
    })
  })
}

module.exports = { setupSocketHandlers }
