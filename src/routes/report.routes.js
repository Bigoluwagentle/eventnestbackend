const express = require('express');
const rateLimit = require('express-rate-limit');
const validate = require('../middlewares/validate');
const { protect } = require('../middlewares/auth');
const controller = require('../controllers/report.controller');
const { createReportSchema } = require('../validators/report.validator');

// mounted under /reports
const router = express.Router();

// reporting must not become a way to flood the moderation queue
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many reports. Please try again later.' },
});

router.post('/', protect, reportLimiter, validate(createReportSchema), controller.createReport);

module.exports = router;