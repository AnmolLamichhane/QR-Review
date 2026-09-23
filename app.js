/**
 * QR Review — App Logic
 * Star ratings, review carousel, clipboard, and Google handoff
 * Powered by Gemini AI review generation (via secure backend proxy)
 */

// ── Configuration ──
const CONFIG = {
  brandName: 'QR Review',
  clipboardPillDuration: 2500,
  toastDuration: 3000
};

// ── Hardcoded Business Data for BP International ──
const currentBusiness = {
  name: 'BP International',
  type: 'wholesale bulk supplier',
  keywords: 'bulk orders only, gifts, decorations, photo frames, flex banners, flower items, handicrafts, crystal frames, stationery',
  googleLink: 'https://g.page/r/Ca4vF4l3aF9sEBM/review'
};

// ── State ──
const state = {
  selectedRating: 0,
  currentIndex: 0,
  reviews: [],
  isGenerating: false,
  isLoadingAI: false
};

// ── DOM References ──
const dom = {
  businessName: document.getElementById('business-name'),
  helperLabel: document.getElementById('helper-label'),
  starRating: document.getElementById('star-rating'),
  starButtons: document.querySelectorAll('.star-btn'),
  reviewSection: document.getElementById('review-section'),
  carouselContent: document.getElementById('carousel-content'),
  suggestionText: document.getElementById('suggestion-text'),
  suggestionCounter: document.getElementById('suggestion-counter'),
  prevBtn: document.getElementById('carousel-prev'),
  nextBtn: document.getElementById('carousel-next'),
  generateLink: document.getElementById('generate-link'),
  textarea: document.getElementById('review-textarea'),
  clipboardPill: document.getElementById('clipboard-pill'),
  ctaButton: document.getElementById('cta-button'),
};

// ── Initialization ──
function parseBusinessData() {
  dom.businessName.textContent = currentBusiness.name;

  dom.helperLabel.textContent = 'Tap a star to get started';
  dom.helperLabel.style.color = '#6b7280';

  dom.starButtons.forEach(btn => {
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
    btn.style.cursor = 'pointer';
  });

  return true;
}

// ── Secure Backend Proxy API ──
/**
 * Fetches AI-generated reviews via the secure Vercel backend.
 * Returns an array of review strings, or a single-element error array on failure.
 */
async function fetchGeminiReviews(rating) {
  try {
    const response = await fetch('/api/generate-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, business: currentBusiness })
    });

    if (!response.ok) {
      console.warn(`[QR Review] Backend error (${response.status})`);
      return ["⚠️ Failed to connect to the AI server. Please try again."];
    }

    const data = await response.json();

    if (!data?.reviews || !Array.isArray(data.reviews) || data.reviews.length === 0) {
      console.warn('[QR Review] Invalid response from backend:', data);
      return ["⚠️ Failed to connect to the AI server. Please try again."];
    }

    const validReviews = data.reviews.filter(r => typeof r === 'string' && r.trim().length > 0);
    if (validReviews.length === 0) {
      console.warn('[QR Review] All reviews were empty after filtering.');
      return ["⚠️ Failed to connect to the AI server. Please try again."];
    }

    console.log(`[QR Review] ✓ Received ${validReviews.length} AI reviews for ${rating}★`);
    return validReviews;

  } catch (err) {
    console.warn('[QR Review] Fetch failed:', err.message);
    return ["⚠️ Failed to connect to the AI server. Please try again."];
  }
}

