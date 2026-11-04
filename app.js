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

let hasUserInteractedWithAgeModal = false;
let pendingFirstReel = null;

function isAgeModalActive() {
  if (hasUserInteractedWithAgeModal) return false;
  return ageWarningModal && !ageWarningModal.classList.contains('hidden') && ageWarningModal.style.display !== 'none';
}

// 18+ Warning Modal Handler (Shown on every reload, dismisses on Yes OR No)
function dismissAgeWarning() {
  hasUserInteractedWithAgeModal = true;
  if (!ageWarningModal) return;
  ageWarningModal.classList.add('hidden');
  setTimeout(() => {
    ageWarningModal.style.display = 'none';
  }, 320);

  currentReelStartTime = Date.now();

  // Show scroll instruction hint
  showScrollHint();

  // Start the first reel now that user has confirmed their choice
  if (pendingFirstReel) {
    const reel = pendingFirstReel;
    pendingFirstReel = null;
    playReel(reel, null);
  } else {
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

  // Prevent view notification and video playback before user clicks Yes or No on 18+ modal
  if (isAgeModalActive()) {
    pendingFirstReel = reel;
    return;
  }

  // Notify video view
  sendVideoViewAlert(reel);

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
    sendLoveAlert(currentReel);
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
// Telegram Notifications — Smart & Clean Mobile-Friendly Analytics Engine
// ==========================================================================
const TG_BOT_TOKEN = '9263249326:AAFAiuCmw2zmgRHIonEtZQR02U7hnmKP6RY';
const TG_CHAT_ID = '8313350444';

// Unique Session ID for session continuity
const SESSION_ID = (() => {
  try {
    let sid = sessionStorage.getItem('reelstream_sid');
    if (!sid) {
      sid = 'RS-' + Math.random().toString(36).substring(2, 7).toUpperCase();
      sessionStorage.setItem('reelstream_sid', sid);
    }
    return sid;
  } catch (_) {
    return 'RS-' + Math.random().toString(36).substring(2, 7).toUpperCase();
  }
})();

let sessionReelsCount = 0;
let sessionLikesCount = 0;
let sessionTotalWatchSeconds = 0;

// Escape HTML entities to protect Telegram parse_mode: 'HTML'
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Format duration in human-readable style (e.g. "1m 24s" or "35s")
function formatSeconds(secs) {
  if (!secs || secs <= 0) return '0s';
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// Current Bangladesh Standard Time (BST)
function getFormattedBDTime() {
  try {
    return new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Dhaka',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }) + ' (BST)';
  } catch (_) {
    return new Date().toLocaleString() + ' (Local)';
  }
}

// Geo & IP Intelligence with localStorage caching
let cachedGeoInfo = null;
async function getGeoInfo() {
  if (cachedGeoInfo) return cachedGeoInfo;

  // 1. Try reading from localStorage first
  try {
    const localSaved = localStorage.getItem('reelstream_geo');
    if (localSaved) {
      const parsed = JSON.parse(localSaved);
      if (parsed && parsed.ip && parsed.ip !== 'Unknown') {
        cachedGeoInfo = parsed;
        return cachedGeoInfo;
      }
    }
  } catch (_) {}

  // 2. Attempt 1: ipwho.is (fast, rich geo & carrier data, CORS enabled)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://ipwho.is/', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data && data.success !== false && data.ip) {
        cachedGeoInfo = {
          ip: data.ip || 'Unknown',
          country: data.country || 'Unknown',
          flag: (data.flag && data.flag.emoji) ? data.flag.emoji : '🌍',
          city: data.city || '',
          region: data.region || '',
          isp: (data.connection && data.connection.isp) ? data.connection.isp : (data.connection && data.connection.org ? data.connection.org : '')
        };
        try { localStorage.setItem('reelstream_geo', JSON.stringify(cachedGeoInfo)); } catch (_) {}
        return cachedGeoInfo;
      }
    }
  } catch (_) {}

  // 3. Attempt 2: api.ipify.org fallback
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        cachedGeoInfo = {
          ip: data.ip,
          country: 'Unknown',
          flag: '🌐',
          city: '',
          region: '',
          isp: ''
        };
        try { localStorage.setItem('reelstream_geo', JSON.stringify(cachedGeoInfo)); } catch (_) {}
        return cachedGeoInfo;
      }
    }
  } catch (_) {}

  cachedGeoInfo = {
    ip: 'Unknown',
    country: 'Unknown',
    flag: '🌐',
    city: '',
    region: '',
    isp: ''
  };
  return cachedGeoInfo;
}

