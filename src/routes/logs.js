const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const logController = require("../controllers/logController");

const router = express.Router();

router.post("/ingest",  asyncHandler(logController.ingest));
router.get("/",         asyncHandler(logController.list));
router.get("/aggregate/summary", asyncHandler(logController.summary));
router.get("/aggregate/apps",    asyncHandler(logController.apps));
router.get("/aggregate/titles",  asyncHandler(logController.titles));
router.get("/missing",  asyncHandler(logController.missing));

module.exports = router;
