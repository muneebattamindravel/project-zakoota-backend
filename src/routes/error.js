const express = require('express');
const router = express.Router();
const deviceErrorController = require('../controllers/deviceErrorController');
const { requireAuth } = require("../middlewares/authMiddleware");

router.post('/log', deviceErrorController.logError);
router.get('/list', requireAuth, deviceErrorController.listErrors);
router.delete('/delete-all', requireAuth, deviceErrorController.deleteAllErrors);

module.exports = router;
