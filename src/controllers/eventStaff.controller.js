const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const EventStaff = require('../models/EventStaff');
const eventStaffService = require('../services/eventStaff.service');

const addStaff = asyncHandler(async (req, res) => {
  const staff = await eventStaffService.addStaff(
    req.event,
    req.organization._id,
    req.user._id,
    req.body.email,
    req.body.permissions
  );
  res.status(201).json({ success: true, message: 'Staff member added', data: { staff } });
});

const listStaff = asyncHandler(async (req, res) => {
  const staff = await eventStaffService.listStaff(req.event._id);
  res.status(200).json({ success: true, data: { staff } });
});

const loadStaff = asyncHandler(async (req, res, next) => {
  const staff = await EventStaff.findOne({ _id: req.params.staffId, event: req.event._id });
  if (!staff) return next(new AppError('Staff record not found', 404));
  req.staffRecord = staff;
  next();
});

const updateStaffPermissions = asyncHandler(async (req, res) => {
  const staff = await eventStaffService.updateStaffPermissions(req.staffRecord, req.body.permissions);
  res.status(200).json({ success: true, message: 'Permissions updated', data: { staff } });
});

const removeStaff = asyncHandler(async (req, res) => {
  await eventStaffService.removeStaff(req.staffRecord);
  res.status(200).json({ success: true, message: 'Staff member removed' });
});

module.exports = { addStaff, listStaff, loadStaff, updateStaffPermissions, removeStaff };