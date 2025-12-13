const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middlewares/authMiddleware');

// Public login
router.post('/login', authController.login);

// Authenticated helpers
router.post('/logout', requireAuth, authController.logout);
router.get('/me', requireAuth, authController.me);
router.get('/sessions', requireAuth, authController.listSessions);

module.exports = router;