// ── Loading State Helpers ──
function setLoadingState(isLoading) {
  state.isLoadingAI = isLoading;

  // Toggle shimmer on carousel
  dom.carouselContent.classList.toggle('generating', isLoading);

  // Disable/enable nav buttons
  dom.prevBtn.disabled = isLoading;
  dom.nextBtn.disabled = isLoading;
  dom.prevBtn.classList.toggle('disabled', isLoading);
  dom.nextBtn.classList.toggle('disabled', isLoading);
  dom.generateLink.style.pointerEvents = isLoading ? 'none' : '';

  if (isLoading) {
    dom.suggestionText.textContent = '✨ AI is drafting tailored reviews...';
    dom.suggestionText.classList.add('loading-text');
    dom.suggestionCounter.textContent = '';
    dom.textarea.value = '';
    dom.textarea.placeholder = 'AI is generating your review...';
  } else {
    dom.suggestionText.classList.remove('loading-text');
    dom.textarea.placeholder = 'Edit your review here…';
  }
}

/**
 * Load reviews for a given rating — AI-first with fallback.
 * Returns the array of reviews that were loaded into state.
 */
async function loadReviewsForRating(rating) {
  const clampedRating = Math.max(3, Math.min(5, rating));

  // Fetch AI reviews via secure backend — no fallback
  setLoadingState(true);

  const reviews = await fetchGeminiReviews(clampedRating);

  setLoadingState(false);

  state.reviews = reviews;
  state.currentIndex = 0;
  loadCurrentSuggestion();
  return reviews;
}

// ── Star Rating Logic ──
async function setRating(rating) {
  // Prevent re-triggering while AI is loading
  if (state.isLoadingAI) return;

  state.selectedRating = rating;
  state.currentIndex = 0;

  // Update star visuals
  dom.starButtons.forEach((btn, i) => {
    const starRating = parseInt(btn.dataset.rating);
    btn.classList.toggle('active', starRating <= rating);

    // Trigger ripple on the clicked star
    if (starRating === rating) {
      btn.classList.remove('ripple');
      void btn.offsetWidth;
      btn.classList.add('ripple');
    }
  });

  // Update helper label
  const labels = {
    5: '⭐ Amazing! Here\'s a review for you',
    4: '👍 Great! Here\'s a suggested review',
    3: '📝 Thanks! Here\'s a starter review'
  };
  const clampedRating = Math.max(3, Math.min(5, rating));
  dom.helperLabel.textContent = labels[clampedRating] || 'Here\'s a suggested review';

  // Show review section
  showReviewSection();

  // Load reviews (AI or fallback)
  await loadReviewsForRating(rating);
}

function showReviewSection() {
  const section = dom.reviewSection;
  if (!section.classList.contains('visible')) {
    section.classList.add('visible');
    section.style.animation = 'none';
    void section.offsetWidth;
    section.style.animation = '';
  }
}

// ── Carousel Logic ──
function loadCurrentSuggestion() {
  if (state.reviews.length === 0) return;

  const review = state.reviews[state.currentIndex];

  // Animate text swap
  dom.suggestionText.style.animation = 'none';
  void dom.suggestionText.offsetWidth;
  dom.suggestionText.style.animation = '';

  dom.suggestionText.textContent = review;
  dom.suggestionCounter.textContent = `${state.currentIndex + 1} / ${state.reviews.length}`;

  // Mirror to textarea
  dom.textarea.value = review;

  // Auto-copy to clipboard
  copyToClipboard(review);
}

function nextSuggestion() {
  if (state.reviews.length === 0 || state.isLoadingAI) return;
  state.currentIndex = (state.currentIndex + 1) % state.reviews.length;
  loadCurrentSuggestion();
}

function prevSuggestion() {
  if (state.reviews.length === 0 || state.isLoadingAI) return;
  state.currentIndex = (state.currentIndex - 1 + state.reviews.length) % state.reviews.length;
  loadCurrentSuggestion();
}

// ── Clipboard ──
let clipboardTimeout = null;

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showClipboardPill();
  } catch (err) {
    // Fallback: use deprecated execCommand
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showClipboardPill();
    } catch (fallbackErr) {
      console.warn('Clipboard write failed:', fallbackErr);
      showToast('⚠ Could not copy — please copy manually');
    }
  }
}

