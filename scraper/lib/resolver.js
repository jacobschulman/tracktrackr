/**
 * Phase 2: Resolve internal 1001TL track IDs to actual platform IDs.
 *
 * Calls GET /ajax/get_medialink.php (not behind Cloudflare).
 * Returns real Spotify track IDs, Apple Music IDs, YouTube video IDs, etc.
 */

const axios = require('axios');
const pLimit = require('p-limit');
const { sleep } = require('./utils');

const MEDIALINK_URL = 'https://www.1001tracklists.com/ajax/get_medialink.php';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Referer': 'https://www.1001tracklists.com/',
};

/**
 * Resolve a single track's internal ID to platform IDs.
 * @param {string} idItem - The internal 1001TL track item ID
 * @returns {object} platformIds - { spotify?, appleMusic?, youtube?, soundcloud?, bandcamp? }
 */
async function resolveTrackId(idItem) {
  const platformIds = {};

  try {
    // Main call — returns Spotify, Apple Music, Beatport, Traxsource
    const resp = await axios.get(MEDIALINK_URL, {
      params: { idObject: 5, idItem },
      headers: HEADERS,
      timeout: 10000,
    });

    if (resp.data?.success && resp.data?.data) {
      for (const entry of resp.data.data) {
        const src = String(entry.idSource);
        const pid = entry.playerId;
        if (!pid) continue;

        if (src === '36') platformIds.spotify = pid;       // Spotify track ID
        else if (src === '2') platformIds.appleMusic = pid; // Apple Music
        else if (src === '1') platformIds.beatport = pid;   // Beatport
        else if (src === '4') platformIds.traxsource = pid; // Traxsource
      }
    }
  } catch { /* ignore individual failures */ }

  try {
    // YouTube needs separate call with idSource=13
    const ytResp = await axios.get(MEDIALINK_URL, {
      params: { idObject: 5, idItem, idSource: 13 },
      headers: HEADERS,
      timeout: 10000,
    });

    if (ytResp.data?.success && ytResp.data?.data) {
      for (const entry of ytResp.data.data) {
        if (entry.playerId) {
          platformIds.youtube = entry.playerId;
          break;
        }
      }
    }
  } catch { /* ignore */ }

  try {
    // SoundCloud needs idSource=10
    const scResp = await axios.get(MEDIALINK_URL, {
      params: { idObject: 5, idItem, idSource: 10 },
      headers: HEADERS,
      timeout: 10000,
    });

    if (scResp.data?.success && scResp.data?.data) {
      for (const entry of scResp.data.data) {
        if (entry.playerId) {
          platformIds.soundcloud = entry.playerId;
          break;
        }
      }
    }
  } catch { /* ignore */ }

  return Object.keys(platformIds).length ? platformIds : null;
}

/**
 * Resolve all tracks in a set that have mediaIds.
 * @param {Array} tracks - Array of track objects with mediaIds field
 * @param {object} opts - { concurrency, delayMs, log }
 * @returns {Array} tracks with platformIds field added
 */
async function resolveTracks(tracks, { concurrency = 5, delayMs = 200, log } = {}) {
  const limit = pLimit(concurrency);
  let resolved = 0;
  let total = 0;

  // Collect unique idItems — different platforms may share the same idItem for a track
  const trackJobs = tracks.map((track, idx) => {
    if (!track.mediaIds) return null;
    // Use any available idItem (they should all be the same per track)
    const idItem = track.mediaIds.spotify || track.mediaIds.youtube ||
                   track.mediaIds.soundcloud || track.mediaIds.appleMusic ||
                   track.mediaIds.bandcamp;
    if (!idItem) return null;
    total++;
    return { idx, idItem };
  }).filter(Boolean);

  if (total === 0) return tracks;

  const results = await Promise.all(
    trackJobs.map(({ idx, idItem }) => limit(async () => {
      const platformIds = await resolveTrackId(idItem);
      resolved++;
      if (log && resolved % 10 === 0) {
        log.info(`  Resolved ${resolved}/${total} tracks`);
      }
      await sleep(delayMs);
      return { idx, platformIds };
    }))
  );

  // Apply results
  const enriched = [...tracks];
  for (const { idx, platformIds } of results) {
    if (platformIds) {
      enriched[idx] = { ...enriched[idx], platformIds };
    }
  }

  if (log) log.ok(`  Resolved ${resolved} tracks → ${results.filter(r => r.platformIds).length} with platform IDs`);
  return enriched;
}

module.exports = { resolveTrackId, resolveTracks };
