const AuditLog = require('../models/AuditLog');

/**
 * Writes one audit entry. Pass the transaction `session` so the entry is saved together with the
 * action it describes: either both happen or neither does.
 */
async function record({ admin, action, target, reason, metadata, ip, session }) {
  await AuditLog.create(
    [
      {
        actor: admin._id,
        actorName: admin.name || '',
        action,
        targetType: target.type,
        targetId: target.id,
        targetLabel: target.label || '',
        reason: reason || null,
        metadata: metadata || {},
        ip: ip || null,
      },
    ],
    session ? { session } : undefined
  );
}

async function list({ page, limit, action, targetType, targetId, actor }) {
  const filter = {};
  if (action) filter.action = action;
  if (targetType) filter.targetType = targetType;
  if (targetId) filter.targetId = targetId;
  if (actor) filter.actor = actor;

  const [entries, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return { entries, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

module.exports = { record, list };