const express = require('express');
const validate = require('../middlewares/validate');
const { requireOrgRole } = require('../middlewares/tenant');
const { requireAnyEventAccess } = require('../middlewares/eventAccess');
const controller = require('../controllers/ticketType.controller');
const { createTicketTypeSchema, updateTicketTypeSchema } = require('../validators/ticketType.validator');

// mounted under /organizations/:orgId/events/:eventId/ticket-types
const router = express.Router({ mergeParams: true });

router.post('/', requireOrgRole('owner', 'admin', 'manager'), validate(createTicketTypeSchema), controller.createTicketType);
// management view (includes inactive types for org members); attendees use /events/:orgSlug/:eventSlug/ticket-types
router.get('/', requireAnyEventAccess, controller.listTicketTypes);

router.use('/:ticketTypeId', controller.loadTicketType);

router.patch('/:ticketTypeId', requireOrgRole('owner', 'admin', 'manager'), validate(updateTicketTypeSchema), controller.updateTicketType);
router.delete('/:ticketTypeId', requireOrgRole('owner', 'admin'), controller.deleteTicketType);

module.exports = router;