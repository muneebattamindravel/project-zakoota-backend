const express = require('express');
const configController = require('../controllers/configController');
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

router.post('/user-config', configController.getUserConfig);
router.post('/', requireAuth, configController.updateConfig);

module.exports = router;
