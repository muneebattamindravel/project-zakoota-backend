const express = require('express');
const router = express.Router();
const commandController = require('../controllers/commandController');

// Create new command
router.post('/create', commandController.createCommand);

// ✅ New: get all pending commands for a device (used in heartbeat)
router.get('/pending/:deviceId', commandController.getPendingCommands);

// ✅ New: explicitly acknowledge a command
router.patch('/acknowledge', commandController.acknowledgeCommand);

// ✅ New: list all commands with filters
router.get('/list', commandController.listCommands);

// ✅ New: delete all commands
router.delete('/deleteAll', commandController.deleteAllCommands);

router.post('/summary', commandsController.batchSummary);

module.exports = router;
