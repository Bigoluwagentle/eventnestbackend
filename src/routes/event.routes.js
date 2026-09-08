const express = require('express');
const validate = require('../middlewares/validate');
const { attachMembershipIfExists, requireOrgRole } = require('../middlewares/tenant');
const { loadEvent } = require('../middlewares/event');
const controller = require('../controllers/event.controller');
const { createEventSchema, updateEventSchema, updateStatusSchema } = require('../validators/event.validator');

const router = express.Router({ mergeParams: true });

router.use(attachMembershipIfExists); // req.membership = doc or null, never blocks here

router.post('/', requireOrgRole('owner', 'admin', 'manager'), validate(createEventSchema), controller.createEvent);
router.get('/', controller.listOrgEvents);

router.use('/:eventId', loadEvent);
router.use('/:eventId/ticket-types', require('./ticketType.routes'));
router.use('/:eventId/staff', require('./eventStaff.routes'));
router.use('/:eventId/check-in', require('./checkIn.routes'));

router.get('/:eventId', controller.getEvent);
router.patch('/:eventId', requireOrgRole('owner', 'admin', 'manager'), validate(updateEventSchema), controller.updateEvent);
router.patch('/:eventId/status', requireOrgRole('owner', 'admin', 'manager'), validate(updateStatusSchema), controller.updateEventStatus);
router.delete('/:eventId', requireOrgRole('owner', 'admin'), controller.deleteEvent);

module.exports = router;