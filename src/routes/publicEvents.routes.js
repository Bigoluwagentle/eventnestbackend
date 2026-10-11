const express = require('express');
const validate = require('../middlewares/validate');
const { protect } = require('../middlewares/auth');
const controller = require('../controllers/event.controller');
const publicController = require('../controllers/publicEvent.controller');
const { listPublicEventsSchema } = require('../validators/event.validator');

const router = express.Router();

// no auth required - public discovery
router.get('/', validate(listPublicEventsSchema), controller.listPublicEvents);
router.get('/:orgSlug/:eventSlug', controller.getPublicEvent);
router.get('/:orgSlug/:eventSlug/schedule', controller.getPublicSchedule);
router.get('/:orgSlug/:eventSlug/speakers', controller.getPublicEventSpeakers);
router.get('/:orgSlug/:eventSlug/ticket-types', publicController.getPublicTicketTypes);

// the one public-event route that needs login: the virtual join link
router.get('/:orgSlug/:eventSlug/join-info', protect, publicController.getJoinInfo);

module.exports = router;