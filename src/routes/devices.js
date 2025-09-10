const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const deviceController = require("../controllers/deviceController");

const router = express.Router();

router.get("/", asyncHandler(deviceController.list));
router.patch("/:deviceId", asyncHandler(deviceController.assignDevice));
router.delete("/", deviceController.deleteAllDevices);
router.post('/heartbeat', deviceController.heartbeat);

module.exports = router;
