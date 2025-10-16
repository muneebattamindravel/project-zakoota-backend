const express = require('express');
const router = express.Router();
const deviceErrorController = require('../controllers/deviceErrorController');

router.post('/log', deviceErrorController.logError);
router.get('/list', deviceErrorController.listErrors);
router.delete('/delete-all', deviceErrorController.deleteAllErrors);

module.exports = router;
