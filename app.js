// ==========================================================================
// ReelStream - Ultra-Smooth Native Dual-Slot Video Player
// ==========================================================================

let allUrls = [];
const history = [];
let historyPointer = -1;
let nextPreloadedReel = null;
let isMuted = true;
let isTransitioning = false;
let isAutoSkipping = false;
let lastSkipTime = 0;
let currentReelStartTime = null;

// Local Favorites & Likes Storage
const currentLikesStorageKey = 'reelstream_likes';
let myLikedIds = new Set(JSON.parse(localStorage.getItem(currentLikesStorageKey) || '[]'));

// DOM Elements
const ageWarningModal = document.getElementById('ageWarningModal');
const btnAgeYes = document.getElementById('btnAgeYes');
const btnAgeNo = document.getElementById('btnAgeNo');

const playerStage = document.getElementById('playerStage');
const videoCarousel = document.getElementById('videoCarousel');
const slotA = document.getElementById('slotA');
const slotB = document.getElementById('slotB');
const videoA = document.getElementById('videoA');
const videoB = document.getElementById('videoB');

const stageSpinner = document.getElementById('stageSpinner');
const centerIndicator = document.getElementById('centerIndicator');
const heartBurst = document.getElementById('heartBurst');
const btnAudioToggle = document.getElementById('btnAudioToggle');
const audioIcon = document.getElementById('audioIcon');
const audioLabel = document.getElementById('audioLabel');

const btnLove = document.getElementById('btnLove');
const loveIcon = document.getElementById('loveIcon');
const loveCount = document.getElementById('loveCount');
const scrubberBar = document.getElementById('scrubberBar');
const scrubberFill = document.getElementById('scrubberFill');
const toastPopup = document.getElementById('toastPopup');
const scrollHint = document.getElementById('scrollHint');

// Dual-Slot State: 0 -> slotA is active, 1 -> slotB is active
let activeSlotIndex = 0;

function getActiveSlot() {
  return activeSlotIndex === 0 ? slotA : slotB;
}

function getInactiveSlot() {
  return activeSlotIndex === 0 ? slotB : slotA;
}

function getActiveVideo() {
  return activeSlotIndex === 0 ? videoA : videoB;
}

function getInactiveVideo() {
  return activeSlotIndex === 0 ? videoB : videoA;
}

function isAgeModalActive() {
  const ageActive = ageWarningModal && !ageWarningModal.classList.contains('hidden') && ageWarningModal.style.display !== 'none';
  const ratingActive = ratingModal && !ratingModal.classList.contains('hidden') && ratingModal.style.display !== 'none';
  return Boolean(ageActive || ratingActive);
}

// 18+ Warning Modal Handler (Shown on every reload, dismisses on Yes OR No)
function dismissAgeWarning() {
  if (!ageWarningModal) return;
  ageWarningModal.classList.add('hidden');
  setTimeout(() => {
    ageWarningModal.style.display = 'none';
  }, 320);

  // If user has not rated yet, open rating popup!
  if (!hasAlreadyRated()) {
    openRatingModal();
    return;
  }

  currentReelStartTime = Date.now();

  // Show scroll instruction hint
  showScrollHint();

  // User interaction: start or resume active video playback
  const activeVid = getActiveVideo();
  if (activeVid) {
    const playPromise = activeVid.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Playback error after modal interaction:', err);
      });
    }
    centerIndicator.classList.remove('active');
  }
}

if (btnAgeYes) {
  btnAgeYes.addEventListener('click', (e) => {
    e.stopPropagation();
    sendAgeChoiceAlert('Yes ✅');
    dismissAgeWarning();
  });
}

if (btnAgeNo) {
  btnAgeNo.addEventListener('click', (e) => {
    e.stopPropagation();
    sendAgeChoiceAlert('No ❌');
    dismissAgeWarning();
  });
}


// ==========================================================================
// Rating & Feedback Modal Handler
// ==========================================================================
const RATING_STORAGE_KEY = 'reelstream_user_rating_done';
const ratingModal = document.getElementById('ratingModal');
const ratingStarsWrap = document.getElementById('ratingStars');
const ratingStarsLabel = document.getElementById('ratingStarsLabel');
const ratingComment = document.getElementById('ratingComment');
const ratingErrorMsg = document.getElementById('ratingErrorMsg');
const btnSubmitRating = document.getElementById('btnSubmitRating');

