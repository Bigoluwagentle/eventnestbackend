const express = require('express');
const validate = require('../middlewares/validate');
const { protect } = require('../middlewares/auth');
const controller = require('../controllers/registration.controller');
const { registerSchema } = require('../validators/registration.validator');

const router = express.Router();

router.use(protect); // every registration action requires a logged-in attendee

router.post('/', validate(registerSchema), controller.register);
router.get('/me', controller.listMyRegistrations);
router.get('/:registrationId/ticket', controller.getMyTicket);
router.post('/:registrationId/cancel', controller.cancelMyRegistration);

module.exports = router;