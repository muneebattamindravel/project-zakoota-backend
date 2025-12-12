const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const logController = require("../controllers/logController");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/ingest", asyncHandler(logController.ingest));
router.get("/", requireAuth, asyncHandler(logController.list));
router.get("/aggregate/summary", requireAuth, asyncHandler(logController.summary));
router.get("/aggregate/apps", requireAuth, asyncHandler(logController.apps));
router.get("/aggregate/titles", requireAuth, asyncHandler(logController.titles));
router.get("/missing", requireAuth, asyncHandler(logController.missing));
router.delete("/", requireAuth, logController.deleteAllLogs);

module.exports = router;
