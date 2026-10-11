const express = require('express');
const rateLimit = require('express-rate-limit');

const validate = require('../middlewares/validate');
const { protect } = require('../middlewares/auth');
const controller = require('../controllers/user.controller');
const {
  updateProfileSchema,
  updatePrivacySchema,
  changePasswordSchema,
  userIdParamSchema,
} = require('../validators/user.validator');

const router = express.Router();

router.use(protect);

// guesses at the current password need the same brute-force protection as login
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});

// /me routes must come before /:userId
router.get('/me', controller.getMe);
router.patch('/me', validate(updateProfileSchema), controller.updateProfile);
router.patch('/me/privacy', validate(updatePrivacySchema), controller.updatePrivacy);
router.post('/me/change-password', passwordLimiter, validate(changePasswordSchema), controller.changePassword);

router.get('/:userId', validate(userIdParamSchema), controller.getPublicProfile);

module.exports = router;