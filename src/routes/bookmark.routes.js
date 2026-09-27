const express = require('express');
const validate = require('../middlewares/validate');
const { protect } = require('../middlewares/auth');
const controller = require('../controllers/bookmark.controller');
const { addBookmarkSchema } = require('../validators/bookmark.validator');

const router = express.Router();

router.use(protect); // bookmarking is an attendee action, requires login

router.post('/', validate(addBookmarkSchema), controller.addBookmark);
router.delete('/:sessionId', controller.removeBookmark);
router.get('/event/:eventId', controller.listMyAgenda);

module.exports = router;