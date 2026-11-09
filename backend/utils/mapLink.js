/**
 * Google Maps share link -> embeddable map.
 *
 * The admin only pastes the normal "Share" link from Google Maps
 * (https://maps.app.goo.gl/... or https://www.google.com/maps/place/...).
 * We follow the short link to the full URL, read the shop's coordinates and
 * build a map URL that can be shown inside the website (no API key needed).
 */

// Only Google Maps hosts are ever fetched (the server never follows other URLs)
const GOOGLE_MAPS_HOST = /^(maps\.app\.goo\.gl|goo\.gl|maps\.google\.[a-z.]+|(www\.)?google\.[a-z.]+)$/i;

/** True for https Google Maps links */
const isGoogleMapsLink = (value) => {
  try {
    const url = new URL(String(value).trim());
    if (url.protocol !== 'https:' || !GOOGLE_MAPS_HOST.test(url.hostname)) return false;
    return /goo\.gl$/i.test(url.hostname) || url.pathname.startsWith('/maps') || url.hostname.startsWith('maps.');
  } catch {
    return false;
  }
};

// Most precise first: the place pin (!3d..!4d..), then the map centre (@lat,lng), then ?q=lat,lng
const COORDINATE_PATTERNS = [
  /!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
  /@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
  /[?&](?:q|ll|query|destination)=(-?\d{1,2}(?:\.\d+)?)(?:,|%2C)\s*(-?\d{1,3}(?:\.\d+)?)/i,
];

const extractCoordinates = (url) => {
  for (const pattern of COORDINATE_PATTERNS) {
    const match = pattern.exec(url);
    if (match) {
      const lat = Number(match[1]);
      const lng = Number(match[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
};

/** Map that can be shown in an <iframe> (zoom 17 = street level) */
const embedUrlFor = ({ lat, lng }) => `https://maps.google.com/maps?q=${lat},${lng}&z=17&hl=en&output=embed`;

/**
 * Resolve a Google Maps link to an embed URL. Returns null when the link
 * cannot be resolved (offline, unknown format) - the caller keeps the old map.
 */
const resolveMapEmbed = async (link) => {
  if (!isGoogleMapsLink(link)) return null;
  let url = String(link).trim();

  for (let hop = 0; hop < 5; hop += 1) {
    const coordinates = extractCoordinates(url);
    if (coordinates) return embedUrlFor(coordinates);

    let response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' },
      });
    } catch (err) {
      console.warn(`[maps] Could not open the map link: ${err.message}`);
      return null;
    }
    const next = response.headers.get('location');
    if (!next) break;
    url = new URL(next, url).toString();
    if (!isGoogleMapsLink(url) && !/google\./i.test(new URL(url).hostname)) break; // stay on Google
  }

  const coordinates = extractCoordinates(url);
  return coordinates ? embedUrlFor(coordinates) : null;
};

module.exports = { isGoogleMapsLink, extractCoordinates, resolveMapEmbed };
