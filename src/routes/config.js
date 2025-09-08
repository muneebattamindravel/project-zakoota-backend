const express = require('express');
const configController = require('../controllers/configController');

const router = express.Router();

router.get('/', configController.getConfig);
router.post('/', configController.updateConfig);

module.exports = router;
