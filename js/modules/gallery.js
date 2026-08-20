/**
 * touchbytiha — Gallery
 * Portfolio rendering and lightbox
 */

import { $, $$, scrollLock } from '../utils/dom.js';

let portfolioImages = [];   // Immutable backup of portfolio items
let images = [];            // Current active images (portfolio or single)
let currentIndex = 0;
let lightbox = null;
let lightboxContent = null;
let lightboxCaption = null;
let lightboxCounter = null;

// Track if lightbox is transitioning to prevent rapid clicks
let isTransitioning = false;

/**
 * Render portfolio items from JSON data
 * @param {Object[]} items - Portfolio data array
 */
export function renderPortfolio(items) {
  const grid = $('.portfolio-grid');
  if (!grid) return;

  // Save to both arrays - portfolioImages is the immutable backup
  const mapped = items.map(item => ({
    src: item.img,
    alt: item.alt,
    category: item.category,
    title: item.title,
    featured: item.featured
  }));
  portfolioImages = [...mapped];
  images = [...mapped];

  const html = items.map((item, i) => `
    <article
      class="portfolio-item reveal${item.featured ? ' featured' : ''}"
      style="transition-delay: ${i * 80}ms"
      role="listitem"
      tabindex="0"
      data-index="${i}"
      aria-label="View ${item.title} - ${item.category}"
    >
      <img
        src="${item.img}"
        alt="${item.alt}"
        loading="${i < 4 ? 'eager' : 'lazy'}"
        decoding="async"
      >
      <div class="portfolio-overlay">
        <span class="portfolio-category">${item.category}</span>
        <h3 class="portfolio-title">${item.title}</h3>
      </div>
    </article>
  `).join('');

  grid.innerHTML = html;

  // Bind click/keyboard events
  grid.querySelectorAll('.portfolio-item').forEach(item => {
    item.addEventListener('click', () => openLightboxIndex(parseInt(item.dataset.index)));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightboxIndex(parseInt(item.dataset.index));
      }
    });
  });
}

/**
 * Initialize lightbox with keyboard/touch support
 */
export function initLightbox() {
  lightbox = $('.lightbox');
  lightboxContent = $('.lightbox-content img', lightbox);
  lightboxCaption = $('.lightbox-caption', lightbox);
  lightboxCounter = $('.lightbox-counter', lightbox);

  const closeBtn = $('.lightbox-close', lightbox);
  const prevBtn = $('.lightbox-prev', lightbox);
  const nextBtn = $('.lightbox-next', lightbox);

  closeBtn.addEventListener('click', closeLightbox);
  prevBtn.addEventListener('click', () => navigate(-1));
  nextBtn.addEventListener('click', () => navigate(1));

  // Click backdrop to close
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  });

  // Touch swipe on lightbox content
  let touchStartX = 0;
  lightbox.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  lightbox.addEventListener('touchend', (e) => {
    if (!lightbox.classList.contains('open')) return;
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      navigate(diff > 0 ? 1 : -1);
    }
  });
}

function openLightboxIndex(index) {
  if (isTransitioning) return;
  
  // Restore portfolio images (in case testimonials overwrote it)
  images = [...portfolioImages];
  currentIndex = index;
  
  $('.lightbox-prev', lightbox)?.classList.remove('hidden');
  $('.lightbox-next', lightbox)?.classList.remove('hidden');
  $('.lightbox-counter', lightbox)?.classList.remove('hidden');
  
  openLightboxWithPreload();
}

export function closeLightbox() {
  if (isTransitioning) return;
  
  isTransitioning = true;
  lightbox.classList.remove('open');
  setTimeout(() => {
    lightbox.hidden = true;
    scrollLock(false);
    isTransitioning = false;
  }, 300);
}

/**
 * Open the lightbox for a single image (no gallery navigation)
 * @param {{src: string, alt: string, caption: string}} item
 */
export function openLightbox({ src, alt, caption }) {
  if (isTransitioning) return;
  
  images = [{ src, alt, category: '', title: caption }];
  currentIndex = 0;
  $('.lightbox-prev', lightbox)?.classList.add('hidden');
  $('.lightbox-next', lightbox)?.classList.add('hidden');
  $('.lightbox-counter', lightbox)?.classList.add('hidden');
  
  openLightboxWithPreload();
}

/**
 * Preload image before showing lightbox for smooth transition
 */
function openLightboxWithPreload() {
  const item = images[currentIndex];
  if (!item) return;
  
  isTransitioning = true;
  
  // Add loading class
  lightbox.classList.add('loading');
  
  // Preload the image
  const img = new Image();
  img.onload = () => {
    updateContent();
    lightbox.hidden = false;
    lightbox.classList.remove('loading');
    requestAnimationFrame(() => {
      lightbox.classList.add('open');
      isTransitioning = false;
    });
    scrollLock(true);
    $('.lightbox-close', lightbox)?.focus();
  };
  
  img.onerror = () => {
    // Fallback: show anyway even if image fails
    updateContent();
    lightbox.hidden = false;
    lightbox.classList.remove('loading');
    requestAnimationFrame(() => {
      lightbox.classList.add('open');
      isTransitioning = false;
    });
    scrollLock(true);
    $('.lightbox-close', lightbox)?.focus();
  };
  
  img.src = item.src;
}

function navigate(direction) {
  if (isTransitioning) return;
  
  isTransitioning = true;
  
  // Fade out current image
  lightboxContent.style.opacity = '0';
  
  setTimeout(() => {
    currentIndex = (currentIndex + direction + images.length) % images.length;
    const item = images[currentIndex];
    
    // Preload next image
    const img = new Image();
    img.onload = () => {
      updateContent();
      // Fade in new image
      requestAnimationFrame(() => {
        lightboxContent.style.opacity = '1';
        isTransitioning = false;
      });
    };
    
    img.onerror = () => {
      updateContent();
      lightboxContent.style.opacity = '1';
      isTransitioning = false;
    };
    
    img.src = item.src;
  }, 200); // Match CSS transition duration
}

function updateContent() {
  const item = images[currentIndex];
  if (!item) return;

  lightboxContent.src = item.src;
  lightboxContent.alt = item.alt;
  lightboxContent.style.opacity = '1'; // Ensure visible
  lightboxCaption.textContent = item.category ? `${item.category} — ${item.title}` : item.title;
  if (lightboxCounter) {
    lightboxCounter.textContent = `${currentIndex + 1} / ${images.length}`;
  }
}