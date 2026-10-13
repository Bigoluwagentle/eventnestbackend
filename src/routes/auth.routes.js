const express = require('express');
const rateLimit = require('express-rate-limit');

const validate = require('../middlewares/validate');
const { protect } = require('../middlewares/auth');
const { requireCsrfHeader } = require('../middlewares/csrf');
const authController = require('../controllers/auth.controller');
const {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../validators/auth.validator');

const router = express.Router();

const limiterMessage = { success: false, message: 'Too many attempts. Please try again later.' };

// brute-force protection for login and password reset
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: limiterMessage,
});

// signup sends an email, so it must not be usable to spam strangers' inboxes
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: limiterMessage,
});

const resendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: limiterMessage,
});

router.post('/signup', signupLimiter, validate(signupSchema), authController.signup);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', requireCsrfHeader, authController.refresh);
router.post('/logout', requireCsrfHeader, authController.logout);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', protect, resendLimiter, authController.resendVerification);
router.get('/me', protect, authController.getMe);

module.exports = router;