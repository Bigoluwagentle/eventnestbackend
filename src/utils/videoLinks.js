// Only YouTube and Vimeo links are accepted, and only the provider and video id are stored.
// The URLs sent to clients are rebuilt from those, so an arbitrary link (or a javascript: URL)
// can never end up in a page or an <iframe>.

const YOUTUBE_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com',
  'youtube-nocookie.com', 'www.youtube-nocookie.com',
]);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{5,12}$/;
const VIMEO_HASH = /^[0-9a-f]{6,20}$/i;

const youtube = (id) => (YOUTUBE_ID.test(id || '') ? { provider: 'youtube', videoId: id } : null);

function vimeo(id, hash) {
  if (!VIMEO_ID.test(id || '')) return null;
  return { provider: 'vimeo', videoId: id, ...(VIMEO_HASH.test(hash || '') ? { hash } : {}) };
}

/** Returns { provider, videoId, hash? } for a supported video link, otherwise null. */
function parseVideoUrl(input) {
  if (typeof input !== 'string' || input.length > 300) return null;

  let url;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password) return null;

  // exact host match: "youtube.com.evil.com" or "evil.com/youtube.com" never qualifies
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') return youtube(segments[0]);

  if (YOUTUBE_HOSTS.has(host)) {
    if (segments[0] === 'watch') return youtube(url.searchParams.get('v'));
    if (['embed', 'shorts', 'live', 'v'].includes(segments[0])) return youtube(segments[1]);
    return null;
  }

  if (VIMEO_HOSTS.has(host)) {
    // vimeo.com/123456789, vimeo.com/123456789/abcdef1234 (unlisted) or player.vimeo.com/video/123456789?h=abcdef1234
    if (host === 'player.vimeo.com') {
      return segments[0] === 'video' ? vimeo(segments[1], url.searchParams.get('h')) : null;
    }
    return vimeo(segments[0], segments[1]);
  }

  return null;
}

/** Safe watch and embed URLs, built only from values that already passed the patterns above. */
function videoLinks({ provider, videoId, hash }) {
  if (provider === 'youtube') {
    return {
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`, // the privacy-friendly embed domain
    };
  }
  return {
    watchUrl: `https://vimeo.com/${videoId}${hash ? `/${hash}` : ''}`,
    embedUrl: `https://player.vimeo.com/video/${videoId}${hash ? `?h=${hash}` : ''}`,
  };
}

module.exports = { parseVideoUrl, videoLinks };