const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const deviceController = require("../controllers/deviceController");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/", requireAuth, asyncHandler(deviceController.list));

router.get('/list-optimized', requireAuth, deviceController.listOptimized);

router.patch("/:deviceId", requireAuth, asyncHandler(deviceController.assignDevice));

router.delete("/", requireAuth, deviceController.deleteAllDevices);

router.post('/heartbeat', deviceController.heartbeat);

module.exports = router;
