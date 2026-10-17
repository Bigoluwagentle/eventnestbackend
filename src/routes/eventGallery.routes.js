const express = require('express');
const rateLimit = require('express-rate-limit');
const validate = require('../middlewares/validate');
const { requireOrgRole } = require('../middlewares/tenant');
const controller = require('../controllers/gallery.controller');
const {
  listGallerySchema,
  updateSettingsSchema,
  uploadTicketsSchema,
  attachPhotosSchema,
  addVideoSchema,
  addResourceSchema,
  updateItemSchema,
  itemIdSchema,
} = require('../validators/gallery.validator');

// mounted under /organizations/:orgId/events/:eventId/gallery
const router = express.Router({ mergeParams: true });

// upload tickets and attaching photos both touch the image host, so they get a limit
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many upload requests. Please try again later.' },
});

// everything here is for organizers
router.use(requireOrgRole('owner', 'admin', 'manager'));

router.get('/', validate(listGallerySchema), controller.listForManagement);
router.patch('/settings', validate(updateSettingsSchema), controller.updateSettings);

router.post('/photos/signatures', uploadLimiter, validate(uploadTicketsSchema), controller.createUploadTickets);
router.post('/photos', uploadLimiter, validate(attachPhotosSchema), controller.attachPhotos);
router.post('/videos', validate(addVideoSchema), controller.addVideo);
router.post('/resources', validate(addResourceSchema), controller.addResource);

router.patch('/items/:itemId', validate(updateItemSchema), controller.updateItem);
router.delete('/items/:itemId', validate(itemIdSchema), controller.deleteItem);

module.exports = router;