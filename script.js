const openingScreen = document.getElementById("openingDoor");
const timecodeUI = document.getElementById("timecode");
const beginAgainButton = document.getElementById("beginAgain");

const shots = Array.from(document.querySelectorAll(".shot"));
const shotNumbersWrap = document.getElementById("shotNums");
const shotCounterUI = document.getElementById("shotCount");

let currentShotIndex = 0;
let blockAdvanceUntil = 0;

// =============================
// MUSIC 
// =============================

const bgMusic = document.getElementById("bgMusic");
const musicToggle = document.getElementById("musicToggle");

let musicStarted = false;

// iOS/Safari unlock helper: briefly play muted, then stop, then allow real play
async function primeAudio() {
  if (!bgMusic) return;
  try {
    bgMusic.muted = true;
    await bgMusic.play();
    bgMusic.pause();
    bgMusic.currentTime = 0;
    bgMusic.muted = false;
  } catch {}
}

async function startMusicIfAllowed() {
  if (!bgMusic || musicStarted) return;

  try {
    bgMusic.volume = 0.35;     // adjust to taste
    bgMusic.loop = true;

    // helps iOS/Safari
    await primeAudio();

    await bgMusic.play();      // will succeed after user interaction
    musicStarted = true;
    if (musicToggle) musicToggle.classList.remove("is-paused");
  } catch (e) {
  console.warn("Music play blocked:", e);
  if (musicToggle) musicToggle.classList.add("is-paused");
  }
}

function toggleMusic(e) {
  if (e) e.stopPropagation();
  if (!bgMusic) return;

  // If it hasn't started yet, try to start it
  if (bgMusic.paused) {
    startMusicIfAllowed();
  } else {
    bgMusic.pause();
    if (musicToggle) musicToggle.classList.add("is-paused");
  }
}

if (musicToggle) {
  musicToggle.addEventListener("click", toggleMusic);
}

// Backup: first user gesture anywhere unlocks audio (doesn't change UX)
document.addEventListener("pointerdown", () => {
  startMusicIfAllowed();
}, { once: true });

// -----------------------------
// ARCHIVE STATE (PERSISTENCE)
// -----------------------------
const ARCHIVE_KEY = "emptychair_archive_v2";
const END_SHOT_NUMBER = 11;
const TOTAL_FRAGMENTS = 10; // shots 1–10 are fragments

let archive = { visited: [], lastShot: null };

function loadArchive() {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.visited)) {
      archive.visited = parsed.visited
        .map(n => parseInt(n, 10))
        .filter(n => Number.isFinite(n));
      archive.lastShot = parsed.lastShot != null ? parseInt(parsed.lastShot, 10) : null;
    }
  } catch {}
}

function saveArchive() {
  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
  } catch {}
}

function clearArchive() {
  archive = { visited: [], lastShot: null };
  try { localStorage.removeItem(ARCHIVE_KEY); } catch {}
}

function getShotNumberByIndex(i) {
  return parseInt(shots[i]?.dataset.shot || String(i + 1), 10);
}

function getIndexByShotNumber(n) {
  return shots.findIndex(s => parseInt(s.dataset.shot, 10) === n);
}

function isVisited(n) {
  return archive.visited.includes(n);
}

function visitedCount() {
  // count only fragments 1–10
  return archive.visited.filter(n => n >= 1 && n <= TOTAL_FRAGMENTS).length;
}

function allFragmentsFound() {
  for (let n = 1; n <= TOTAL_FRAGMENTS; n++) {
    if (!archive.visited.includes(n)) return false;
  }
  return true;
}

function markVisited(n) {
  if (!archive.visited.includes(n)) {
    archive.visited.push(n);
  }
  archive.lastShot = n;
  saveArchive();
}

function pickRandomStartIndex() {
  const nonEnd = shots
    .map((s, i) => ({ i, n: parseInt(s.dataset.shot, 10) }))
    .filter(x => x.n !== END_SHOT_NUMBER);

  const unvisited = nonEnd.filter(x => x.n >= 1 && x.n <= TOTAL_FRAGMENTS && !isVisited(x.n));
  const pool = unvisited.length ? unvisited : nonEnd;

  const chosen = pool[Math.floor(Math.random() * pool.length)];
  return chosen ? chosen.i : 0;
}

