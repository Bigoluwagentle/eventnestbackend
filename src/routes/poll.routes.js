const express = require('express');
const validate = require('../middlewares/validate');
const { requireEventAccess } = require('../middlewares/eventAccess');
const { requireEventParticipant } = require('../middlewares/eventParticipant');
const controller = require('../controllers/poll.controller');
const { createPollSchema, updatePollStatusSchema, voteSchema } = require('../validators/poll.validator');

// mounted under /organizations/:orgId/events/:eventId/polls
const router = express.Router({ mergeParams: true });

router.post('/', requireEventAccess('manage_questions'), validate(createPollSchema), controller.createPoll);
router.get('/', requireEventParticipant, controller.listPolls);

router.use('/:pollId', requireEventParticipant, controller.loadPoll);

router.get('/:pollId', controller.getPoll);
router.post('/:pollId/vote', validate(voteSchema), controller.vote);
router.patch('/:pollId/status', requireEventAccess('manage_questions'), validate(updatePollStatusSchema), controller.updatePollStatus);

module.exports = router;