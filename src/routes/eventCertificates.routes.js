const express = require('express');
const validate = require('../middlewares/validate');
const { requireOrgRole } = require('../middlewares/tenant');
const controller = require('../controllers/certificate.controller');
const {
  generateCertificatesSchema,
  listCertificatesSchema,
  revokeCertificateSchema,
} = require('../validators/certificate.validator');

// mounted under /organizations/:orgId/events/:eventId/certificates
const router = express.Router({ mergeParams: true });

router.post('/generate', requireOrgRole('owner', 'admin', 'manager'), validate(generateCertificatesSchema), controller.generate);
router.get('/', requireOrgRole('owner', 'admin', 'manager'), validate(listCertificatesSchema), controller.listForEvent);
router.post('/:certId/revoke', requireOrgRole('owner', 'admin'), validate(revokeCertificateSchema), controller.revoke);

module.exports = router;