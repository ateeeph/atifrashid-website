export function slugify(input) {
  return (
    String(input || '')
      .toLowerCase()
      .trim()
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 96) || 'post'
  );
}

export function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BLOCKED_TAG_PAIRS = ['script', 'style', 'iframe', 'object', 'embed', 'form'];
const VOID_BLOCKED_TAGS = ['link', 'meta', 'base'];

// Lightweight hardening for trusted-author HTML coming out of the CMS's rich-text
// editor. This is not a general-purpose sanitizer for untrusted/public input.
export function sanitizeHtml(html) {
  let output = String(html || '');

  for (const tag of BLOCKED_TAG_PAIRS) {
    output = output.replace(new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), '');
  }

  for (const tag of VOID_BLOCKED_TAGS) {
    output = output.replace(new RegExp(`<${tag}[^>]*>`, 'gi'), '');
  }

  // Strip inline event handler attributes (onclick, onerror, etc).
  output = output.replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '');

  // Neutralize javascript:/data: URIs in href/src attributes.
  output = output.replace(
    /(href|src)\s*=\s*(["'])\s*(javascript:|data:text\/html)[^"']*\2/gi,
    '$1="#"'
  );

  return output.trim();
}

export function parseDate(value) {
  if (!value) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  const dmy = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value) {
  const parsed = parseDate(value);
  if (!parsed) {
    return '';
  }

  return parsed.toLocaleDateString('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

export function isValidLinkedInUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'linkedin.com' || parsed.hostname === 'www.linkedin.com')
    );
  } catch (error) {
    return false;
  }
}

// Builds the same slug -> post map used by the homepage listing, so a post's URL
// stays stable regardless of sort order, filters, or publish status changes.
export function buildSlugMap(posts) {
  const seenSlugs = new Set();
  const map = new Map();

  posts.forEach((post, index) => {
    if (!post || typeof post !== 'object') {
      return;
    }

    const explicitSlug = typeof post.slug === 'string' ? post.slug.trim() : '';
    const base = slugify(explicitSlug || post.title || post.id || `post-${index + 1}`);

    let uniqueSlug = base;
    let suffix = 2;
    while (seenSlugs.has(uniqueSlug)) {
      uniqueSlug = `${base}-${suffix}`;
      suffix += 1;
    }
    seenSlugs.add(uniqueSlug);

    map.set(uniqueSlug, post);
  });

  return map;
}

export function isPublished(post) {
  const status = typeof post.status === 'string' ? post.status.trim().toLowerCase() : '';
  // Legacy posts created before the status field existed are treated as published.
  return status !== 'draft';
}
