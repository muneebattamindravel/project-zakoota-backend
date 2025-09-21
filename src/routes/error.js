const express = require('express');
const router = express.Router();
const deviceErrorController = require('../controllers/deviceErrorController');

router.post('/log', deviceErrorController.logError);
router.get('/list', deviceErrorController.listErrors);


module.exports = router;
