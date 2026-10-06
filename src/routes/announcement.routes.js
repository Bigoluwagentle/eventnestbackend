const express = require('express');
const validate = require('../middlewares/validate');
const { requireEventAccess } = require('../middlewares/eventAccess');
const { requireEventParticipant } = require('../middlewares/eventParticipant');
const controller = require('../controllers/announcement.controller');
const { createAnnouncementSchema } = require('../validators/announcement.validator');

// mounted under /organizations/:orgId/events/:eventId/announcements
const router = express.Router({ mergeParams: true });

router.post('/', requireEventAccess('send_announcements'), validate(createAnnouncementSchema), controller.createAnnouncement);
router.get('/', requireEventParticipant, controller.listAnnouncements);

module.exports = router;