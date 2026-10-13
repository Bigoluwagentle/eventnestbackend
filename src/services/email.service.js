const env = require('../config/env');
const logger = require('../config/logger');
const { client, isConfigured, from } = require('../config/email');
const templates = require('../emails/templates');

// Links in emails point at the first configured frontend origin.
const appUrl = () => env.CLIENT_URLS[0];

// Sends one email. NEVER throws: a mail problem must not fail or crash the request
// that triggered it. (The Resend SDK returns { data, error } instead of throwing.)
async function sendEmail({ to, subject, html, text }) {
  if (!isConfigured) {
    if (env.NODE_ENV === 'production') {
      // never print the message in production: it contains live reset / verification links
      logger.warn(`Email "${subject}" was not sent: RESEND_API_KEY is not set`);
    } else {
      logger.info(`[email not configured - printing instead]\nTo: ${to}\nSubject: ${subject}\n\n${text}`);
    }
    return { sent: false };
  }

  try {
    const { data, error } = await client.emails.send({ from, to, subject, html, text });
    if (error) {
      logger.error(`Email "${subject}" failed: ${error.name || 'error'} - ${error.message}`);
      return { sent: false };
    }
    return { sent: true, id: data?.id };
  } catch (err) {
    logger.error(`Email "${subject}" failed: ${err.message}`);
    return { sent: false };
  }
}

// Builds and sends a message, swallowing every error (including template bugs),
// so callers can fire-and-forget without risking an unhandled rejection.
function dispatch(buildMessage) {
  return (async () => {
    try {
      return await sendEmail(buildMessage());
    } catch (err) {
      logger.error(`Email could not be prepared: ${err.message}`);
      return { sent: false };
    }
  })();
}

const sendVerificationEmail = (user, token) =>
  dispatch(() => ({
    to: user.email,
    ...templates.verifyEmail({ name: user.name, url: `${appUrl()}/verify-email?token=${encodeURIComponent(token)}` }),
  }));

const sendPasswordResetEmail = (user, token, minutes) =>
  dispatch(() => ({
    to: user.email,
    ...templates.resetPassword({
      name: user.name,
      minutes,
      url: `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`,
    }),
  }));

const sendPasswordChangedEmail = (user) =>
  dispatch(() => ({ to: user.email, ...templates.passwordChanged({ name: user.name }) }));

const sendOrganizationInvitation = ({ to, inviterName, organizationName, role, token }) =>
  dispatch(() => ({
    to,
    ...templates.invitation({
      inviterName,
      organizationName,
      role,
      days: 7,
      url: `${appUrl()}/accept-invite?token=${encodeURIComponent(token)}`,
    }),
  }));

const sendRegistrationConfirmation = ({ user, event, ticketType, ticket, registration }) =>
  dispatch(() => ({
    to: user.email,
    ...templates.registrationConfirmed({
      name: user.name,
      eventName: event.name,
      startDate: event.startDate,
      timezone: event.timezone,
      eventType: event.eventType,
      venue: event.location?.venueName,
      city: event.location?.city,
      ticketTypeName: ticketType.name,
      ticketNumber: ticket.ticketNumber,
      url: `${appUrl()}/tickets/${registration._id}`,
    }),
  }));

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendOrganizationInvitation,
  sendRegistrationConfirmation,
};