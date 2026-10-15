const Certificate = require('../models/Certificate');
const Registration = require('../models/Registration');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const env = require('../config/env');
const logger = require('../config/logger');
const notificationService = require('./notification.service');
const { generateCertificateId, normalizeCertificateId } = require('../utils/certificateId');
const { renderCertificatePdf } = require('./certificatePdf.service');

const BATCH_SIZE = 500;

// where the QR code on the certificate points: the frontend's public verification page
const verifyUrlFor = (certificateId) => `${env.CLIENT_URLS[0]}/verify/${certificateId}`;

/**
 * Issues certificates for an event that is completed. Safe to run again: attendees who
 * already hold a valid certificate are skipped, so late check-ins can be picked up later.
 *   checked_in     - people whose ticket was scanned at the door (default)
 *   all_registered - everyone with a confirmed registration (e.g. virtual events with no scanning)
 */
async function generateForEvent(event, organization, issuedByUserId, eligibility = 'checked_in') {
  if (event.status !== 'completed') {
    throw new AppError('Certificates can only be issued once the event is marked as completed', 400);
  }

  const userIds =
    eligibility === 'all_registered'
      ? await Registration.distinct('user', { event: event._id, status: 'confirmed' })
      : await Ticket.distinct('user', { event: event._id, status: 'used' });

  const users = userIds.length ? await User.find({ _id: { $in: userIds }, isActive: true }).select('name').lean() : [];

  const issuedAt = new Date();
  let issued = 0;

  for (let start = 0; start < users.length; start += BATCH_SIZE) {
    const batch = users.slice(start, start + BATCH_SIZE);

    // Upsert keyed on (event, user, valid): existing valid certificates match and are left
    // untouched, only missing ones are inserted. upsertedCount is exactly how many were new.
    const operations = batch.map((user) => ({
      updateOne: {
        filter: { event: event._id, user: user._id, status: 'valid' },
        update: {
          $setOnInsert: {
            certificateId: generateCertificateId(),
            organization: event.organization,
            recipientName: user.name.normalize('NFC'),
            eventName: event.name,
            eventStartDate: event.startDate,
            eventEndDate: event.endDate,
            timezone: event.timezone || 'UTC',
            organizationName: organization.name,
            issuedAt,
            issuedBy: issuedByUserId,
            revokedAt: null,
            revokedBy: null,
            revokedReason: null,
          },
        },
        upsert: true,
      },
    }));

    const result = await Certificate.bulkWrite(operations, { ordered: false });
    issued += result.upsertedCount;

    // tell only the people who just received one
    const newlyIssued = Object.keys(result.upsertedIds || {}).map((index) => batch[Number(index)]._id);
    if (newlyIssued.length) {
      try {
        await notificationService.createNotificationsForUsers(newlyIssued, {
          type: 'general',
          title: 'Your certificate is ready',
          message: `Your certificate for ${event.name} is ready to download.`,
          data: { eventId: event._id.toString(), kind: 'certificate' },
        });
      } catch (err) {
        // the certificates exist either way; a failed notification must not undo that
        logger.warn(`Could not send certificate notifications: ${err.message}`);
      }
    }
  }

  return { eligible: users.length, issued, alreadyIssued: users.length - issued };
}

async function listForEvent(event, { page, limit, status }) {
  const filter = { event: event._id };
  if (status) filter.status = status;

  const [certificates, total] = await Promise.all([
    Certificate.find(filter)
      .sort({ issuedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Certificate.countDocuments(filter),
  ]);

  return {
    certificates: certificates.map((c) => ({
      _id: c._id,
      certificateId: c.certificateId,
      user: c.user,
      recipientName: c.recipientName,
      status: c.status,
      issuedAt: c.issuedAt,
      revokedAt: c.revokedAt,
      revokedReason: c.revokedReason,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

async function revoke(event, certificateDocId, revokedByUserId, reason) {
  // atomic: only a currently valid certificate of THIS event can be revoked
  const revoked = await Certificate.findOneAndUpdate(
    { _id: certificateDocId, event: event._id, status: 'valid' },
    { $set: { status: 'revoked', revokedAt: new Date(), revokedBy: revokedByUserId, revokedReason: reason || null } },
    { new: true }
  );

  if (!revoked) {
    const exists = await Certificate.exists({ _id: certificateDocId, event: event._id });
    throw exists ? new AppError('This certificate is already revoked', 409) : new AppError('Certificate not found', 404);
  }

  return { _id: revoked._id, certificateId: revoked.certificateId, status: revoked.status, revokedAt: revoked.revokedAt };
}

/**
 * Public verification. Answers only what a verifier needs and nothing more:
 * never the email, user id or ticket details; and nothing but "revoked" for revoked ones.
 */
async function verify(rawCertificateId) {
  const certificateId = normalizeCertificateId(rawCertificateId);
  const certificate = certificateId ? await Certificate.findOne({ certificateId }).lean() : null;

  // malformed and unknown IDs get the identical answer
  if (!certificate) {
    throw new AppError('No certificate was found with that ID', 404);
  }

  if (certificate.status === 'revoked') {
    return {
      valid: false,
      status: 'revoked',
      certificate: {
        certificateId: certificate.certificateId,
        eventName: certificate.eventName,
        organizationName: certificate.organizationName,
        issuedAt: certificate.issuedAt,
        revokedAt: certificate.revokedAt,
      },
    };
  }

  return {
    valid: true,
    status: 'valid',
    certificate: {
      certificateId: certificate.certificateId,
      recipientName: certificate.recipientName,
      eventName: certificate.eventName,
      eventStartDate: certificate.eventStartDate,
      eventEndDate: certificate.eventEndDate,
      timezone: certificate.timezone,
      organizationName: certificate.organizationName,
      issuedAt: certificate.issuedAt,
    },
  };
}

async function listMine(userId) {
  const certificates = await Certificate.find({ user: userId }).sort({ issuedAt: -1 }).lean();
  return certificates.map((c) => ({
    _id: c._id,
    certificateId: c.certificateId,
    eventName: c.eventName,
    organizationName: c.organizationName,
    eventStartDate: c.eventStartDate,
    eventEndDate: c.eventEndDate,
    timezone: c.timezone,
    issuedAt: c.issuedAt,
    status: c.status,
  }));
}

async function renderMine(userId, rawCertificateId) {
  const certificateId = normalizeCertificateId(rawCertificateId);
  // the user filter is the ownership check: someone else's ID looks exactly like a missing one
  const certificate = certificateId ? await Certificate.findOne({ certificateId, user: userId }).lean() : null;

  if (!certificate) throw new AppError('Certificate not found', 404);
  if (certificate.status === 'revoked') throw new AppError('This certificate has been revoked', 410);

  const buffer = await renderCertificatePdf({ ...certificate, verifyUrl: verifyUrlFor(certificate.certificateId) });
  return { buffer, filename: `certificate-${certificate.certificateId}.pdf` };
}

module.exports = { generateForEvent, listForEvent, revoke, verify, listMine, renderMine };