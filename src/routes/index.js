const express = require('express');

const router = express.Router();

// Domain routers will be mounted here as we build each phase, e.g.:
// router.use('/auth', require('./auth.routes'));
// router.use('/users', require('./user.routes'));
// router.use('/organizations', require('./organization.routes'));
// router.use('/events', require('./event.routes'));

router.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'EventNest API v1' });
});

router.use('/auth', require('./auth.routes'));
router.use('/organizations', require('./organization.routes'));
router.use('/events', require('./publicEvents.routes'));

module.exports = router;
