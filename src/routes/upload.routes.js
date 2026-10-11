const express = require('express');
const rateLimit = require('express-rate-limit');

const validate = require('../middlewares/validate');
const { protect } = require('../middlewares/auth');
const controller = require('../controllers/upload.controller');
const { signatureSchema, attachSchema } = require('../validators/upload.validator');

const router = express.Router();

router.use(protect);

// each signature is an upload ticket, and each attach is a Cloudinary API call - cap both
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many upload requests. Please try again later.' },
});

router.post('/signature', uploadLimiter, validate(signatureSchema), controller.getSignature);
router.post('/attach', uploadLimiter, validate(attachSchema), controller.attach);

module.exports = router;