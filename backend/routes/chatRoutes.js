const express = require("express")
const {
  accessChat,
  fetchChats,
  createGroupChat,
  renameGroup,
  addToGroup,
  removeFromGroup,
} = require("../controllers/chatController")
const { protect } = require("../middleware/authMiddleware")

const router = express.Router()

router.route("/").post(protect, accessChat).get(protect, fetchChats)
router.route("/group").post(protect, createGroupChat)
router.route("/group/:chatId").put(protect, renameGroup)
router.route("/group/:chatId/add").put(protect, addToGroup)
router.route("/group/:chatId/remove").put(protect, removeFromGroup)

module.exports = router