let selectedStars = 0;
const starLabels = ['', 'Poor ⭐', 'Fair ⭐⭐', 'Good ⭐⭐⭐', 'Very Good ⭐⭐⭐⭐', 'Excellent! ⭐⭐⭐⭐⭐'];

function hasAlreadyRated() {
  return localStorage.getItem(RATING_STORAGE_KEY) === 'true';
}

function openRatingModal() {
  if (!ratingModal) return;
  ratingModal.classList.remove('hidden');
  ratingModal.style.display = 'flex';
}

function dismissRatingModal() {
  if (!ratingModal) return;
  ratingModal.classList.add('hidden');
  setTimeout(() => {
    ratingModal.style.display = 'none';
  }, 320);

  currentReelStartTime = Date.now();
  showScrollHint();

  const activeVid = getActiveVideo();
  if (activeVid) {
    const playPromise = activeVid.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Playback error after rating interaction:', err);
      });
    }
    centerIndicator.classList.remove('active');
  }
}

if (ratingStarsWrap) {
  const starBtns = ratingStarsWrap.querySelectorAll('.star-btn');
  starBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedStars = parseInt(btn.dataset.value, 10);
      updateStarUI(selectedStars);
      if (ratingErrorMsg) ratingErrorMsg.classList.remove('visible');
    });
    btn.addEventListener('mouseenter', () => {
      const val = parseInt(btn.dataset.value, 10);
      highlightStars(val);
    });
  });

  ratingStarsWrap.addEventListener('mouseleave', () => {
    updateStarUI(selectedStars);
  });
}

function updateStarUI(val) {
  if (!ratingStarsWrap) return;
  const starBtns = ratingStarsWrap.querySelectorAll('.star-btn');
  starBtns.forEach(btn => {
    const btnVal = parseInt(btn.dataset.value, 10);
    btn.classList.toggle('active', btnVal <= val);
    btn.classList.remove('hovered');
  });
  if (ratingStarsLabel) {
    ratingStarsLabel.textContent = val > 0 ? starLabels[val] : 'Select rating (1-5 stars)';
  }
}

function highlightStars(val) {
  if (!ratingStarsWrap) return;
  const starBtns = ratingStarsWrap.querySelectorAll('.star-btn');
  starBtns.forEach(btn => {
    const btnVal = parseInt(btn.dataset.value, 10);
    btn.classList.toggle('hovered', btnVal <= val);
  });
  if (ratingStarsLabel && val > 0) {
    ratingStarsLabel.textContent = starLabels[val];
  }
}

if (btnSubmitRating) {
  btnSubmitRating.addEventListener('click', () => {
    const comment = (ratingComment ? ratingComment.value : '').trim();

    if (selectedStars < 1) {
      showRatingError('Please select a star rating (1 to 5 stars) ⭐');
      return;
    }

    if (!comment) {
      showRatingError('Please write your comments or review 💬');
      if (ratingComment) ratingComment.focus();
      return;
    }

    // Save so it asks once on start
    localStorage.setItem(RATING_STORAGE_KEY, 'true');

    // Send Telegram alert
    const bdTime = new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });
    const starsEmoji = '⭐'.repeat(selectedStars);
    getUserIP().then(ip => {
      sendTelegram(
        `⭐ <b>App Rating & Review</b>\n\n` +
        `⭐ Rating: ${selectedStars}/5 Stars (${starsEmoji})\n` +
        `💬 Comments: ${comment}\n` +
        `🌐 IP: ${ip}\n` +
        `📅 Time (BD): ${bdTime}`
      );
    });

    showToast('Thank you for your rating! ❤️');
    dismissRatingModal();
  });
}

function showRatingError(msg) {
  if (ratingErrorMsg) {
    ratingErrorMsg.textContent = msg;
    ratingErrorMsg.classList.add('visible');
  }
  const card = document.querySelector('.rating-modal-card');
  if (card) {
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
  }
}