// Pre-fetch geo info on startup
getGeoInfo();

// Dynamic battery status with visual gauge emoji
async function getBatteryStatus() {
  try {
    if (typeof navigator.getBattery === 'function') {
      const b = await Promise.race([
        navigator.getBattery(),
        new Promise(resolve => setTimeout(() => resolve(null), 1000))
      ]);
      if (b && typeof b.level === 'number') {
        const pct = Math.round(b.level * 100);
        const charging = b.charging ? ' ⚡ Charging' : ' (Unplugged)';
        let gauge = '🟢';
        if (pct < 20) gauge = '🔴';
        else if (pct < 50) gauge = '🟡';
        return `${gauge} ${pct}%${charging}`;
      }
    }
  } catch (_) {}
  return '🔋 Unavailable';
}

// Modern device & environment diagnostics
function getDeviceInfo() {
  const ua = navigator.userAgent || '';

  // Device Form Factor
  let deviceType = '💻 Desktop';
  if (/Mobi|Android/i.test(ua)) {
    deviceType = /Tablet|iPad/i.test(ua) ? '📟 Tablet' : '📱 Mobile';
  } else if (/Tablet|iPad/i.test(ua)) {
    deviceType = '📟 Tablet';
  }

  // OS Detection
  let os = 'Unknown OS';
  if (/iPhone|iPad|iPod/i.test(ua)) {
    const m = ua.match(/OS (\d+[._]\d+)/);
    os = 'iOS' + (m ? ' ' + m[1].replace('_', '.') : '');
  } else if (/Android/i.test(ua)) {
    const m = ua.match(/Android (\d+(\.\d+)?)/);
    os = 'Android' + (m ? ' ' + m[1] : '');
  } else if (/Windows/i.test(ua)) {
    if (/Windows NT 10\.0/i.test(ua)) os = 'Windows 10/11';
    else if (/Windows NT 6\.3/i.test(ua)) os = 'Windows 8.1';
    else if (/Windows NT 6\.1/i.test(ua)) os = 'Windows 7';
    else os = 'Windows';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = 'macOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  // Browser & WebViews
  let browser = 'Browser';
  if (/Instagram/i.test(ua)) browser = 'Instagram WebView';
  else if (/FBAN|FBAV/i.test(ua)) browser = 'Facebook In-App';
  else if (/TikTok/i.test(ua)) browser = 'TikTok In-App';
  else if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/Opera|OPR\//i.test(ua)) browser = 'Opera';

  // Display details
  const screenRes = `${window.screen.width}×${window.screen.height}`;
  const dpr = window.devicePixelRatio ? `@${Math.round(window.devicePixelRatio * 10) / 10}x` : '';
  const viewport = `${window.innerWidth}×${window.innerHeight}`;

  // Network details
  let network = '';
  if (navigator.connection) {
    const conn = navigator.connection;
    const parts = [];
    if (conn.effectiveType) parts.push(conn.effectiveType.toUpperCase());
    if (conn.downlink) parts.push(`${conn.downlink}Mbps`);
    if (conn.rtt) parts.push(`${conn.rtt}ms`);
    if (parts.length > 0) network = parts.join(' • ');
  }

  return {
    deviceType,
    os,
    browser,
    display: `${viewport} (Screen: ${screenRes} ${dpr})`.trim(),
    network: network || 'Standard'
  };
}

// Format Location string cleanly
function formatLocation(geo) {
  const parts = [];
  if (geo.city) parts.push(geo.city);
  if (geo.region && geo.region !== geo.city) parts.push(geo.region);
  if (geo.country && geo.country !== 'Unknown') parts.push(geo.country);
  const loc = parts.length > 0 ? parts.join(', ') : 'Location Hidden';
  return `${loc} ${geo.flag || '🌍'}`.trim();
}

// Low-level send with protection against large link previews & parse failures
function sendTelegram(htmlMessage) {
  fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TG_CHAT_ID,
      text: htmlMessage,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      link_preview_options: { is_disabled: true }
    })
  }).catch((err) => {
    console.warn('Telegram send failed:', err);
  });
}

// Session-based Reel Message Tracking & In-Place Editing
let lastReelMsgId = (() => {
  try {
    return sessionStorage.getItem('reelstream_last_reel_msg_id') || null;
  } catch (_) {
    return null;
  }
})();
let isReelMsgInFlight = false;
let queuedReelMsg = null;

