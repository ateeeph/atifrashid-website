const state = {
  posts: [],
  visiblePosts: [],
  featuredPosts: [],
  categories: [],
  activeCategory: 'All',
  searchQuery: '',
  hasLoaded: false
};

const seenIds = new Set();
let postsPromise;

const elements = {
  loading: document.getElementById('loading-state'),
  error: document.getElementById('error-state'),
  empty: document.getElementById('empty-state'),
  noResults: document.getElementById('no-search-results'),
  posts: document.getElementById('post-list'),
  featured: document.getElementById('featured-posts'),
  featuredSection: document.getElementById('featured-section'),
  filters: document.getElementById('category-filters'),
  search: document.getElementById('search-input'),
  year: document.getElementById('year')
};

function init() {
  if (elements.year) {
    elements.year.textContent = new Date().getFullYear();
  }

  if (elements.search) {
    elements.search.addEventListener('input', (event) => {
      state.searchQuery = event.target.value.trim().toLowerCase();
      render();
    });
  }

  renderLoadingState();

  fetchPostsOnce()
    .then((posts) => {
      state.posts = posts;
      state.hasLoaded = true;
      render();
    })
    .catch((error) => {
      state.hasLoaded = true;
      renderErrorState(error.message);
    });
}

function fetchPostsOnce() {
  if (postsPromise) {
    return postsPromise;
  }

  postsPromise = fetch('data/posts.json', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error('Unable to load posts.');
      }

      const rawContent = await response.text();

      // Pages CMS may leave the file empty after deleting the final post.
      if (!rawContent.trim()) {
        seenIds.clear();
        return [];
      }

      let payload;

      try {
        payload = JSON.parse(rawContent);
      } catch (error) {
        throw new Error('The post data format is invalid.');
      }

      if (!Array.isArray(payload)) {
        throw new Error('The post data format is invalid.');
      }

      seenIds.clear();

      // Slugs are computed from the raw, unfiltered array so a post's URL stays
      // stable regardless of publish status, sort order, or search/filter state.
      const slugs = computeSlugs(payload);

      return payload
        .map((post, index) => validateRecord(post, index, slugs[index]))
        .filter(Boolean)
        .filter((post) => post.published);
    });

  return postsPromise;
}