// -----------------------------
// RANDOM NAV (ALWAYS RANDOM ON ADVANCE)
// -----------------------------
function pickRandomFragmentIndex({ preferUnvisited = true, preferVisited = false } = {}) {
  const currentN = getShotNumberByIndex(currentShotIndex);

  const candidates = shots
    .map((s, i) => ({ i, n: parseInt(s.dataset.shot, 10) }))
    .filter(x => x.n >= 1 && x.n <= TOTAL_FRAGMENTS)
    .filter(x => x.n !== currentN); // never pick the same fragment

  if (!candidates.length) return currentShotIndex;

  const unvisited = candidates.filter(x => !isVisited(x.n));
  const visited = candidates.filter(x => isVisited(x.n));

  let pool = candidates;
  if (preferUnvisited && unvisited.length) pool = unvisited;
  if (preferVisited && visited.length) pool = visited;

  const chosen = pool[Math.floor(Math.random() * pool.length)];
  return chosen ? chosen.i : currentShotIndex;
}

// -----------------------------
// SMALL UI ELEMENTS WE INJECT (no HTML changes)
// -----------------------------
let fragmentCounterEl = null;
let lastOpenedEl = null;
let flashEl = null;

function ensureInjectedUI() {
  // Use existing fragment counter if it exists; otherwise create it.
  fragmentCounterEl = document.getElementById("fragmentCounter") || fragmentCounterEl;

  if (!fragmentCounterEl) {
    const filmUI = document.querySelector(".film-ui");
    if (filmUI) {
      fragmentCounterEl = document.createElement("div");
      fragmentCounterEl.className = "fragment-counter";
      fragmentCounterEl.id = "fragmentCounter";
      filmUI.appendChild(fragmentCounterEl);
    }
  }

  // Last opened line sits directly UNDER the fragments counter in the SAME column
  if (fragmentCounterEl && !lastOpenedEl) {
    lastOpenedEl = document.createElement("div");
    lastOpenedEl.className = "fragment-counter";
    lastOpenedEl.id = "lastOpenedLine";

    const parent = fragmentCounterEl.parentElement;
    if (parent) {
      parent.insertBefore(lastOpenedEl, fragmentCounterEl.nextSibling);
    } else {
      fragmentCounterEl.appendChild(lastOpenedEl);
    }
  }

  // collection flash overlay
  if (!flashEl) {
    flashEl = document.createElement("div");
    flashEl.className = "collection-flash";
    document.body.appendChild(flashEl);
  }
}

function getLastOpenedLabel() {
  if (!archive.lastShot) return null;
  const idx = getIndexByShotNumber(archive.lastShot);
  if (idx < 0) return null;
  const info = shots[idx].querySelector(".shot-info .shot-info-line:last-child");
  return info ? info.textContent.trim() : null; // ex: "INT. MEMORY"
}

function updateLastOpenedUI() {
  if (!lastOpenedEl) return;
  const label = getLastOpenedLabel();
  lastOpenedEl.textContent = label ? `Last opened: ${label}` : `Last opened: —`;
}

function updateFragmentCounter() {
  if (!fragmentCounterEl) return;
  fragmentCounterEl.textContent = `FRAGMENTS ${visitedCount()} / ${TOTAL_FRAGMENTS}`;
  updateLastOpenedUI();
}

function fireCollectionFlash() {
  if (!flashEl) return;
  flashEl.classList.remove("fire");
  // force reflow so animation can retrigger
  void flashEl.offsetWidth;
  flashEl.classList.add("fire");
}

// -----------------------------
// VIDEO CONTROL
// -----------------------------
function stopAllVideos() {
  shots.forEach((shot) => {
    const v = shot.querySelector("video.shot-film");
    if (!v) return;
    v.pause();
  });
}

async function playActiveShotVideo() {
  const activeShot = shots[currentShotIndex];
  const v = activeShot.querySelector("video.shot-film");
  if (!v) return;

  try { v.currentTime = 0; } catch {}
  v.load();

  await Promise.resolve();

  const p = v.play();
  if (p && typeof p.catch === "function") {
    p.catch((err) => console.warn("Video play blocked or delayed:", err));
  }
}

function attachVideoRecovery() {
  shots.forEach((shot) => {
    const v = shot.querySelector("video.shot-film");
    if (!v) return;

    v.addEventListener("stalled", () => {
      v.load();
      v.play().catch(() => {});
    });

    v.addEventListener("error", () => {
      console.warn("Video error:", v.currentSrc);
    });
  });
}

