const express = require('express');
const validate = require('../middlewares/validate');
const { requireEventAccess, requireAnyEventAccess } = require('../middlewares/eventAccess');
const controller = require('../controllers/session.controller');
const { createSessionSchema, updateSessionSchema } = require('../validators/session.validator');

// mounted under /organizations/:orgId/events/:eventId/sessions
const router = express.Router({ mergeParams: true });

router.post('/', requireEventAccess('manage_schedule'), validate(createSessionSchema), controller.createSession);
router.get('/', requireAnyEventAccess, controller.listSessions);

router.use('/:sessionId', controller.loadSession);
router.patch('/:sessionId', requireEventAccess('manage_schedule'), validate(updateSessionSchema), controller.updateSession);
router.delete('/:sessionId', requireEventAccess('manage_schedule'), controller.deleteSession);

module.exports = router;