const express = require('express');
const validate = require('../middlewares/validate');
const { requireOrgRole } = require('../middlewares/tenant');
const { loadEvent } = require('../middlewares/event');
const controller = require('../controllers/event.controller');
const { createEventSchema, updateEventSchema, updateStatusSchema } = require('../validators/event.validator');

// mergeParams lets this router read :orgId from the parent (organization.routes.js)
const router = express.Router({ mergeParams: true });

// mounted under /organizations/:orgId/events, AFTER loadOrganization + requireMembership
// already ran in organization.routes.js - req.organization and req.membership exist here.

router.post('/', requireOrgRole('owner', 'admin', 'manager'), validate(createEventSchema), controller.createEvent);
router.get('/', controller.listOrgEvents);

router.use('/:eventId', loadEvent);
router.use('/:eventId/ticket-types', require('./ticketType.routes'));

router.get('/:eventId', controller.getEvent);
router.patch(
  '/:eventId',
  requireOrgRole('owner', 'admin', 'manager'),
  validate(updateEventSchema),
  controller.updateEvent
);
router.patch(
  '/:eventId/status',
  requireOrgRole('owner', 'admin', 'manager'),
  validate(updateStatusSchema),
  controller.updateEventStatus
);
router.delete('/:eventId', requireOrgRole('owner', 'admin'), controller.deleteEvent);

module.exports = router;