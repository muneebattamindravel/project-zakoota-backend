const express = require('express');
const router = express.Router();
const deviceErrorController = require('../controllers/deviceErrorController');

router.post('/:deviceId', deviceErrorController.logError);
router.get('/', deviceErrorController.listErrors);

module.exports = router;
