const { escapeHtml: e } = require('../utils/escapeHtml');

const BRAND = '#4f46e5';

function formatEventDate(date, timeZone) {
  const options = { dateStyle: 'full', timeStyle: 'short' };
  try {
    return `${new Intl.DateTimeFormat('en-GB', { ...options, timeZone }).format(new Date(date))} (${timeZone})`;
  } catch {
    // unknown time zone name: fall back to UTC rather than failing the email
    return `${new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(new Date(date))} (UTC)`;
  }
}

function layout({ title, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(title)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:${BRAND};padding:18px 28px;color:#ffffff;font-size:20px;font-weight:bold;">EventNest</td></tr>
        <tr><td style="padding:28px;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
        <tr><td style="padding:16px 28px;background:#f9fafb;font-size:12px;color:#6b7280;">You received this email because of activity on your EventNest account. If this wasn't you, you can ignore it.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(url, label) {
  return `<p style="margin:24px 0;"><a href="${e(url)}" style="background:${BRAND};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:bold;display:inline-block;">${e(label)}</a></p>
<p style="font-size:13px;color:#6b7280;">If the button doesn't work, copy this link into your browser:<br><a href="${e(url)}" style="color:${BRAND};word-break:break-all;">${e(url)}</a></p>`;
}

function verifyEmail({ name, url }) {
  return {
    subject: 'Verify your EventNest email',
    html: layout({
      title: 'Verify your email',
      bodyHtml: `<p>Hi ${e(name)},</p><p>Welcome to EventNest! Please confirm your email address to finish setting up your account.</p>${button(url, 'Verify email')}<p style="font-size:13px;color:#6b7280;">This link expires in 24 hours.</p>`,
    }),
    text: `Hi ${name},\n\nWelcome to EventNest! Confirm your email address:\n${url}\n\nThis link expires in 24 hours.`,
  };
}

function resetPassword({ name, url, minutes }) {
  return {
    subject: 'Reset your EventNest password',
    html: layout({
      title: 'Reset your password',
      bodyHtml: `<p>Hi ${e(name)},</p><p>We received a request to reset your password. Click the button below to choose a new one.</p>${button(url, 'Reset password')}<p style="font-size:13px;color:#6b7280;">This link expires in ${e(minutes)} minutes. If you didn't ask for this, you can safely ignore this email; your password won't change.</p>`,
    }),
    text: `Hi ${name},\n\nReset your password using this link (valid for ${minutes} minutes):\n${url}\n\nIf you didn't ask for this, ignore this email.`,
  };
}

function passwordChanged({ name }) {
  return {
    subject: 'Your EventNest password was changed',
    html: layout({
      title: 'Password changed',
      bodyHtml: `<p>Hi ${e(name)},</p><p>The password on your EventNest account was just changed, and all devices were signed out.</p><p><strong>If this was you, no action is needed.</strong> If it wasn't, reset your password right away and check your email account's security.</p>`,
    }),
    text: `Hi ${name},\n\nThe password on your EventNest account was just changed and all devices were signed out.\nIf this was you, no action is needed. If it wasn't, reset your password right away.`,
  };
}

function invitation({ inviterName, organizationName, role, url, days }) {
  return {
    subject: `${inviterName} invited you to join ${organizationName} on EventNest`,
    html: layout({
      title: 'Organization invitation',
      bodyHtml: `<p><strong>${e(inviterName)}</strong> invited you to join <strong>${e(organizationName)}</strong> on EventNest as <strong>${e(role)}</strong>.</p>${button(url, 'Accept invitation')}<p style="font-size:13px;color:#6b7280;">Sign in (or create an account) with the email address this message was sent to. The invitation expires in ${e(days)} days.</p>`,
    }),
    text: `${inviterName} invited you to join ${organizationName} on EventNest as ${role}.\n\nAccept the invitation:\n${url}\n\nUse the email address this message was sent to. Expires in ${days} days.`,
  };
}

function registrationConfirmed({ name, eventName, startDate, timezone, eventType, venue, city, ticketTypeName, ticketNumber, url }) {
  const when = formatEventDate(startDate, timezone);
  const place = [venue, city].filter(Boolean).join(', ');
  const where =
    eventType === 'virtual' ? 'Online' : eventType === 'hybrid' ? `${place || 'Venue to be announced'} and online` : place || 'Venue to be announced';
  const onlineNote = eventType === 'physical' ? '' : ' Joining details for the online part are on the event page.';

  return {
    subject: `You're registered: ${eventName}`,
    html: layout({
      title: 'Registration confirmed',
      bodyHtml: `<p>Hi ${e(name)},</p><p>You're in! Your registration for <strong>${e(eventName)}</strong> is confirmed.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px;">
<tr><td style="padding:4px 16px 4px 0;color:#6b7280;">When</td><td>${e(when)}</td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#6b7280;">Where</td><td>${e(where)}</td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#6b7280;">Ticket</td><td>${e(ticketTypeName)} &middot; ${e(ticketNumber)}</td></tr>
</table>
<p>Your QR code is in your account. Open it on your phone and show it at the door.${e(onlineNote)}</p>${button(url, 'View my ticket')}`,
    }),
    text: `Hi ${name},\n\nYou're in! Your registration for ${eventName} is confirmed.\n\nWhen: ${when}\nWhere: ${where}\nTicket: ${ticketTypeName} - ${ticketNumber}\n\nYour QR code is in your account:${onlineNote}\n${url}`,
  };
}

module.exports = { formatEventDate, verifyEmail, resetPassword, passwordChanged, invitation, registrationConfirmed };