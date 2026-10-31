const express = require('express');
const validate = require('../middlewares/validate');
const { protect } = require('../middlewares/auth');
const controller = require('../controllers/savedEvent.controller');
const { eventIdSchema, listSavedSchema, savedStatusSchema } = require('../validators/savedEvent.validator');

// mounted under /saved-events
const router = express.Router();

router.use(protect);

router.get('/', validate(listSavedSchema), controller.listSavedEvents);
router.get('/status', validate(savedStatusSchema), controller.savedStatus);
router.put('/:eventId', validate(eventIdSchema), controller.saveEvent);
router.delete('/:eventId', validate(eventIdSchema), controller.unsaveEvent);

module.exports = router;