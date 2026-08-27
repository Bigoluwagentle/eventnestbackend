const express = require('express');
const validate = require('../middlewares/validate');
const { requireOrgRole } = require('../middlewares/tenant');
const controller = require('../controllers/ticketType.controller');
const { createTicketTypeSchema, updateTicketTypeSchema } = require('../validators/ticketType.validator');

// mounted under /organizations/:orgId/events/:eventId/ticket-types, mergeParams to read orgId + eventId
const router = express.Router({ mergeParams: true });

router.post('/', requireOrgRole('owner', 'admin', 'manager'), validate(createTicketTypeSchema), controller.createTicketType);
router.get('/', controller.listTicketTypes);

router.use('/:ticketTypeId', controller.loadTicketType);

router.patch('/:ticketTypeId', requireOrgRole('owner', 'admin', 'manager'), validate(updateTicketTypeSchema), controller.updateTicketType);
router.delete('/:ticketTypeId', requireOrgRole('owner', 'admin'), controller.deleteTicketType);

module.exports = router;