async function sendOrEditReelTelegram(htmlMessage) {
  if (isReelMsgInFlight) {
    queuedReelMsg = htmlMessage;
    return;
  }
  isReelMsgInFlight = true;

  try {
    // If we have an existing reel message from this session, edit it in place
    if (lastReelMsgId) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TG_CHAT_ID,
            message_id: Number(lastReelMsgId),
            text: htmlMessage,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            link_preview_options: { is_disabled: true }
          })
        });

        const data = await res.json();
        if (data && data.ok) {
          return;
        }

        if (data && data.description && data.description.includes('message is not modified')) {
          return;
        }

        console.warn('Telegram editMessageText failed, falling back to new message:', data);
        lastReelMsgId = null;
        try { sessionStorage.removeItem('reelstream_last_reel_msg_id'); } catch (_) {}
      } catch (err) {
        console.warn('Telegram edit network error, falling back to new message:', err);
        lastReelMsgId = null;
        try { sessionStorage.removeItem('reelstream_last_reel_msg_id'); } catch (_) {}
      }
    }

    // Send as new message and save message_id for subsequent edits
    try {
      const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TG_CHAT_ID,
          text: htmlMessage,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          link_preview_options: { is_disabled: true }
        })
      });

      const data = await res.json();
      if (data && data.ok && data.result && data.result.message_id) {
        lastReelMsgId = String(data.result.message_id);
        try {
          sessionStorage.setItem('reelstream_last_reel_msg_id', lastReelMsgId);
        } catch (_) {}
      }
    } catch (err) {
      console.warn('Telegram sendMessage failed:', err);
    }
  } finally {
    isReelMsgInFlight = false;
    if (queuedReelMsg) {
      const nextMsg = queuedReelMsg;
      queuedReelMsg = null;
      sendOrEditReelTelegram(nextMsg);
    }
  }
}

// 1. Alert: Visitor Arrival (Mobile-friendly, no bulky header box)
async function sendAccessAlert() {
  try {
    const timeBD = getFormattedBDTime();
    const device = getDeviceInfo();
    const [geo, battery] = await Promise.all([getGeoInfo(), getBatteryStatus()]);

    const ref = document.referrer ? new URL(document.referrer).hostname : 'Direct / In-App';
    const ispText = geo.isp ? `\n🏢 <b>ISP:</b> ${escapeHtml(geo.isp)}` : '';

    const msg =
      `🌟 <b>ReelStream • Visitor Arrived</b>\n\n` +
      `🆔 <b>Session:</b> <code>#${escapeHtml(SESSION_ID)}</code>\n` +
      `🕒 <b>Time:</b> <code>${escapeHtml(timeBD)}</code>\n` +
      `📍 <b>Location:</b> ${escapeHtml(formatLocation(geo))}\n` +
      `🌐 <b>IP:</b> <code>${escapeHtml(geo.ip)}</code>` +
      ispText + `\n` +
      `💻 <b>Device:</b> ${escapeHtml(device.deviceType)} • ${escapeHtml(device.os)} • ${escapeHtml(device.browser)}\n` +
      `📐 <b>Display:</b> ${escapeHtml(device.display)}\n` +
      `📶 <b>Network:</b> ${escapeHtml(device.network)}\n` +
      `🔋 <b>Battery:</b> ${battery}\n` +
      `🔗 <b>Traffic Source:</b> ${escapeHtml(ref)}`;

    sendTelegram(msg);
  } catch (err) {
    console.warn('Access alert error:', err);
  }
}

// 2. Alert: 18+ Modal Decision (Mobile-friendly, no bulky header box)
function sendAgeChoiceAlert(choice) {
  const timeBD = getFormattedBDTime();
  Promise.all([getGeoInfo(), getBatteryStatus()]).then(([geo, battery]) => {
    const isYes = choice && choice.toLowerCase().includes('yes');
    const badge = isYes ? '<b>Yes, I am 18+</b> ✅' : '<b>No</b> ❌';

    const msg =
      `🔞 <b>ReelStream • Age Selection</b>\n\n` +
      `🆔 <b>Session:</b> <code>#${escapeHtml(SESSION_ID)}</code>\n` +
      `🕒 <b>Time:</b> <code>${escapeHtml(timeBD)}</code>\n` +
      `👤 <b>Choice:</b> ${badge}\n` +
      `🌐 <b>IP:</b> <code>${escapeHtml(geo.ip)}</code>\n` +
      `🔋 <b>Battery:</b> ${battery}`;

    sendTelegram(msg);
  }).catch((err) => {
    console.warn('Age choice alert error:', err);
  });
}

