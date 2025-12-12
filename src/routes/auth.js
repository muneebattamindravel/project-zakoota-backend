// routes/auth.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/authMiddleware");

// Public login route
router.post("/login", authController.login);

// Optional: authenticated "who am I"
router.get("/me", requireAuth, authController.me);

module.exports = router;
