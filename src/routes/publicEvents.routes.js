const express = require('express');
const validate = require('../middlewares/validate');
const controller = require('../controllers/event.controller');
const { listPublicEventsSchema } = require('../validators/event.validator');

const router = express.Router();

router.get('/', validate(listPublicEventsSchema), controller.listPublicEvents);
router.get('/:orgSlug/:eventSlug', controller.getPublicEvent);
router.get('/:orgSlug/:eventSlug/schedule', controller.getPublicSchedule);
router.get('/:orgSlug/:eventSlug/speakers', controller.getPublicEventSpeakers);

module.exports = router;