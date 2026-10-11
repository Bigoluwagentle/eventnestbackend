const express = require('express');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const spec = require('./openapi');

const router = express.Router();

// Swagger UI needs assets that the strict default CSP would block, so the docs get
// their own helmet config. This router is mounted BEFORE the global helmet in app.js.
router.use(helmet({ contentSecurityPolicy: false }));

router.get('/openapi.json', (req, res) => res.json(spec));

router.use(
  '/',
  swaggerUi.serve,
  swaggerUi.setup(spec, {
    customSiteTitle: 'EventNest API Docs',
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
  })
);

module.exports = router;