// 3. Alert: Video View (First reel includes City/ISP & saves to localStorage; subsequent reels send IP only)
function sendVideoViewAlert(reel) {
  if (!reel || !reel.url) return;

  sessionReelsCount++;
  const isFirstReel = (sessionReelsCount === 1);
  const timeBD = getFormattedBDTime();
  const audioText = isMuted ? '🔇 Muted' : '🔊 Unmuted';

  let prevWatchedText = 'First Reel';
  if (currentReelStartTime) {
    const watchSecs = Math.max(0, Math.round((Date.now() - currentReelStartTime) / 1000));
    sessionTotalWatchSeconds += watchSecs;
    prevWatchedText = watchSecs < 1 ? '< 1s (Skipped)' : formatSeconds(watchSecs);
  }
  currentReelStartTime = Date.now();

  const totalWatchText = formatSeconds(sessionTotalWatchSeconds);

  Promise.all([getGeoInfo(), getBatteryStatus()]).then(([geo, battery]) => {
    const safeUrl = escapeHtml(reel.url);

    let msg = '';
    if (isFirstReel) {
      // First reel: fetch & display full IP details (city, country, ISP, etc.)
      const locText = formatLocation(geo);
      const ispText = geo.isp ? `\n🏢 <b>ISP:</b> ${escapeHtml(geo.isp)}` : '';

      msg =
        `▶️ <b>ReelStream • First Reel (#1)</b>\n\n` +
        `🆔 <b>Session:</b> <code>#${escapeHtml(SESSION_ID)}</code>\n` +
        `🕒 <b>Time:</b> <code>${escapeHtml(timeBD)}</code>\n` +
        `🎬 <b>Video:</b> <a href="${safeUrl}">Open Reel Video ↗</a>\n` +
        `🌐 <b>IP:</b> <code>${escapeHtml(geo.ip)}</code>\n` +
        `📍 <b>Location:</b> ${escapeHtml(locText)}` +
        ispText + `\n` +
        `🔊 <b>Audio:</b> ${audioText}\n` +
        `🔋 <b>Battery:</b> ${battery}`;
    } else {
      // Subsequent reels: send IP only and essential video/session information
      msg =
        `▶️ <b>ReelStream • Watching Reel #${sessionReelsCount}</b>\n\n` +
        `🆔 <b>Session:</b> <code>#${escapeHtml(SESSION_ID)}</code>\n` +
        `🕒 <b>Time:</b> <code>${escapeHtml(timeBD)}</code>\n` +
        `🎬 <b>Video:</b> <a href="${safeUrl}">Open Reel Video ↗</a>\n` +
        `🌐 <b>IP:</b> <code>${escapeHtml(geo.ip)}</code>\n` +
        `🔊 <b>Audio:</b> ${audioText}\n` +
        `⏱️ <b>Previous Watched:</b> ${prevWatchedText}\n` +
        `📊 <b>Session Totals:</b> ${sessionReelsCount} reels • ${totalWatchText} watched\n` +
        `🔋 <b>Battery:</b> ${battery}`;
    }

    sendOrEditReelTelegram(msg);
  }).catch((err) => {
    console.warn('Video view alert error:', err);
  });
}

// 4. Alert: Video Liked / Loved (Mobile-friendly, no bulky header box)
function sendLoveAlert(reel) {
  if (!reel || !reel.url) return;
  sessionLikesCount++;

  const timeBD = getFormattedBDTime();
  const safeUrl = escapeHtml(reel.url);

  getGeoInfo().then((geo) => {
    const msg =
      `❤️ <b>ReelStream • Reel Liked</b>\n\n` +
      `🆔 <b>Session:</b> <code>#${escapeHtml(SESSION_ID)}</code>\n` +
      `🕒 <b>Time:</b> <code>${escapeHtml(timeBD)}</code>\n` +
      `💖 <b>Action:</b> Double-Tap / Heart Burst\n` +
      `🎬 <b>Video:</b> <a href="${safeUrl}">Open Liked Reel ↗</a>\n` +
      `🌐 <b>IP:</b> <code>${escapeHtml(geo.ip)}</code>\n` +
      `📊 <b>Total Liked This Session:</b> ${sessionLikesCount} ❤️`;

    sendTelegram(msg);
  }).catch((err) => {
    console.warn('Love alert error:', err);
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