// Scroll Instruction Hint
function showScrollHint() {
  if (!scrollHint) return;
  scrollHint.classList.add('visible');
  setTimeout(() => {
    scrollHint.classList.add('fade-out');
    scrollHint.classList.remove('visible');
  }, 4000);
}

// Toast Notification
function showToast(msg) {
  toastPopup.textContent = msg;
  toastPopup.classList.add('show');
  setTimeout(() => {
    toastPopup.classList.remove('show');
  }, 2200);
}

// Random Reel Picker
function pickRandomReel() {
  if (allUrls.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * allUrls.length);
  return {
    id: randomIndex + 1,
    url: allUrls[randomIndex]
  };
}

// Background Preload into Inactive Slot
function prepareNextPreload() {
  nextPreloadedReel = pickRandomReel();
  if (nextPreloadedReel) {
    const inactiveVid = getInactiveVideo();
    if (inactiveVid.src !== nextPreloadedReel.url) {
      inactiveVid.src = nextPreloadedReel.url;
      inactiveVid.muted = true;
      inactiveVid.preload = 'auto';
      inactiveVid.load();
    }
  }
}

// Video Playback Error Handler (Throttled & ignores normal aborts)
function handleVideoError(vid, context = 'error') {
  if (vid !== getActiveVideo()) return;
  const err = vid.error;
  // Ignore normal MEDIA_ERR_ABORTED (code 1) when switching videos
  if (err && err.code === 1) return;

  const now = Date.now();
  if (now - lastSkipTime < 2000) return; // Prevent fast loops
  lastSkipTime = now;

  console.warn(`Video playback issue (${context}). Auto-skipping...`);
  showToast('Skipping unavailable reel... ⏭️');

  if (isAutoSkipping) return;
  isAutoSkipping = true;

  setTimeout(() => {
    isAutoSkipping = false;
    goNext();
  }, 500);
}

