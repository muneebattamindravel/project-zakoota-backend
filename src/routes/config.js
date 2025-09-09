const express = require('express');
const configController = require('../controllers/configController');

const router = express.Router();

router.post('/user-config', configController.getUserConfig);
router.post('/', configController.updateConfig);

module.exports = router;
