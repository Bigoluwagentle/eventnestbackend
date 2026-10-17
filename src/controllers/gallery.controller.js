const asyncHandler = require('../utils/asyncHandler');
const galleryService = require('../services/gallery.service');

const listForManagement = asyncHandler(async (req, res) => {
  const data = await galleryService.listForManagement(req.event, req.query);
  res.status(200).json({ success: true, data });
});

const updateSettings = asyncHandler(async (req, res) => {
  const data = await galleryService.updateAccess(req.event, req.body.access);
  res.status(200).json({ success: true, message: 'Gallery access updated', data });
});

const createUploadTickets = asyncHandler(async (req, res) => {
  const data = await galleryService.createPhotoUploadTickets(req.event, req.body.count);
  res.status(200).json({ success: true, data });
});

const attachPhotos = asyncHandler(async (req, res) => {
  const data = await galleryService.attachPhotos(req.event, req.user._id, req.body.photos);
  res.status(data.added ? 201 : 200).json({
    success: true,
    message: data.added ? `${data.added} photo(s) added` : 'No new photos to add',
    data,
  });
});

const addVideo = asyncHandler(async (req, res) => {
  const item = await galleryService.addVideo(req.event, req.user._id, req.body);
  res.status(201).json({ success: true, message: 'Video added', data: { item } });
});

const addResource = asyncHandler(async (req, res) => {
  const item = await galleryService.addResource(req.event, req.user._id, req.body);
  res.status(201).json({ success: true, message: 'Resource added', data: { item } });
});

const updateItem = asyncHandler(async (req, res) => {
  const item = await galleryService.updateItem(req.event, req.params.itemId, req.body);
  res.status(200).json({ success: true, message: 'Gallery item updated', data: { item } });
});

const deleteItem = asyncHandler(async (req, res) => {
  await galleryService.deleteItem(req.event, req.params.itemId);
  res.status(200).json({ success: true, message: 'Gallery item deleted' });
});

const getPublicGallery = asyncHandler(async (req, res) => {
  const data = await galleryService.getPublicGallery(req.params.orgSlug, req.params.eventSlug, req.user, req.query);
  res.set('Cache-Control', 'private, no-store'); // the answer depends on who is asking
  res.status(200).json({ success: true, data });
});

module.exports = {
  listForManagement,
  updateSettings,
  createUploadTickets,
  attachPhotos,
  addVideo,
  addResource,
  updateItem,
  deleteItem,
  getPublicGallery,
};