// Play / Transition Reel with Silky Native Dual-Slot Animation
function playReel(reel, direction = null) {
  if (!reel) {
    goNext();
    return;
  }

  // Notify video view
  const bdTime = new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });
  const audioStatus = isMuted ? 'Muted 🔇' : 'Unmuted 🔊';
  let prevWatchLine = '';
  if (currentReelStartTime) {
    const watchSeconds = Math.max(0, Math.round((Date.now() - currentReelStartTime) / 1000));
    prevWatchLine = `⏱️ Previous Video Watched: ${watchSeconds}s\n`;
  }
  currentReelStartTime = Date.now();

  getUserIP().then(ip => {
    sendTelegram(
      `▶️ <b>Video Viewed</b>\n\n` +
      `📅 Time (BD): ${bdTime}\n` +
      `🌐 IP: ${ip}\n` +
      `🔊 Audio: ${audioStatus}\n` +
      prevWatchLine +
      `🎬 Link: ${reel.url}`
    );
  });

  stageSpinner.style.opacity = '1';

  // Initial load without slide transition
  if (!direction) {
    const activeSlot = getActiveSlot();
    const activeVid = getActiveVideo();

    activeSlot.className = 'video-slot active-slot';
    activeSlot.style.transform = '';
    activeSlot.style.opacity = '1';
    activeSlot.style.filter = '';

    activeVid.src = reel.url;
    activeVid.muted = isMuted;

    const playPromise = activeVid.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        stageSpinner.style.opacity = '0';
      }).catch((err) => {
        stageSpinner.style.opacity = '0';
        if (err && err.name === 'NotAllowedError') {
          centerIndicator.classList.add('active');
        }
      });
    }

    centerIndicator.classList.remove('active');
    updateSideRailUI(reel);
    prepareNextPreload();
    return;
  }

  if (isTransitioning) return;
  isTransitioning = true;

  const currSlot = getActiveSlot();
  const incomingSlot = getInactiveSlot();
  const currVideo = getActiveVideo();
  const incomingVideo = getInactiveVideo();

  // Ensure target URL is assigned to incoming video
  if (incomingVideo.src !== reel.url) {
    incomingVideo.src = reel.url;
  }
  incomingVideo.muted = isMuted;
  incomingVideo.currentTime = 0;

  // Reset classes and inline styles before starting animation
  incomingSlot.classList.remove('is-animating', 'slide-in-center', 'slide-out-top', 'slide-out-bottom');
  currSlot.classList.remove('is-animating', 'slide-in-center', 'slide-out-top', 'slide-out-bottom');

  incomingSlot.style.transition = 'none';
  currSlot.style.transition = 'none';
  incomingSlot.style.opacity = '1';
  incomingSlot.style.filter = 'brightness(1)';
  currSlot.style.filter = 'brightness(1)';

  if (direction === 'next') {
    incomingSlot.style.transform = 'translate3d(0, 100%, 0)';
  } else {
    incomingSlot.style.transform = 'translate3d(0, -100%, 0)';
  }
  incomingSlot.classList.add('has-depth-shadow');

  // Force reflow to commit initial positions
  void incomingSlot.offsetWidth;

  // Start incoming video playback immediately
  const playPromise = incomingVideo.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      stageSpinner.style.opacity = '0';
    }).catch((err) => {
      stageSpinner.style.opacity = '0';
      if (err && err.name === 'NotAllowedError') {
        centerIndicator.classList.add('active');
      }
    });
  }

  // Apply silky spring transition
  incomingSlot.classList.add('is-animating');
  currSlot.classList.add('is-animating');

  if (direction === 'next') {
    currSlot.classList.add('slide-out-top');
    incomingSlot.classList.add('slide-in-center');
  } else {
    currSlot.classList.add('slide-out-bottom');
    incomingSlot.classList.add('slide-in-center');
  }

  // Animation completion
  setTimeout(() => {
    currVideo.pause();

    // Clean up slots
    currSlot.className = 'video-slot';
    currSlot.style.transform = '';
    currSlot.style.opacity = '0';
    currSlot.style.filter = '';
    currSlot.classList.remove('has-depth-shadow', 'is-animating', 'slide-out-top', 'slide-out-bottom');

    incomingSlot.className = 'video-slot active-slot';
    incomingSlot.style.transform = '';
    incomingSlot.style.opacity = '1';
    incomingSlot.style.filter = '';
    incomingSlot.classList.remove('has-depth-shadow', 'is-animating', 'slide-in-center');

    // Swap active slot pointer
    activeSlotIndex = 1 - activeSlotIndex;
    isTransitioning = false;

    centerIndicator.classList.remove('active');
    updateSideRailUI(reel);

    // Buffer the next reel into the now-inactive slot
    prepareNextPreload();
  }, 390);
}

// Update Side Rail Controls
function updateSideRailUI(reel) {
  if (!reel) return;
  const isLovedByMe = myLikedIds.has(reel.id);

  if (isLovedByMe) {
    btnLove.classList.add('loved');
    loveIcon.setAttribute('fill', 'currentColor');
  } else {
    btnLove.classList.remove('loved');
    loveIcon.setAttribute('fill', 'none');
  }

  loveCount.textContent = isLovedByMe ? 1 : 0;
}

// Navigate Next (Random + Preloaded)
function goNext() {
  if (isAgeModalActive() || isTransitioning) return;
  if (historyPointer < history.length - 1) {
    historyPointer++;
    const reel = history[historyPointer];
    playReel(reel, 'next');
  } else {
    const reel = nextPreloadedReel || pickRandomReel();
    history.push(reel);
    historyPointer = history.length - 1;
    playReel(reel, 'next');
  }
}

// Navigate Previous
function goPrevious() {
  if (isAgeModalActive() || isTransitioning) return;
  if (historyPointer > 0) {
    historyPointer--;
    const reel = history[historyPointer];
    playReel(reel, 'prev');
  } else {
    showToast('First reel in session');
  }
}

// Love React Toggle
function toggleLove() {
  if (isAgeModalActive() || historyPointer < 0 || !history[historyPointer]) return;
  const currentReel = history[historyPointer];
  const isLoved = myLikedIds.has(currentReel.id);

  if (isLoved) {
    myLikedIds.delete(currentReel.id);
  } else {
    myLikedIds.add(currentReel.id);
    heartBurst.classList.remove('animate');
    void heartBurst.offsetWidth;
    heartBurst.classList.add('animate');

    // Notify love react
    const bdTime = new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });
    getUserIP().then(ip => {
      sendTelegram(
        `❤️ <b>Video Loved</b>\n\n` +
        `📅 Time (BD): ${bdTime}\n` +
        `🌐 IP: ${ip}\n` +
        `🎬 Link: ${currentReel.url}`
      );
    });
  }

  localStorage.setItem(currentLikesStorageKey, JSON.stringify([...myLikedIds]));
  updateSideRailUI(currentReel);
}

