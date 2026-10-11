const asyncHandler = require('../utils/asyncHandler');
const uploadService = require('../services/upload.service');

const getSignature = asyncHandler(async (req, res) => {
  const data = await uploadService.createUploadSignature(req.user, req.body);
  res.status(200).json({ success: true, data });
});

const attach = asyncHandler(async (req, res) => {
  const { publicId, ...target } = req.body;
  const image = await uploadService.attachUpload(req.user, target, publicId);
  res.status(200).json({ success: true, message: 'Image saved', data: { image } });
});

module.exports = { getSignature, attach };