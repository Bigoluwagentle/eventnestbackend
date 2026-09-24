const asyncHandler = require('../utils/asyncHandler');
const bookmarkService = require('../services/bookmark.service');

const addBookmark = asyncHandler(async (req, res) => {
  const bookmark = await bookmarkService.addBookmark(req.user._id, req.body.sessionId);
  res.status(201).json({ success: true, message: 'Session bookmarked', data: { bookmark } });
});

const removeBookmark = asyncHandler(async (req, res) => {
  await bookmarkService.removeBookmark(req.user._id, req.params.sessionId);
  res.status(200).json({ success: true, message: 'Bookmark removed' });
});

const listMyAgenda = asyncHandler(async (req, res) => {
  const agenda = await bookmarkService.listMyAgenda(req.user._id, req.params.eventId);
  res.status(200).json({ success: true, data: { agenda } });
});

module.exports = { addBookmark, removeBookmark, listMyAgenda };