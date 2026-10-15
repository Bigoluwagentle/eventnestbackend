const express = require('express');
const rateLimit = require('express-rate-limit');
const validate = require('../middlewares/validate');
const { protect } = require('../middlewares/auth');
const controller = require('../controllers/certificate.controller');
const { certificateIdParamSchema } = require('../validators/certificate.validator');

// mounted under /certificates
const router = express.Router();

// public and unauthenticated, so it must not be usable to guess IDs at speed
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many verification attempts. Please try again later.' },
});

router.get('/verify/:certificateId', verifyLimiter, validate(certificateIdParamSchema), controller.verify);

router.get('/me', protect, controller.listMine);
router.get('/me/:certificateId/pdf', protect, validate(certificateIdParamSchema), controller.downloadMine);

module.exports = router;