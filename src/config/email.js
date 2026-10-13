const { Resend } = require('resend');
const env = require('./env');

// Email is optional: with no RESEND_API_KEY the app still runs, and emails are
// printed to the console in development instead of being sent.
const isConfigured = Boolean(env.RESEND_API_KEY);
const client = isConfigured ? new Resend(env.RESEND_API_KEY) : null;

// onboarding@resend.dev works without a domain but only delivers to your own Resend
// account email. Set EMAIL_FROM to an address on a verified domain to email real users.
const from = env.EMAIL_FROM || 'EventNest <onboarding@resend.dev>';

module.exports = { client, isConfigured, from };