const express = require('express');
const router = express.Router();
const commandController = require('../controllers/commandController');

router.post('/:deviceId', commandController.createCommand);
router.patch('/:commandId/complete', commandController.completeCommand);

module.exports = router;
