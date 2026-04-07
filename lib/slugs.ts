export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\+/g, 'plus')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function trackSlug(artist: string, title: string): string {
  return `${slugify(artist)}-${slugify(title)}`;
}

// Build a map from slug to internal trackKey for reverse lookups
export function buildTrackSlugMap(trackKeys: string[]): { slugToKey: Map<string, string>; keyToSlug: Map<string, string> } {
  const slugToKey = new Map<string, string>();
  const keyToSlug = new Map<string, string>();

  for (const key of trackKeys) {
    const [artist, title] = key.split('|||');
    if (!artist || !title) continue;

    let slug = trackSlug(artist, title);

    // Handle collisions
    if (slugToKey.has(slug) && slugToKey.get(slug) !== key) {
      let i = 2;
      while (slugToKey.has(`${slug}-${i}`)) i++;
      slug = `${slug}-${i}`;
    }

    slugToKey.set(slug, key);
    keyToSlug.set(key, slug);
  }

  return { slugToKey, keyToSlug };
}
