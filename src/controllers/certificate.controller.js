const asyncHandler = require('../utils/asyncHandler');
const certificateService = require('../services/certificate.service');

const generate = asyncHandler(async (req, res) => {
  const result = await certificateService.generateForEvent(
    req.event,
    req.organization,
    req.user._id,
    req.body.eligibility
  );
  res.status(200).json({
    success: true,
    message: result.issued ? `${result.issued} certificate(s) issued` : 'No new certificates to issue',
    data: result,
  });
});

const listForEvent = asyncHandler(async (req, res) => {
  const data = await certificateService.listForEvent(req.event, req.query);
  res.status(200).json({ success: true, data });
});

const revoke = asyncHandler(async (req, res) => {
  const certificate = await certificateService.revoke(req.event, req.params.certId, req.user._id, req.body.reason);
  res.status(200).json({ success: true, message: 'Certificate revoked', data: { certificate } });
});

const verify = asyncHandler(async (req, res) => {
  const data = await certificateService.verify(req.params.certificateId);
  res.set('Cache-Control', 'no-store'); // a revocation must show up immediately
  res.status(200).json({ success: true, data });
});

const listMine = asyncHandler(async (req, res) => {
  const certificates = await certificateService.listMine(req.user._id);
  res.status(200).json({ success: true, data: { certificates } });
});

const downloadMine = asyncHandler(async (req, res) => {
  const { buffer, filename } = await certificateService.renderMine(req.user._id, req.params.certificateId);
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Length': buffer.length,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'private, no-store',
  });
  res.status(200).send(buffer);
});

module.exports = { generate, listForEvent, revoke, verify, listMine, downloadMine };