// Tap on Video for Play / Pause & Double-Tap for Love
let lastTap = 0;
videoCarousel.addEventListener('click', (e) => {
  if (isAgeModalActive()) return;
  // If clicked on controls, ignore
  if (e.target.closest('.action-sidebar') || e.target.closest('.stage-header') || e.target.closest('.stage-scrubber')) {
    return;
  }

  const now = Date.now();
  if (now - lastTap < 300) {
    toggleLove();
    lastTap = 0;
  } else {
    lastTap = now;
    setTimeout(() => {
      if (lastTap === now) {
        const vid = getActiveVideo();
        if (vid.paused) {
          vid.play();
          centerIndicator.classList.remove('active');
        } else {
          vid.pause();
          centerIndicator.classList.add('active');
        }
      }
    }, 305);
  }
});

btnLove.addEventListener('click', toggleLove);

// ==========================================================================
// Interactive Touch Gestures (Drag-to-follow physics)
// ==========================================================================
let touchStartY = 0;
let touchStartX = 0;
let touchStartTime = 0;
let isDraggingTouch = false;

playerStage.addEventListener('touchstart', (e) => {
  if (isAgeModalActive()) return;
  if (e.target.closest('.stage-header') || e.target.closest('.action-sidebar') || e.target.closest('.stage-scrubber')) {
    return;
  }
  if (isTransitioning) return;
  touchStartY = e.touches[0].clientY;
  touchStartX = e.touches[0].clientX;
  touchStartTime = Date.now();
  isDraggingTouch = false;
}, { passive: true });

playerStage.addEventListener('touchmove', (e) => {
  if (isAgeModalActive() || isTransitioning) return;
  const currentY = e.touches[0].clientY;
  const currentX = e.touches[0].clientX;
  const deltaY = currentY - touchStartY;
  const deltaX = currentX - touchStartX;

  // Ignore if horizontal swipe
  if (Math.abs(deltaX) > Math.abs(deltaY)) return;

  if (Math.abs(deltaY) > 8) {
    isDraggingTouch = true;
    const currSlot = getActiveSlot();
    const incomingSlot = getInactiveSlot();
    const incomingVideo = getInactiveVideo();

    currSlot.style.transition = 'none';
    incomingSlot.style.transition = 'none';

    if (deltaY < 0) {
      // Dragging Up: Revealing Next
      const candidateReel = (historyPointer < history.length - 1)
        ? history[historyPointer + 1]
        : (nextPreloadedReel || pickRandomReel());

      if (candidateReel && incomingVideo.src !== candidateReel.url) {
        incomingVideo.src = candidateReel.url;
        incomingVideo.muted = isMuted;
      }

      incomingSlot.style.opacity = '1';
      incomingSlot.classList.add('has-depth-shadow');
      incomingSlot.style.transform = `translate3d(0, calc(100% + ${deltaY}px), 0)`;

      const dragPct = Math.min(1, Math.abs(deltaY) / window.innerHeight);
      currSlot.style.transform = `translate3d(0, ${deltaY * 0.42}px, 0) scale(${1 - dragPct * 0.08})`;
      currSlot.style.opacity = `${1 - dragPct * 0.6}`;
      currSlot.style.filter = `brightness(${1 - dragPct * 0.35})`;
    } else if (deltaY > 0 && historyPointer > 0) {
      // Dragging Down: Revealing Previous
      const prevReel = history[historyPointer - 1];
      if (prevReel && incomingVideo.src !== prevReel.url) {
        incomingVideo.src = prevReel.url;
        incomingVideo.muted = isMuted;
      }

      incomingSlot.style.opacity = '1';
      incomingSlot.classList.add('has-depth-shadow');
      incomingSlot.style.transform = `translate3d(0, calc(-100% + ${deltaY}px), 0)`;

      const dragPct = Math.min(1, Math.abs(deltaY) / window.innerHeight);
      currSlot.style.transform = `translate3d(0, ${deltaY * 0.42}px, 0) scale(${1 - dragPct * 0.08})`;
      currSlot.style.opacity = `${1 - dragPct * 0.6}`;
      currSlot.style.filter = `brightness(${1 - dragPct * 0.35})`;
    }
  }
}, { passive: false });

