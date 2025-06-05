const User = require("../models/userModel")
const Chat = require("../models/chatModel")
const Message = require("../models/messageModel")

const setupSocketHandlers = (io) => {
  // Store active users and rooms
  const activeUsers = new Map()
  const roomUsers = new Map() // Track users in each room

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

    // ===== NEW: ROOM-BASED MESSAGING FOR INVITE CODES =====

    // Handle joining room with invite code
    socket.on("join_room", (data) => {
      const { roomId, userName } = data
      console.log(`User ${socket.user._id} (${userName}) joining room: ${roomId}`)

      // Join the socket room
      socket.join(roomId)

      // Track users in room
      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Set())
      }
      roomUsers.get(roomId).add({
        userId: socket.user._id.toString(),
        userName: userName,
        socketId: socket.id,
      })

      // Notify others in room about new user
      socket.to(roomId).emit("user_joined_room", {
        roomId,
        userId: socket.user._id,
        userName: userName,
        message: `${userName} joined the chat`,
      })

      // Send confirmation to user
      socket.emit("room_joined", {
        roomId,
        success: true,
        message: `Joined room ${roomId}`,
        roomUsers: Array.from(roomUsers.get(roomId) || []),
      })

      console.log(`Room ${roomId} now has ${roomUsers.get(roomId)?.size || 0} users`)
    })

    // Handle sending message to room
    socket.on("send_message_to_room", (data) => {
      const { roomId, message, userName, timestamp } = data
      console.log(`Message in room ${roomId} from ${userName}: ${message}`)

      const messageData = {
        id: Date.now().toString(),
        roomId,
        message,
        userName,
        userId: socket.user._id,
        timestamp: timestamp || new Date().toISOString(),
        type: "user",
      }

      // Send to all users in the room (including sender for confirmation)
      io.to(roomId).emit("room_message_received", messageData)

      console.log(`Message broadcasted to room ${roomId}`)
    })

    // Handle typing in room
    socket.on("room_typing", (data) => {
      const { roomId, userName, isTyping } = data

      // Send typing indicator to others in room (not sender)
      socket.to(roomId).emit("room_typing_update", {
        roomId,
        userName,
        userId: socket.user._id,
        isTyping,
      })
    })

    // Handle leaving room
    socket.on("leave_room", (data) => {
      const { roomId, userName } = data
      console.log(`User ${userName} leaving room: ${roomId}`)

      socket.leave(roomId)

      // Remove user from room tracking
      if (roomUsers.has(roomId)) {
        const users = roomUsers.get(roomId)
        users.forEach((user) => {
          if (user.userId === socket.user._id.toString()) {
            users.delete(user)
          }
        })

        // Notify others in room
        socket.to(roomId).emit("user_left_room", {
          roomId,
          userId: socket.user._id,
          userName: userName,
          message: `${userName} left the chat`,
        })
      }
    })

    // ===== EXISTING CHAT FUNCTIONALITY =====

    // Handle joining chat rooms (existing functionality)
    socket.on("join chat", (chatId) => {
      socket.join(chatId)
      console.log(`User ${socket.user._id} joined chat: ${chatId}`)
    })

    // Handle leaving chat rooms (existing functionality)
    socket.on("leave chat", (chatId) => {
      socket.leave(chatId)
      console.log(`User ${socket.user._id} left chat: ${chatId}`)
    })

    // Handle new message (existing functionality)
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

    // Handle typing indicator (existing functionality)
    socket.on("typing", (chatId) => {
      socket.to(chatId).emit("typing", {
        chatId,
        userId: socket.user._id,
      })
    })

    // Handle stop typing (existing functionality)
    socket.on("stop typing", (chatId) => {
      socket.to(chatId).emit("stop typing", {
        chatId,
        userId: socket.user._id,
      })
    })

    // Handle message delivery status (existing functionality)
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

    // Handle message read status (existing functionality)
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

      // Remove user from all rooms
      roomUsers.forEach((users, roomId) => {
        users.forEach((user) => {
          if (user.socketId === socket.id) {
            users.delete(user)
            // Notify room about user leaving
            socket.to(roomId).emit("user_left_room", {
              roomId,
              userId: socket.user._id,
              userName: user.userName,
              message: `${user.userName} disconnected`,
            })
          }
        })
      })

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