function showClipboardPill() {
  const pill = dom.clipboardPill;
  pill.classList.remove('show');
  void pill.offsetWidth;
  pill.classList.add('show');

  if (clipboardTimeout) clearTimeout(clipboardTimeout);
  clipboardTimeout = setTimeout(() => {
    pill.classList.remove('show');
  }, CONFIG.clipboardPillDuration);
}

// ── Toast Notification ──
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.remove('show');
  void toast.offsetWidth;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, CONFIG.toastDuration);
}

// ── Generate Custom Review ──
async function generateCustomReview() {
  if (state.isGenerating || state.isLoadingAI) return;
  state.isGenerating = true;

  // Fetch fresh AI reviews via backend
  const clampedRating = Math.max(3, Math.min(5, state.selectedRating));
  setLoadingState(true);

  const aiReviews = await fetchGeminiReviews(clampedRating);

  setLoadingState(false);

  if (aiReviews) {
    state.reviews = aiReviews;
    state.currentIndex = 0;
    loadCurrentSuggestion();
    state.isGenerating = false;
    return;
  }

  // AI failed — shuffle existing reviews locally
  const carousel = dom.carouselContent;
  carousel.classList.add('generating');
  dom.generateLink.style.pointerEvents = 'none';

  setTimeout(() => {
    const available = state.reviews.filter((_, i) => i !== state.currentIndex);
    if (available.length > 0) {
      const randomReview = available[Math.floor(Math.random() * available.length)];
      state.currentIndex = state.reviews.indexOf(randomReview);
    } else {
      state.currentIndex = (state.currentIndex + 1) % state.reviews.length;
    }

    loadCurrentSuggestion();
    carousel.classList.remove('generating');
    dom.generateLink.style.pointerEvents = '';
    state.isGenerating = false;
  }, 800);
}

// ── Google Review Handoff ──
async function submitToGoogle() {
  const reviewText = dom.textarea.value.trim();

  if (!reviewText) {
    showToast('Please write or select a review first');
    return;
  }

  if (!currentBusiness.googleLink) {
    showToast('⚠ Google review link not configured');
    return;
  }

  // Copy final text to clipboard
  await copyToClipboard(reviewText);

  // Small delay to ensure clipboard write completes
  setTimeout(() => {
    window.location.href = currentBusiness.googleLink;
  }, 300);
}

// ── Star Hover Effects ──
function handleStarHover(rating) {
  dom.starButtons.forEach(btn => {
    const r = parseInt(btn.dataset.rating);
    btn.classList.toggle('hovered', r <= rating && !btn.classList.contains('active'));
  });
}

function clearStarHover() {
  dom.starButtons.forEach(btn => btn.classList.remove('hovered'));
}

// ── Event Listeners ──
function init() {
  // Initialize business data into DOM
  const isValid = parseBusinessData();

  if (!isValid) return;

  // Star clicks
  dom.starButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const rating = parseInt(btn.dataset.rating);
      setRating(rating);
    });

    // Hover (mouse only)
    btn.addEventListener('mouseenter', () => {
      handleStarHover(parseInt(btn.dataset.rating));
    });
    btn.addEventListener('mouseleave', clearStarHover);
  });

  // Carousel navigation
  dom.prevBtn.addEventListener('click', prevSuggestion);
  dom.nextBtn.addEventListener('click', nextSuggestion);

  // Keyboard nav for carousel
  document.addEventListener('keydown', (e) => {
    if (state.selectedRating === 0) return;
    if (e.key === 'ArrowLeft') prevSuggestion();
    if (e.key === 'ArrowRight') nextSuggestion();
  });

  // Generate custom review
  dom.generateLink.addEventListener('click', generateCustomReview);

  // CTA button
  dom.ctaButton.addEventListener('click', submitToGoogle);

  console.log('[QR Review] App initialized — AI reviews via secure backend proxy.');
}

// Boot
document.addEventListener('DOMContentLoaded', init);