function slugify(input) {
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

function computeSlugs(rawPosts) {
  const seenSlugs = new Set();

  return rawPosts.map((record, index) => {
    if (!record || typeof record !== 'object') {
      return '';
    }

    const explicitSlug = typeof record.slug === 'string' ? record.slug.trim() : '';
    const base = slugify(explicitSlug || record.title || record.id || `post-${index + 1}`);

    let uniqueSlug = base;
    let suffix = 2;

    while (seenSlugs.has(uniqueSlug)) {
      uniqueSlug = `${base}-${suffix}`;
      suffix += 1;
    }
    seenSlugs.add(uniqueSlug);

    return uniqueSlug;
  });
}

function validateRecord(record, index, slug) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const description = typeof record.description === 'string' ? record.description.trim() : '';
  const legacyCategory =
    typeof record.category === 'string'
      ? record.category.trim()
      : '';

  const categories = Array.isArray(record.categories)
    ? record.categories
        .filter((category) => typeof category === 'string')
        .map((category) => category.trim())
        .filter(Boolean)
    : legacyCategory
      ? [legacyCategory]
      : [];

  const uniqueCategories = Array.from(new Set(categories));
  const rawDate = typeof record.date === 'string' ? record.date.trim() : '';
  const featured = record.featured === true;
  const image = typeof record.image === 'string' ? record.image.trim() : '';
  const status = typeof record.status === 'string' ? record.status.trim().toLowerCase() : '';

  const parsedDate = parseDate(rawDate);
  const idBase = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : `post-${index + 1}`;
  let uniqueId = idBase;
  let suffix = 2;

  while (seenIds.has(uniqueId)) {
    uniqueId = `${idBase}-${suffix}`;
    suffix += 1;
  }
  seenIds.add(uniqueId);

  return {
    id: uniqueId,
    slug,
    title: title || 'LinkedIn Post',
    date: rawDate,
    parsedDate,
    description,
    image,
    categories: uniqueCategories,
    featured,
    // Legacy posts created before the status field existed are treated as published.
    published: status !== 'draft'
  };
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

function sortPosts(posts) {
  return posts.slice().sort((a, b) => {
    const aDate = a.parsedDate ? a.parsedDate.getTime() : null;
    const bDate = b.parsedDate ? b.parsedDate.getTime() : null;

    if (aDate && bDate) {
      return bDate - aDate;
    }

    if (aDate && !bDate) {
      return -1;
    }

    if (!aDate && bDate) {
      return 1;
    }

    return 0;
  });
}

function formatDate(value) {
  if (!value) {
    return '';
  }

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

function collectCategories(posts) {
  const categories = posts
    .flatMap((post) => post.categories || [])
    .map((category) => category.trim())
    .filter(Boolean);

  return Array.from(new Set(categories))
    .sort((a, b) => a.localeCompare(b));
}

function renderCategoryFilters(categories, activeCategory) {
  if (!elements.filters) {
    return;
  }

  elements.filters.replaceChildren();
  const allButton = document.createElement('button');
  allButton.type = 'button';
  allButton.className = 'filter-button';
  allButton.textContent = 'All';
  allButton.setAttribute('aria-pressed', String(activeCategory === 'All'));
  allButton.addEventListener('click', () => {
    state.activeCategory = 'All';
    render();
  });
  elements.filters.appendChild(allButton);

  categories.forEach((category) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-button';
    button.textContent = category;
    button.setAttribute('aria-pressed', String(activeCategory === category));
    button.addEventListener('click', () => {
      state.activeCategory = category;
      render();
    });
    elements.filters.appendChild(button);
  });
}

function renderFeaturedPosts(posts) {
  if (!elements.featured || !elements.featuredSection) {
    return;
  }

  const featuredPosts = posts.filter((post) => post.featured);
  if (!featuredPosts.length) {
    elements.featuredSection.hidden = true;
    elements.featured.replaceChildren();
    return;
  }

  elements.featuredSection.hidden = false;
  elements.featured.replaceChildren();
  featuredPosts.forEach((post) => {
    elements.featured.appendChild(createPostCard(post));
  });
}

function renderNormalPosts(posts) {
  if (!elements.posts) {
    return;
  }

  elements.posts.replaceChildren();
  const normalPosts = posts.filter((post) => !post.featured);
  normalPosts.forEach((post) => {
    elements.posts.appendChild(createPostCard(post));
  });
}

function createPostCard(post) {
  const article = document.createElement('article');
  article.className = 'post-card';

  const link = document.createElement('a');
  link.className = 'post-card-link';
  link.href = `/posts/${encodeURIComponent(post.slug)}`;

  if (post.image) {
    const thumb = document.createElement('div');
    thumb.className = 'post-thumb';
    const img = document.createElement('img');
    img.src = post.image;
    img.alt = post.title;
    img.loading = 'lazy';
    thumb.appendChild(img);
    link.appendChild(thumb);
  }

  const meta = document.createElement('div');
  meta.className = 'post-meta';

  post.categories.forEach((categoryName) => {
    const category = document.createElement('span');
    category.className = 'post-badge';
    category.textContent = categoryName;
    meta.appendChild(category);
  });

  const formattedDate = formatDate(post.date);
  if (formattedDate) {
    const date = document.createElement('time');
    date.dateTime = post.date;
    date.textContent = formattedDate;
    date.className = 'post-badge';
    meta.appendChild(date);
  }

  link.appendChild(meta);

  const title = document.createElement('h3');
  title.textContent = post.title;
  link.appendChild(title);

  if (post.description) {
    const description = document.createElement('p');
    description.className = 'post-description';
    description.textContent = post.description;
    link.appendChild(description);
  }

  article.appendChild(link);

  return article;
}

function render() {
  state.categories = collectCategories(state.posts);

  // Reset a previously selected category if it no longer exists.
  if (
    state.activeCategory !== 'All' &&
    !state.categories.includes(state.activeCategory)
  ) {
    state.activeCategory = 'All';
  }

  const queryResults = searchPosts(state.posts, state.searchQuery);
  const categoryResults = filterPosts(queryResults, state.activeCategory);
  const sortedPosts = sortPosts(categoryResults);

  state.visiblePosts = sortedPosts;

  renderCategoryFilters(state.categories, state.activeCategory);
  renderFeaturedPosts(sortedPosts);
  renderNormalPosts(sortedPosts);

  toggleStateViews(sortedPosts.length);
}

function searchPosts(posts, query) {
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) {
    return posts;
  }

  return posts.filter((post) => {
    const haystack = [
      post.title,
      post.description,
      ...post.categories
    ].join(' ').toLowerCase();
    return haystack.includes(trimmedQuery);
  });
}

function filterPosts(posts, category) {
  if (category === 'All') {
    return posts;
  }

  return posts.filter((post) =>
    post.categories.includes(category)
  );
}

function toggleStateViews(postCount) {
  if (!state.hasLoaded) {
    elements.loading.hidden = false;
    elements.error.hidden = true;
    elements.empty.hidden = true;
    elements.noResults.hidden = true;
    return;
  }

  const hasPosts = state.posts.length > 0;
  const hasVisiblePosts = postCount > 0;
  const isFiltering =
    Boolean(state.searchQuery) || state.activeCategory !== 'All';

  elements.loading.hidden = true;
  elements.error.hidden = true;

  // Show when the CMS contains no posts.
  elements.empty.hidden = hasPosts;

  // Show only when posts exist but none match the current filter/search.
  elements.noResults.hidden =
    !hasPosts || hasVisiblePosts || !isFiltering;
}
function renderLoadingState() {
  if (elements.loading) {
    elements.loading.hidden = false;
  }
  if (elements.error) {
    elements.error.hidden = true;
  }
  if (elements.empty) {
    elements.empty.hidden = true;
  }
  if (elements.noResults) {
    elements.noResults.hidden = true;
  }
}

function renderErrorState(message) {
  if (elements.loading) {
    elements.loading.hidden = true;
  }
  if (elements.error) {
    elements.error.hidden = false;
    elements.error.textContent = message;
  }
  if (elements.empty) {
    elements.empty.hidden = true;
  }
  if (elements.noResults) {
    elements.noResults.hidden = true;
  }
}

document.addEventListener('DOMContentLoaded', init);
