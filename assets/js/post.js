const elements = {
  loading: document.getElementById('loading-state'),
  notFound: document.getElementById('not-found-state'),
  detail: document.getElementById('post-detail'),
  meta: document.getElementById('post-meta'),
  title: document.getElementById('post-title'),
  imageWrap: document.getElementById('post-image-wrap'),
  image: document.getElementById('post-image'),
  content: document.getElementById('post-content'),
  linkedinLink: document.getElementById('post-linkedin-link'),
  year: document.getElementById('year')
};

function init() {
  if (elements.year) {
    elements.year.textContent = new Date().getFullYear();
  }

  const params = new URLSearchParams(window.location.search);
  const postId = params.get('id');

  if (!postId) {
    showNotFound();
    return;
  }

  fetch('data/posts.json', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error('Unable to load post data.');
      }

      const rawContent = await response.text();
      if (!rawContent.trim()) {
        return [];
      }

      const payload = JSON.parse(rawContent);
      if (!Array.isArray(payload)) {
        throw new Error('Invalid post data.');
      }

      return payload;
    })
    .then((posts) => {
      const record = posts.find((post) => post && typeof post === 'object' && post.id === postId);

      if (!record || !isPublished(record)) {
        showNotFound();
        return;
      }

      renderPost(record);
    })
    .catch(() => {
      showNotFound();
    });
}

function isPublished(record) {
  const status = typeof record.status === 'string' ? record.status.trim().toLowerCase() : '';
  // Legacy posts created before the status field existed are treated as published.
  return status !== 'draft';
}

function getCategories(record) {
  const legacy = typeof record.category === 'string' ? record.category.trim() : '';
  const list = Array.isArray(record.categories)
    ? record.categories.filter((c) => typeof c === 'string').map((c) => c.trim()).filter(Boolean)
    : legacy
      ? [legacy]
      : [];
  return Array.from(new Set(list));
}

function parseDate(value) {
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

function formatDate(value) {
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

function isValidLinkedInUrl(value) {
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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textToHtml(text) {
  const paragraphs = String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return paragraphs
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

const BLOCKED_TAG_PAIRS = ['script', 'style', 'iframe', 'object', 'embed', 'form'];
const VOID_BLOCKED_TAGS = ['link', 'meta', 'base'];

// Lightweight hardening for trusted-author HTML coming out of the CMS's rich-text
// editor. This is not a general-purpose sanitizer for untrusted/public input.
function sanitizeHtml(html) {
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

function renderPost(record) {
  const title = (typeof record.title === 'string' && record.title.trim()) || 'LinkedIn Post';
  const description = typeof record.description === 'string' ? record.description.trim() : '';
  const fullDescription =
    typeof record.full_description === 'string' ? record.full_description.trim() : '';
  const image = typeof record.image === 'string' ? record.image.trim() : '';
  const rawUrl = typeof record.url === 'string' ? record.url.trim() : '';
  const categories = getCategories(record);
  const formattedDate = formatDate(record.date);

  document.title = `${title} | Atif Rashid`;

  elements.meta.replaceChildren();
  categories.forEach((categoryName) => {
    const badge = document.createElement('span');
    badge.className = 'post-badge';
    badge.textContent = categoryName;
    elements.meta.appendChild(badge);
  });
  if (formattedDate) {
    const date = document.createElement('time');
    date.dateTime = typeof record.date === 'string' ? record.date : '';
    date.textContent = formattedDate;
    date.className = 'post-badge';
    elements.meta.appendChild(date);
  }

  elements.title.textContent = title;

  if (image) {
    elements.image.src = image;
    elements.image.alt = title;
    elements.imageWrap.hidden = false;
  } else {
    elements.imageWrap.hidden = true;
  }

  elements.content.innerHTML = fullDescription
    ? sanitizeHtml(fullDescription)
    : description
      ? textToHtml(description)
      : '<p>No additional content has been added for this post yet.</p>';

  if (isValidLinkedInUrl(rawUrl)) {
    elements.linkedinLink.href = rawUrl;
    elements.linkedinLink.hidden = false;
  } else {
    elements.linkedinLink.hidden = true;
  }

  elements.loading.hidden = true;
  elements.notFound.hidden = true;
  elements.detail.hidden = false;
}

function showNotFound() {
  elements.loading.hidden = true;
  elements.detail.hidden = true;
  elements.notFound.hidden = false;
}

document.addEventListener('DOMContentLoaded', init);
