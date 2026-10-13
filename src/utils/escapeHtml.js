const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Anything a user typed (names, event titles...) must be escaped before it goes into
// an HTML email, or someone could inject links and markup into emails we send.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
}

module.exports = { escapeHtml };