playerStage.addEventListener('touchend', (e) => {
  if (isAgeModalActive() || isTransitioning) return;
  const deltaY = e.changedTouches[0].clientY - touchStartY;
  const timeDiff = Date.now() - touchStartTime;
  const isFlick = timeDiff < 300 && Math.abs(deltaY) > 40;

  if (isDraggingTouch) {
    isDraggingTouch = false;
    if (deltaY < -60 || (isFlick && deltaY < 0)) {
      goNext();
    } else if ((deltaY > 60 || (isFlick && deltaY > 0)) && historyPointer > 0) {
      goPrevious();
    } else {
      // Smoothly spring back to current reel
      const currSlot = getActiveSlot();
      const incomingSlot = getInactiveSlot();

      currSlot.classList.add('is-animating');
      incomingSlot.classList.add('is-animating');

      currSlot.style.transform = 'translate3d(0, 0, 0) scale(1)';
      currSlot.style.opacity = '1';
      currSlot.style.filter = 'brightness(1)';

      if (deltaY < 0) {
        incomingSlot.style.transform = 'translate3d(0, 100%, 0)';
      } else {
        incomingSlot.style.transform = 'translate3d(0, -100%, 0)';
      }

      setTimeout(() => {
        currSlot.classList.remove('is-animating');
        incomingSlot.classList.remove('is-animating', 'has-depth-shadow');
        incomingSlot.style.opacity = '0';
      }, 300);
    }
  }
}, { passive: true });

// Mouse Wheel Navigation with Throttle
let wheelThrottle = false;
window.addEventListener('wheel', (e) => {
  if (isAgeModalActive() || wheelThrottle || isTransitioning) return;
  if (Math.abs(e.deltaY) > 25) {
    wheelThrottle = true;
    if (e.deltaY > 0) goNext();
    else goPrevious();
    setTimeout(() => { wheelThrottle = false; }, 420);
  }
}, { passive: true });

// Video Buffering & Scrubbing on Both Elements
[videoA, videoB].forEach((vid) => {
  vid.addEventListener('waiting', () => {
    if (vid === getActiveVideo()) stageSpinner.style.opacity = '1';
  });
  vid.addEventListener('canplay', () => {
    if (vid === getActiveVideo()) stageSpinner.style.opacity = '0';
  });
  vid.addEventListener('playing', () => {
    if (vid === getActiveVideo()) stageSpinner.style.opacity = '0';
  });
  vid.addEventListener('error', () => {
    handleVideoError(vid, 'media_error');
  });
  vid.addEventListener('timeupdate', () => {
    if (vid === getActiveVideo() && vid.duration) {
      stageSpinner.style.opacity = '0';
      const pct = (vid.currentTime / vid.duration) * 100;
      scrubberFill.style.width = `${pct}%`;
    }
  });
});

scrubberBar.addEventListener('click', (e) => {
  if (isAgeModalActive()) return;
  e.stopPropagation();
  const rect = scrubberBar.getBoundingClientRect();
  const pos = (e.clientX - rect.left) / rect.width;
  const vid = getActiveVideo();
  if (vid.duration) {
    vid.currentTime = pos * vid.duration;
  }
});

// Audio Toggle UI & Handler
function updateAudioUI() {
  if (!btnAudioToggle || !audioIcon) return;
  if (isMuted) {
    btnAudioToggle.className = 'audio-toggle-btn is-muted';
    if (audioLabel) audioLabel.textContent = 'Muted';
    audioIcon.innerHTML = `
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <line x1="23" y1="9" x2="17" y2="15"></line>
        <line x1="17" y1="9" x2="23" y2="15"></line>
      </svg>
    `;
  } else {
    btnAudioToggle.className = 'audio-toggle-btn is-unmuted';
    if (audioLabel) audioLabel.textContent = 'Sound On';
    audioIcon.innerHTML = `
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
      </svg>
    `;
  }
}

