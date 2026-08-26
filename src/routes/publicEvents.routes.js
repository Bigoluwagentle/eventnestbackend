const express = require('express');
const validate = require('../middlewares/validate');
const controller = require('../controllers/event.controller');
const { listPublicEventsSchema } = require('../validators/event.validator');

const router = express.Router();

// no auth required - public discovery
router.get('/', validate(listPublicEventsSchema), controller.listPublicEvents);
router.get('/:orgSlug/:eventSlug', controller.getPublicEvent);

module.exports = router;