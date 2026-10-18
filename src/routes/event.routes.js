const express = require('express');
const validate = require('../middlewares/validate');
const { attachMembershipIfExists, requireOrgRole } = require('../middlewares/tenant');
const { requireAnyEventAccess } = require('../middlewares/eventAccess');
const { loadEvent } = require('../middlewares/event');
const controller = require('../controllers/event.controller');
const { createEventSchema, updateEventSchema, updateStatusSchema } = require('../validators/event.validator');

// mounted under /organizations/:orgId/events
const router = express.Router({ mergeParams: true });

router.use(attachMembershipIfExists); // req.membership = doc or null, never blocks here

router.post('/', requireOrgRole('owner', 'admin', 'manager'), validate(createEventSchema), controller.createEvent);
// the full event list includes drafts, so it is for organization members only
router.get('/', requireOrgRole('owner', 'admin', 'manager'), controller.listOrgEvents);

router.use('/:eventId', loadEvent);
router.use('/:eventId/ticket-types', require('./ticketType.routes'));
router.use('/:eventId/staff', require('./eventStaff.routes'));
router.use('/:eventId/check-in', require('./checkIn.routes'));
router.use('/:eventId/sessions', require('./session.routes'));
router.use('/:eventId/announcements', require('./announcement.routes'));
router.use('/:eventId/polls', require('./poll.routes'));
router.use('/:eventId/questions', require('./question.routes'));
router.use('/:eventId/analytics', require('./eventAnalytics.routes'));
router.use('/:eventId/certificates', require('./eventCertificates.routes'));
router.use('/:eventId/gallery', require('./eventGallery.routes'));

// management view of an event (drafts and join link included): org members or event staff only
router.get('/:eventId', requireAnyEventAccess, controller.getEvent);
router.patch('/:eventId', requireOrgRole('owner', 'admin', 'manager'), validate(updateEventSchema), controller.updateEvent);
router.patch('/:eventId/status', requireOrgRole('owner', 'admin', 'manager'), validate(updateStatusSchema), controller.updateEventStatus);
router.delete('/:eventId', requireOrgRole('owner', 'admin'), controller.deleteEvent);

module.exports = router;