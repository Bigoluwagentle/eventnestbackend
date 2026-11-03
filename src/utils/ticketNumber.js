const crypto = require('crypto');

// human-friendly display reference only - NOT used for security or validation
function generateTicketNumber() {
  return `ENT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

module.exports = { generateTicketNumber };