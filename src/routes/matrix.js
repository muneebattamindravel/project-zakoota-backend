const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const matrixController = require('../controllers/matrixController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/users', requireAuth, asyncHandler(matrixController.getUsers));
router.post('/link-device', requireAuth, asyncHandler(matrixController.linkDevice));

module.exports = router;