// -----------------------------
// 24fps timecode helpers
// -----------------------------
function timecodeToSeconds(tc) {
  const [hh, mm, ss, ff] = tc.split(":").map((n) => parseInt(n, 10) || 0);
  return hh * 3600 + mm * 60 + ss + ff / 24;
}

function secondsToTimecode(seconds) {
  const fps = 24;
  const totalFrames = Math.floor(seconds * fps);

  const hh = Math.floor(totalFrames / (fps * 3600));
  const remH = totalFrames % (fps * 3600);

  const mm = Math.floor(remH / (fps * 60));
  const remM = remH % (fps * 60);

  const ss = Math.floor(remM / fps);
  const ff = remM % fps;

  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
}

// -----------------------------
// Timecode loop (runs per shot)
// -----------------------------
let rafId = null;
let shotStartSeconds = 0;
let shotStartPerf = 0;

function flashTimecode() {
  if (!timecodeUI) return;
  timecodeUI.classList.add("flash");
  setTimeout(() => timecodeUI.classList.remove("flash"), 800);
}

function startTimecodeForCurrentShot() {
  if (!timecodeUI) return;

  const startTC = shots[currentShotIndex].dataset.time || "00:00:00:00";
  shotStartSeconds = timecodeToSeconds(startTC);
  shotStartPerf = performance.now();

  if (rafId) cancelAnimationFrame(rafId);

  const tick = () => {
    const elapsed = (performance.now() - shotStartPerf) / 1000;
    timecodeUI.textContent = secondsToTimecode(shotStartSeconds + elapsed);
    rafId = requestAnimationFrame(tick);
  };

  tick();
  flashTimecode();
}

// -----------------------------
// Shot numbers (right side)
// -----------------------------
function buildShotNumbers() {
  if (!shotNumbersWrap) return;

  shotNumbersWrap.innerHTML = "";

  shots.forEach((shot, i) => {
    const shotNumber = parseInt(shot.dataset.shot, 10);

    const num = document.createElement("div");
    num.className = "shotnum";
    num.textContent = String(shotNumber).padStart(2, "0");
    num.dataset.index = String(i);
    num.dataset.shot = String(shotNumber);

    num.addEventListener("click", (e) => {
      e.stopPropagation();
      showShot(i);
    });

    shotNumbersWrap.appendChild(num);
  });

  updateShotNumbersUI();
}

function updateShotNumbersUI() {
  if (shotCounterUI) {
    shotCounterUI.textContent =
      `${String(currentShotIndex + 1).padStart(2, "0")} / ${String(shots.length).padStart(2, "0")}`;
  }

  updateFragmentCounter();

  const nums = Array.from(document.querySelectorAll(".shotnum"));
  nums.forEach((el, i) => {
    const n = parseInt(el.dataset.shot, 10);

    // reset states
    el.classList.remove("active", "visited", "unvisited", "locked");

    // lock the end shot until all fragments found
    if (n === END_SHOT_NUMBER && !allFragmentsFound()) {
      el.classList.add("locked");
      el.style.pointerEvents = "none";
      el.style.opacity = "0.22";
    } else if (n === END_SHOT_NUMBER) {
      el.style.pointerEvents = "auto";
      el.style.opacity = "";
    }

    // ACTIVE should be bright white with NO DOTS:
    // so we DO NOT apply visited/unvisited to the active one.
    if (i === currentShotIndex) {
      el.classList.add("active");
      return;
    }

    // only fragments 1–10 get visited/unvisited behavior
    if (n >= 1 && n <= TOTAL_FRAGMENTS) {
      el.classList.add(isVisited(n) ? "visited" : "unvisited");
    }
  });

  updateEndLockOverlay();
}

