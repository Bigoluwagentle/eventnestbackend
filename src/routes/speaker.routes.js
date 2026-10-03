const express = require('express');
const validate = require('../middlewares/validate');
const { requireMembership, requireOrgRole } = require('../middlewares/tenant');
const controller = require('../controllers/speaker.controller');
const { createSpeakerSchema, updateSpeakerSchema } = require('../validators/speaker.validator');

const router = express.Router({ mergeParams: true });

router.use(requireMembership);

router.post('/', requireOrgRole('owner', 'admin', 'manager'), validate(createSpeakerSchema), controller.createSpeaker);
router.get('/', controller.listSpeakers);

router.use('/:speakerId', controller.loadSpeaker);
router.patch('/:speakerId', requireOrgRole('owner', 'admin', 'manager'), validate(updateSpeakerSchema), controller.updateSpeaker);
router.delete('/:speakerId', requireOrgRole('owner', 'admin'), controller.deleteSpeaker);

module.exports = router;