// Turns user text into a pattern that matches that text literally. Without this, "(" crashes a
// search with a 500, "c++" can never match, and a hostile pattern can make the database work hard.
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { escapeRegex };