// -----------------------------
// END CARD LOCK OVERLAY
// -----------------------------
function updateEndLockOverlay() {
  const endIndex = getIndexByShotNumber(END_SHOT_NUMBER);
  if (endIndex < 0) return;

  const endShot = shots[endIndex];
  const endcard = endShot.querySelector(".endcard");
  if (!endcard) return;

  let overlay = endcard.querySelector(".end-lock");

  if (allFragmentsFound()) {
    if (overlay) overlay.remove();
    return;
  }

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "end-lock";

    const title = document.createElement("div");
    title.className = "end-lock-title";
    title.textContent = "Ending locked — keep collecting";

    const pips = document.createElement("div");
    pips.className = "end-lock-pips";
    for (let i = 1; i <= TOTAL_FRAGMENTS; i++) {
      const pip = document.createElement("div");
      pip.className = "end-lock-pip";
      pip.dataset.pip = String(i);
      pips.appendChild(pip);
    }

    const btn = document.createElement("button");
    btn.className = "keep-wandering";
    btn.type = "button";
    btn.textContent = "Keep wandering";

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      // jump to a random unvisited fragment
      const next = pickRandomFragmentIndex({ preferUnvisited: true });
      showShot(next);
    });

    overlay.appendChild(title);
    overlay.appendChild(pips);
    overlay.appendChild(btn);

    endcard.appendChild(overlay);
  }

  // update pip fill state
  const pipEls = overlay.querySelectorAll(".end-lock-pip");
  pipEls.forEach((pipEl) => {
    const n = parseInt(pipEl.dataset.pip, 10);
    pipEl.classList.toggle("filled", isVisited(n));
  });
}

// -----------------------------
// Show a shot (fade swap)
// -----------------------------
function showShot(index) {
  const targetIndex = (index + shots.length) % shots.length;
  const targetShotNumber = getShotNumberByIndex(targetIndex);

  // Block end until all fragments found
  if (targetShotNumber === END_SHOT_NUMBER && !allFragmentsFound()) {
    updateEndLockOverlay();
    return;
  }

  // remove old
  shots[currentShotIndex].classList.remove("active");

  // swap
  currentShotIndex = targetIndex;
  shots[currentShotIndex].classList.add("active");

  const n = getShotNumberByIndex(currentShotIndex);

  // Determine if new fragment BEFORE marking visited
  const isNewFragment = (n >= 1 && n <= TOTAL_FRAGMENTS && !isVisited(n));

  // persist
  markVisited(n);

  // UI reactions
  if (isNewFragment) fireCollectionFlash();

  updateShotNumbersUI();
  startTimecodeForCurrentShot();

  stopAllVideos();
  playActiveShotVideo();
}

// -----------------------------
// RANDOMIZED NAV (scroll/click/keys use these)
// -----------------------------
function nextShot() {
  // If everything is collected, NEXT should take you to the ending (shot 11)
  if (allFragmentsFound()) {
    const endIndex = getIndexByShotNumber(END_SHOT_NUMBER);
    const currentN = getShotNumberByIndex(currentShotIndex);

    if (endIndex >= 0 && currentN !== END_SHOT_NUMBER) {
      showShot(endIndex);
      return;
    }
    // If you're already on the ending and keep scrolling, keep wandering randomly
  }

  // Otherwise: always random jump (prefer unvisited)
  const next = pickRandomFragmentIndex({ preferUnvisited: true });
  showShot(next);
}

function previousShot() {
  // Random jump (prefer visited so it feels like “back through memory”)
  const prev = pickRandomFragmentIndex({ preferUnvisited: false, preferVisited: true });
  showShot(prev);
}

// -----------------------------
// Enter / Reset
// -----------------------------
function enterFilm(e) {
  if (e) e.stopPropagation();

  // Start music on user gesture
  startMusicIfAllowed();

  ensureInjectedUI();

  const startIndex = pickRandomStartIndex();

  shots.forEach((s) => s.classList.remove("active"));
  currentShotIndex = startIndex;
  shots[currentShotIndex].classList.add("active");

  openingScreen.classList.add("hidden");

  const n = getShotNumberByIndex(currentShotIndex);
  const isNewFragment = (n >= 1 && n <= TOTAL_FRAGMENTS && !isVisited(n));
  markVisited(n);

  if (isNewFragment) fireCollectionFlash();

  updateShotNumbersUI();
  startTimecodeForCurrentShot();

  stopAllVideos();
  playActiveShotVideo();

  blockAdvanceUntil = performance.now() + 350;
}

function resetToOpening() {
  if (rafId) cancelAnimationFrame(rafId);

  stopAllVideos();

  shots.forEach((s) => s.classList.remove("active"));
  currentShotIndex = 0;

  if (timecodeUI) timecodeUI.textContent = "00:00:00:00";
  updateShotNumbersUI();

  openingScreen.classList.remove("hidden");
  blockAdvanceUntil = performance.now() + 350;
}

// -----------------------------
// Controls (click + keyboard)
// -----------------------------
if (openingScreen) openingScreen.addEventListener("click", enterFilm);

