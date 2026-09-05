const express = require('express');
const validate = require('../middlewares/validate');
const { requireEventAccess } = require('../middlewares/eventAccess');
const controller = require('../controllers/checkIn.controller');
const { checkInSchema } = require('../validators/eventStaff.validator');

// mounted under /organizations/:orgId/events/:eventId/check-in
const router = express.Router({ mergeParams: true });

router.post('/scan', requireEventAccess('check_in'), validate(checkInSchema), controller.checkIn);
router.get('/attendees', requireEventAccess('view_attendees'), controller.listAttendees);

module.exports = router;