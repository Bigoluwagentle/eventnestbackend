const express = require('express');
const validate = require('../middlewares/validate');
const { requireEventAccess } = require('../middlewares/eventAccess');
const { requireEventParticipant } = require('../middlewares/eventParticipant');
const controller = require('../controllers/question.controller');
const {
  askQuestionSchema,
  listQuestionsSchema,
  updateQuestionStatusSchema,
} = require('../validators/question.validator');

// mounted under /organizations/:orgId/events/:eventId/questions
const router = express.Router({ mergeParams: true });

router.use(requireEventParticipant, controller.attachModeratorFlag);

router.post('/', validate(askQuestionSchema), controller.askQuestion);
router.get('/', validate(listQuestionsSchema), controller.listQuestions);

router.use('/:questionId', controller.loadQuestion);

router.post('/:questionId/upvote', controller.upvote);
router.delete('/:questionId/upvote', controller.removeUpvote);
router.patch(
  '/:questionId/status',
  requireEventAccess('manage_questions'),
  validate(updateQuestionStatusSchema),
  controller.updateQuestionStatus
);

module.exports = router;