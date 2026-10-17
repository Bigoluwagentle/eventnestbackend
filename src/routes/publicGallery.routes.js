const express = require('express');
const validate = require('../middlewares/validate');
const { optionalAuth } = require('../middlewares/optionalAuth');
const controller = require('../controllers/gallery.controller');
const { publicGallerySchema } = require('../validators/gallery.validator');

// mounted under /events (next to the other public event routes)
const router = express.Router();

router.get('/:orgSlug/:eventSlug/gallery', optionalAuth, validate(publicGallerySchema), controller.getPublicGallery);

module.exports = router;