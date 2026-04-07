/**
 * Page parser — runs inside page.evaluate() in Puppeteer.
 * Extracts: DJs, tracks (with cue times + mediaIds), recordings, set metadata.
 *
 * Consolidated from 6 duplicate copies across the old scrapers.
 */

async function parsePage(page) {
  return page.evaluate(() => {

    // ── DJs from h1 ──────────────────────────────────────────────
    const h1 = document.querySelector('h1');
    const djs = h1
      ? Array.from(h1.querySelectorAll('a[href*="/dj/"]')).map(a => ({
          name: a.textContent.trim(),
          slug: (a.getAttribute('href').match(/\/dj\/([^/]+)\//) || [])[1] || ''
        }))
      : [];

    // ── Set-level recordings ─────────────────────────────────────
    const SOURCE_MAP = {
      '10': 'soundcloud', '13': 'youtube', '18': 'youtube',
      '28': 'spotify', '40': 'hearthis', '52': 'mixcloud',
    };

    const recordings = [];
    document.querySelectorAll('[data-idmedia][data-idsource]').forEach(el => {
      const idMedia = el.getAttribute('data-idmedia');
      const idSource = el.getAttribute('data-idsource');
      const platform = SOURCE_MAP[idSource] || `source_${idSource}`;
      const iframeSrc = el.querySelector('iframe')?.getAttribute('src') || '';

      let url = iframeSrc;
      const scMatch = iframeSrc.match(/url=([^&]+)/);
      if (scMatch) { try { url = decodeURIComponent(scMatch[1]); } catch { url = scMatch[1]; } }
      const ytMatch = iframeSrc.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (ytMatch) url = `https://www.youtube.com/watch?v=${ytMatch[1]}`;
      const mcMatch = iframeSrc.match(/mixcloud\.com%2F([^%&"]+)/i);
      if (mcMatch) url = `https://www.mixcloud.com/${decodeURIComponent(mcMatch[1])}`;
      const htMatch = iframeSrc.match(/hearthis\.at\/embed\/(\d+)/);
      if (htMatch) url = `https://hearthis.at/${htMatch[1]}/`;

      if (idMedia && idSource) {
        recordings.push({ platform, idMedia, idSource, url: url || iframeSrc });
      }
    });

    // ── Per-track media IDs (internal 1001TL IDs for later resolution) ──
    function parseMediaIds(el) {
      const ICONS = {
        spotify:    'fa-spotify',
        youtube:    'fa-video-camera',
        soundcloud: 'fa-soundcloud',
        appleMusic: 'fa-apple',
        bandcamp:   'fa-bandcamp',
      };
      const ids = {};
      for (const [platform, cls] of Object.entries(ICONS)) {
        const btn = el.querySelector(`.mAction.${cls},.${cls}.mAction`);
        if (!btn) continue;
        const m = (btn.getAttribute('onclick') || '').match(/idItem:\s*(\d+)/);
        if (m) ids[platform] = m[1];
      }
      return Object.keys(ids).length ? ids : null;
    }

    // ── Cue time parser ──────────────────────────────────────────
    function parseCueTime(text) {
      if (!text) return null;
      const parts = text.split(':').map(Number);
      if (parts.some(isNaN)) return null;
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      return null;
    }

    // ── Tracks ───────────────────────────────────────────────────
    const raw = Array.from(document.querySelectorAll('.tlpItem')).map(el => {
      const cls = el.className;
      const full = (el.querySelector('.trackValue')?.textContent || '').trim();
      if (!full) return null;

      const di = full.indexOf(' - ');
      const rowM = cls.match(/trRow(\d+)/);

      // Cue time from .cueVal element
      const cueText = el.querySelector('.cueVal')?.textContent?.trim() || '';

      return {
        pos:      (el.querySelector('.fontXL')?.textContent || '').trim(),
        artist:   di > -1 ? full.substring(0, di).trim() : full,
        title:    di > -1 ? full.substring(di + 3).trim() : '',
        remix:    (el.querySelector('.trackEditData')?.textContent || '').trim(),
        label:    (el.querySelector('.trackLabel,.iBlock.notranslate')?.textContent || '').trim(),
        trackId:  el.getAttribute('data-id') || '',
        row:      rowM ? parseInt(rowM[1]) : null,
        type:     cls.includes('tlpSubTog') ? 'sub' : cls.includes(' con') ? 'blend' : 'normal',
        cueTime:  parseCueTime(cueText),
        mediaIds: parseMediaIds(el),
      };
    }).filter(t => t && (t.artist || t.title) && t.type !== 'sub');

    // Group blend tracks onto parent
    const tracks = [];
    for (const t of raw) {
      if (t.type === 'normal') {
        tracks.push({ ...t, blendGroup: null });
      } else if (t.type === 'blend') {
        const parent = tracks[tracks.length - 1];
        if (parent) {
          if (!parent.blendGroup) parent.blendGroup = [{
            artist: parent.artist, title: parent.title,
            remix: parent.remix, trackId: parent.trackId,
          }];
          parent.blendGroup.push({
            artist: t.artist, title: t.title,
            remix: t.remix, trackId: t.trackId,
          });
          tracks.push({ ...t });
        }
      }
    }

    // ── Set metadata from page header ────────────────────────────
    let tracksIdentified = 0, tracksTotal = 0;
    const idText = document.querySelector('.cValueCnt')?.textContent || '';
    const idMatch = idText.match(/(\d+)\s*\/\s*(\d+)/);
    if (idMatch) {
      tracksIdentified = parseInt(idMatch[1]);
      tracksTotal = parseInt(idMatch[2]);
    }

    // Duration
    const durationEls = document.querySelectorAll('.cValue');
    let duration = '';
    for (const el of durationEls) {
      const text = el.textContent.trim();
      if (text.match(/\d+[hm]/)) { duration = text; break; }
    }

    // Genre
    const genreEl = document.querySelector('a[href*="/genre/"]');
    const genre = genreEl?.textContent?.trim() || '';

    // Stage from page
    const stageEl = document.querySelector('.stage a, a[href*="/source/"]');
    const stageName = stageEl?.textContent?.trim() || '';

    // Page title for newly discovered sets
    const pageTitle = document.querySelector('h1')?.textContent?.trim() || '';

    return {
      djs,
      tracks,
      recordings,
      meta: {
        tracksIdentified,
        tracksTotal,
        duration,
        genre,
        stageName,
        pageTitle,
      },
    };
  });
}

module.exports = { parsePage };