document.addEventListener("click", (e) => {
  if (!openingScreen.classList.contains("hidden")) return;
  if (performance.now() < blockAdvanceUntil) return;

  if (e.target.closest("#shotlist")) return;
  if (e.target.closest("#beginAgain")) return;
  if (e.target.closest("#musicToggle")) return; 

  nextShot();
});

document.addEventListener("keydown", (e) => {
  if (!openingScreen.classList.contains("hidden")) return;
  if (performance.now() < blockAdvanceUntil) return;

  if (e.key === "ArrowRight" || e.key === " ") {
    e.preventDefault();
    nextShot(); // random (or ending when complete)
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    previousShot(); // random
  }
});

if (beginAgainButton) {
  beginAgainButton.addEventListener("click", (e) => {
    e.stopPropagation();

    // RESET EVERYTHING on Begin Again
    clearArchive();
    updateShotNumbersUI();
    updateLastOpenedUI();

    resetToOpening();
  });
}

function init() {
  loadArchive();
  ensureInjectedUI();

  // hide all shots until entering
  shots.forEach((s) => s.classList.remove("active"));
  stopAllVideos();

  buildShotNumbers();
  updateShotNumbersUI();

  if (timecodeUI) timecodeUI.textContent = "00:00:00:00";
  attachVideoRecovery();
}

init();

// =============================
// SCROLL / SWIPE NAV
// =============================
function isInFilmMode() {
  return openingScreen && openingScreen.classList.contains("hidden");
}

function closestScrollable(el) {
  while (el && el !== document.body) {
    const style = getComputedStyle(el);
    const canScrollY =
      (style.overflowY === "auto" || style.overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight;
    if (canScrollY) return el;
    el = el.parentElement;
  }
  return null;
}

function canScrollInDirection(scroller, direction /* 1=down, -1=up */) {
  if (!scroller) return false;
  const top = scroller.scrollTop;
  const maxTop = scroller.scrollHeight - scroller.clientHeight;
  if (direction > 0) return top < maxTop - 1;
  return top > 1;
}

/* DESKTOP wheel */
let wheelLocked = false;
let wheelEndTimer = null;
const WHEEL_END_MS = 140;

function onWheelNav(e) {
  if (!isInFilmMode()) return;
  if (performance.now() < blockAdvanceUntil) return;

  const scroller = closestScrollable(e.target);
  if (scroller) return;

  e.preventDefault();

  clearTimeout(wheelEndTimer);
  wheelEndTimer = setTimeout(() => (wheelLocked = false), WHEEL_END_MS);

  if (wheelLocked) return;

  const dy = e.deltaY || 0;
  if (Math.abs(dy) < 3) return;

  wheelLocked = true;
  if (dy > 0) nextShot();       // random (or ending when complete)
  else previousShot();          // random
}

document.addEventListener("wheel", onWheelNav, { passive: false });

/* MOBILE swipe */
let touchStartX = 0;
let touchStartY = 0;
let touchScroller = null;
let touchMoved = false;
let touchNavLocked = false;

const SWIPE_MIN_Y = 45;
const SWIPE_MAX_X = 70;
const NAV_LOCK_MS = 220;

document.addEventListener("touchstart", (e) => {
  if (!isInFilmMode()) return;
  if (performance.now() < blockAdvanceUntil) return;

  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  touchMoved = false;
  touchScroller = closestScrollable(e.target);
}, { passive: true });

document.addEventListener("touchmove", (e) => {
  if (!isInFilmMode()) return;
  if (performance.now() < blockAdvanceUntil) return;

  const t = e.touches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;

  if (Math.abs(dx) > Math.abs(dy)) return;

  const direction = dy < 0 ? 1 : -1;
  if (touchScroller && canScrollInDirection(touchScroller, direction)) return;

  touchMoved = true;
  e.preventDefault();
}, { passive: false });

document.addEventListener("touchend", (e) => {
  if (!isInFilmMode()) return;
  if (performance.now() < blockAdvanceUntil) return;
  if (!touchMoved) return;
  if (touchNavLocked) return;

  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;

  if (Math.abs(dy) < SWIPE_MIN_Y) return;
  if (Math.abs(dx) > SWIPE_MAX_X) return;

  touchNavLocked = true;
  setTimeout(() => (touchNavLocked = false), NAV_LOCK_MS);

  if (dy < 0) nextShot();       // random (or ending when complete)
  else previousShot();          // random
}, { passive: true });
