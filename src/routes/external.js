const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const externalApiKeyAuth = require('../middlewares/externalApiKeyAuth');
const externalController = require('../controllers/externalController');

const router = express.Router();

router.use(externalApiKeyAuth);

// POST /zakoota-api/external/focus
// Body: { from, to, userIds? }
router.post('/focus', asyncHandler(externalController.getFocusData));

module.exports = router;