// Toggle Audio (Mute / Unmute)
function toggleAudio(e) {
  if (isAgeModalActive()) return;
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  isMuted = !isMuted;

  // Apply to both dual-slot video elements
  videoA.muted = isMuted;
  videoB.muted = isMuted;
  videoA.volume = 1.0;
  videoB.volume = 1.0;

  const activeVid = getActiveVideo();
  if (activeVid) {
    activeVid.muted = isMuted;
    activeVid.volume = 1.0;

    // Ensure video continues playing with sound when unmuted
    if (!isMuted) {
      const p = activeVid.play();
      if (p !== undefined) {
        p.catch((err) => {
          console.warn('Audio play error on unmute:', err);
        });
      }
    }
  }

  updateAudioUI();
  showToast(isMuted ? 'Sound Muted 🔇' : 'Sound On 🔊');
}

btnAudioToggle.addEventListener('click', toggleAudio);
btnAudioToggle.addEventListener('touchend', (e) => {
  e.preventDefault();
  e.stopPropagation();
  toggleAudio();
});

// Keyboard Navigation
window.addEventListener('keydown', (e) => {
  if (isAgeModalActive()) return;
  const key = e.key.toLowerCase();
  if (e.key === 'ArrowDown' || key === 'j') {
    e.preventDefault();
    goNext();
  } else if (e.key === 'ArrowUp' || key === 'k') {
    e.preventDefault();
    goPrevious();
  } else if (e.key === ' ') {
    e.preventDefault();
    const vid = getActiveVideo();
    if (vid.paused) {
      vid.play();
      centerIndicator.classList.remove('active');
    } else {
      vid.pause();
      centerIndicator.classList.add('active');
    }
  } else if (key === 'm') {
    toggleAudio();
  } else if (key === 'l') {
    toggleLove();
  }
});

// ==========================================================================
// Telegram Notifications
// ==========================================================================
const TG_BOT_TOKEN = '9263249326:AAFAiuCmw2zmgRHIonEtZQR02U7hnmKP6RY';
const TG_CHAT_ID = '8313350444';

let cachedUserIP = 'Unknown';
async function getUserIP() {
  if (cachedUserIP !== 'Unknown') return cachedUserIP;
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    if (data && data.ip) cachedUserIP = data.ip;
  } catch (_) {}
  return cachedUserIP;
}
getUserIP(); // Pre-fetch immediately

function sendTelegram(message) {
  fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TG_CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    })
  }).catch((err) => {
    console.warn('Telegram send failed:', err);
  });
}

// Notification 1: Instant on page access
async function sendAccessAlert() {
  try {
    const bdTime = new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });
    const platform = navigator.platform || 'Unknown';
    const ip = await getUserIP();

    sendTelegram(
      `🔔 <b>New Visitor Accessed</b>\n\n` +
      `📅 Time (BD): ${bdTime}\n` +
      `💻 Platform: ${platform}\n` +
      `🌐 IP: ${ip}`
    );
    } catch (err) {
    console.warn('Access alert error:', err);
  }
}

// Notification 2: When 18+ option is selected
function sendAgeChoiceAlert(choice) {
  const bdTime = new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' });
  getUserIP().then(ip => {
    sendTelegram(
      `🔞 <b>18+ Selection</b>\n\n` +
      `📅 Time (BD): ${bdTime}\n` +
      `👤 Selected: ${choice}\n` +
      `🌐 IP: ${ip}`
    );
  });
}

// ==========================================================================
// Initialization
// ==========================================================================
async function init() {
  // Notification 1: instant on page load
  sendAccessAlert();

  try {
    const res = await fetch('reels.json?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    allUrls = await res.json();

    const firstReel = pickRandomReel();
    if (firstReel) {
      history.push(firstReel);
      historyPointer = 0;
      playReel(firstReel, null);
    }
  } catch (err) {
    console.error('Failed to load reels.json:', err);
    showToast('Failed to load reel catalog ⚠️');
  }
}

init();
