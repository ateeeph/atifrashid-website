import {
  buildSlugMap,
  escapeHtml,
  formatDate,
  isPublished,
  isValidLinkedInUrl,
  sanitizeHtml
} from '../_utils.js';

const SITE_NAME = 'Atif Rashid';
const LINKEDIN_PROFILE_URL = 'https://www.linkedin.com/in/atif-rashid-21005814';

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const origin = new URL(request.url).origin;

  let posts;
  try {
    posts = await loadPosts(env, request);
  } catch (error) {
    return renderErrorPage(origin);
  }

  let slugParam = '';
  try {
    slugParam = decodeURIComponent(params.slug || '');
  } catch (error) {
    slugParam = params.slug || '';
  }

  const slugMap = buildSlugMap(posts);
  const post = slugMap.get(slugParam.trim().toLowerCase());

  if (!post || !isPublished(post)) {
    return renderNotFoundPage(origin);
  }

  return renderPostPage(post, slugParam.trim().toLowerCase(), origin);
}

async function loadPosts(env, request) {
  const assetUrl = new URL('/data/posts.json', request.url);
  const response = await env.ASSETS.fetch(assetUrl);

  if (!response.ok) {
    throw new Error('Unable to load posts.');
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
}

function getCategories(post) {
  const legacy = typeof post.category === 'string' ? post.category.trim() : '';
  const list = Array.isArray(post.categories)
    ? post.categories.filter((c) => typeof c === 'string').map((c) => c.trim()).filter(Boolean)
    : legacy
      ? [legacy]
      : [];
  return Array.from(new Set(list));
}

function stripTags(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
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

function resolveImageUrl(image, origin) {
  if (!image) {
    return '';
  }
  if (/^https?:\/\//i.test(image)) {
    return image;
  }
  return `${origin}${image.startsWith('/') ? '' : '/'}${image}`;
}

function jsonLdSafe(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function pageShell({ head, headerRight, bodyMain, robotsNoindex }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${robotsNoindex ? '<meta name="robots" content="noindex">' : ''}
    ${head}
    <meta name="theme-color" content="#000000">
    <link rel="icon" href="/favicon.png" sizes="50x50" type="image/png">
    <link rel="stylesheet" href="/assets/css/style.css">
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to content</a>
    <div class="page-shell">
      <header class="site-header">
        <div class="brand-block">
          <p class="eyebrow">ATIF RASHID</p>
          <p class="intro">A curated collection of thoughts, lessons and perspectives.</p>
        </div>
        ${headerRight}
      </header>

      ${bodyMain}

      <footer class="site-footer">
        <p>© <span id="year">${new Date().getUTCFullYear()}</span> Atif Rashid</p>
        <a href="${LINKEDIN_PROFILE_URL}" target="_blank" rel="noopener noreferrer">LinkedIn</a>
      </footer>
    </div>
  </body>
</html>
`;
}

function renderPostPage(post, slug, origin) {
  const title = (typeof post.title === 'string' && post.title.trim()) || 'LinkedIn Post';
  const description = typeof post.description === 'string' ? post.description.trim() : '';
  const rawContent = typeof post.content === 'string' ? post.content.trim() : '';
  const image = typeof post.image === 'string' ? post.image.trim() : '';
  const categories = getCategories(post);
  const formattedDate = formatDate(post.date);
  const rawUrl = typeof post.url === 'string' ? post.url.trim() : '';
  const hasOriginalUrl = isValidLinkedInUrl(rawUrl);

  const canonicalUrl = `${origin}/posts/${slug}`;
  const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(canonicalUrl)}`;
  const absoluteImage = resolveImageUrl(image, origin);

  const metaDescription =
    description || (rawContent ? stripTags(rawContent).slice(0, 155) : '') || `A post by ${SITE_NAME}.`;

  const contentHtml = rawContent
    ? sanitizeHtml(rawContent)
    : description
      ? textToHtml(description)
      : '<p>No additional content has been added for this post yet.</p>';

  const head = `
    <title>${escapeHtml(title)} | ${SITE_NAME}</title>
    <meta name="description" content="${escapeHtml(metaDescription)}">
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(metaDescription)}">
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
    ${absoluteImage ? `<meta property="og:image" content="${escapeHtml(absoluteImage)}">` : ''}
    <meta name="twitter:card" content="${absoluteImage ? 'summary_large_image' : 'summary'}">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(metaDescription)}">`;

  const headerRight = `<a class="button-link" href="/">← Back to Posts</a>`;

  const metaBadges = [
    ...categories.map((c) => `<span class="post-badge">${escapeHtml(c)}</span>`),
    formattedDate ? `<time class="post-badge" datetime="${escapeHtml(String(post.date || ''))}">${escapeHtml(formattedDate)}</time>` : ''
  ].filter(Boolean).join('\n            ');

  const heroImage = image
    ? `<div class="post-hero"><img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy"></div>`
    : '';

  const originalLinkedInLink = hasOriginalUrl
    ? `<a class="button-link" href="${escapeHtml(rawUrl)}" target="_blank" rel="noopener noreferrer">View original LinkedIn post</a>`
    : '';

  const jsonLd = jsonLdSafe({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description: metaDescription,
    ...(absoluteImage ? { image: [absoluteImage] } : {}),
    author: { '@type': 'Person', name: SITE_NAME, url: `${origin}/` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl }
  });

  const bodyMain = `<main id="main-content">
        <article class="content-section post-detail">
          <div class="post-meta">
            ${metaBadges}
          </div>
          <h1>${escapeHtml(title)}</h1>
          ${heroImage}
          <div class="post-content">
            ${contentHtml}
          </div>
          <div class="post-actions">
            ${originalLinkedInLink}
            <a class="button-link" href="${escapeHtml(shareUrl)}" target="_blank" rel="noopener noreferrer">Share on LinkedIn</a>
          </div>
          <a class="button-link post-back-link" href="/">← Back to Posts</a>
        </article>
      </main>`;

  const html = pageShell({ head, headerRight, bodyMain, robotsNoindex: false });
  const withJsonLd = html.replace(
    '</head>',
    `  <script type="application/ld+json">${jsonLd}</script>\n  </head>`
  );

  return new Response(withJsonLd, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60'
    }
  });
}

function renderNotFoundPage(origin) {
  const head = `
    <title>Post not found | ${SITE_NAME}</title>
    <meta name="description" content="The post you requested could not be found.">
    <link rel="canonical" href="${escapeHtml(origin)}/">`;

  const bodyMain = `<main id="main-content" class="error-page">
        <div class="error-card">
          <p class="eyebrow">404</p>
          <h1>Post not found</h1>
          <p>This post doesn't exist, hasn't been published yet, or the link may be incorrect.</p>
          <a class="button-link" href="/">← Back to Posts</a>
        </div>
      </main>`;

  const html = pageShell({ head, headerRight: '', bodyMain, robotsNoindex: true });

  return new Response(html, {
    status: 404,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function renderErrorPage(origin) {
  const head = `
    <title>Something went wrong | ${SITE_NAME}</title>
    <meta name="description" content="This post could not be loaded right now.">
    <link rel="canonical" href="${escapeHtml(origin)}/">`;

  const bodyMain = `<main id="main-content" class="error-page">
        <div class="error-card">
          <p class="eyebrow">Error</p>
          <h1>This post couldn't be loaded</h1>
          <p>Something went wrong while loading this post. Please try again shortly.</p>
          <a class="button-link" href="/">← Back to Posts</a>
        </div>
      </main>`;

  const html = pageShell({ head, headerRight: '', bodyMain, robotsNoindex: true });

  return new Response(html, {
    status: 500,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}
