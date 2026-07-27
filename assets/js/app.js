const state = {
  posts: [],
  visiblePosts: [],
  featuredPosts: [],
  categories: [],
  activeCategory: 'All',
  searchQuery: ''
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
  fetchPostsOnce().then((posts) => {
    state.posts = posts;
    render();
  }).catch((error) => {
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

      const payload = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error('The post data format is invalid.');
      }

      seenIds.clear();
      const validPosts = payload
        .map((post, index) => validateRecord(post, index))
        .filter(Boolean);

      return validPosts;
    });

  return postsPromise;
}

function validateRecord(record, index) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const description = typeof record.description === 'string' ? record.description.trim() : '';
  const category = typeof record.category === 'string' ? record.category.trim() : '';
  const rawUrl = typeof record.url === 'string' ? record.url.trim() : '';
  const rawDate = typeof record.date === 'string' ? record.date.trim() : '';
  const featured = record.featured === true;

  if (!rawUrl || !isValidLinkedInUrl(rawUrl)) {
    return null;
  }

  const validUrl = isValidLinkedInUrl(rawUrl) ? rawUrl : null;
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
    title: title || 'LinkedIn Post',
    url: rawUrl,
    safeUrl: validUrl,
    date: rawDate,
    parsedDate,
    description,
    category,
    featured,
    hasValidUrl: Boolean(validUrl)
  };
}

function isValidLinkedInUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && (parsed.hostname === 'linkedin.com' || parsed.hostname === 'www.linkedin.com');
  } catch (error) {
    return false;
  }
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
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
    day: 'numeric'
  });
}

function collectCategories(posts) {
  const categories = posts.map((post) => post.category.trim()).filter(Boolean);
  return Array.from(new Set(categories)).sort((a, b) => a.localeCompare(b));
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

  const meta = document.createElement('div');
  meta.className = 'post-meta';

  if (post.category) {
    const category = document.createElement('span');
    category.className = 'post-badge';
    category.textContent = post.category;
    meta.appendChild(category);
  }

  const formattedDate = formatDate(post.date);
  if (formattedDate) {
    const date = document.createElement('time');
    date.dateTime = post.date;
    date.textContent = formattedDate;
    date.className = 'post-badge';
    meta.appendChild(date);
  }

  article.appendChild(meta);

  const title = document.createElement('h3');
  title.textContent = post.title;
  article.appendChild(title);

  if (post.description) {
    const description = document.createElement('p');
    description.className = 'post-description';
    description.textContent = post.description;
    article.appendChild(description);
  }

  const link = post.hasValidUrl
    ? createLink(post.safeUrl)
    : createDisabledLink();
  article.appendChild(link);

  return article;
}

function createLink(href) {
  const anchor = document.createElement('a');
  anchor.className = 'post-link';
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.textContent = 'View on LinkedIn';
  return anchor;
}

function createDisabledLink() {
  const span = document.createElement('span');
  span.className = 'post-link-disabled';
  span.textContent = 'LinkedIn link unavailable';
  return span;
}

function render() {
  const queryResults = searchPosts(state.posts, state.searchQuery);
  const categoryResults = filterPosts(queryResults, state.activeCategory);
  const sortedPosts = sortPosts(categoryResults);

  state.visiblePosts = sortedPosts;
  state.categories = collectCategories(state.posts);

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
    const haystack = `${post.title} ${post.description} ${post.category}`.toLowerCase();
    return haystack.includes(trimmedQuery);
  });
}

function filterPosts(posts, category) {
  if (category === 'All') {
    return posts;
  }

  return posts.filter((post) => post.category === category);
}

function toggleStateViews(postCount) {
  const showLoading = !state.posts.length && !state.visiblePosts.length;
  elements.loading.hidden = !showLoading;
  elements.error.hidden = true;
  elements.empty.hidden = postCount > 0 || state.posts.length > 0;
  elements.noResults.hidden = postCount > 0 || !state.searchQuery;
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
