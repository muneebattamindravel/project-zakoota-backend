const express = require('express');
const router = express.Router();
const commandController = require('../controllers/commandController');

router.post('/create', commandController.createCommand);
router.get('/pending/:deviceId', commandController.getPendingCommand)
router.patch('/:commandId/complete', commandController.completeCommand);

module.exports = router;
