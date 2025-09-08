import express from 'express';
import configController from '../controllers/configController';

const router = express.Router();

router.get('/', configController.getConfig);
router.post('/', configController.updateConfig); // optional: allow updates via dashboard

export default router;
