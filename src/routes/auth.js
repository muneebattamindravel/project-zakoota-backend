const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const authController = require("../controllers/authController");

const router = express.Router();

router.post("/login", asyncHandler(authController.login));

module.exports = router;
