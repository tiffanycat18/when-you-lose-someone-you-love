const openingScreen = document.getElementById("openingDoor");
const timecodeUI = document.getElementById("timecode");
const beginAgainButton = document.getElementById("beginAgain");

const shots = Array.from(document.querySelectorAll(".shot"));
const shotNumbersWrap = document.getElementById("shotNums");
const shotCounterUI = document.getElementById("shotCount"); 

let currentShotIndex = 0;
let blockAdvanceUntil = 0;

// -----------------------------
// VIDEO CONTROL (prevents freezing)
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

  // force-load + restart so I don't get a stuck first frame
  try {
    v.currentTime = 0;
  } catch (e) {}

  // If it hasn't loaded yet, calling load() helps
  v.load();

  // Wait a microtask so class changes/layout settle
  await Promise.resolve();

  const p = v.play();
  if (p && typeof p.catch === "function") {
    p.catch((err) => {
      // Usually harmless (autoplay policy / not enough data yet)
      console.warn("Video play blocked or delayed:", err);
    });
  }
}

// if a video stalls, try to recover
function attachVideoRecovery() {
  shots.forEach((shot) => {
    const v = shot.querySelector("video.shot-film");
    if (!v) return;

    v.addEventListener("stalled", () => {
      // quick nudge
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

  shots.forEach((_, i) => {
    const num = document.createElement("div");
    num.className = "shotnum";
    num.textContent = String(i + 1).padStart(2, "0");
    num.dataset.index = String(i);

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

  const nums = Array.from(document.querySelectorAll(".shotnum"));
  nums.forEach((el, i) => el.classList.toggle("active", i === currentShotIndex));
}

// -----------------------------
// Show a shot (fade swap)
// -----------------------------
function showShot(index) {
  // remove old
  shots[currentShotIndex].classList.remove("active");

  // wrap around
  currentShotIndex = (index + shots.length) % shots.length;

  // add new
  shots[currentShotIndex].classList.add("active");

  updateShotNumbersUI();
  startTimecodeForCurrentShot();

  // VIDEO: only play the active shot video
  stopAllVideos();
  playActiveShotVideo();
}

function nextShot() { showShot(currentShotIndex + 1); }
function previousShot() { showShot(currentShotIndex - 1); }

// -----------------------------
// Enter / Reset
// -----------------------------
function enterFilm(e) {
  if (e) e.stopPropagation();

  // start at shot 1
  shots.forEach((s) => s.classList.remove("active"));
  currentShotIndex = 0;
  shots[0].classList.add("active");

  openingScreen.classList.add("hidden");
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

  nextShot();
});

document.addEventListener("keydown", (e) => {
  if (!openingScreen.classList.contains("hidden")) return;
  if (performance.now() < blockAdvanceUntil) return;

  if (e.key === "ArrowRight" || e.key === " ") {
    e.preventDefault();
    nextShot();
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    previousShot();
  }
});

if (beginAgainButton) {
  beginAgainButton.addEventListener("click", (e) => {
    e.stopPropagation();
    resetToOpening();
  });
}

function init() {
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
// SCROLL / SWIPE NAVIGATION
// =============================
let wheelLockUntil = 0;

function onWheelAdvance(e) {
  if (!openingScreen.classList.contains("hidden")) return;
  if (performance.now() < blockAdvanceUntil) return;

  // stop scrolling the page while navigating shots
  e.preventDefault();

  // simple throttle so one scroll gesture = one shot
  if (performance.now() < wheelLockUntil) return;
  wheelLockUntil = performance.now() + 450;

  const delta = e.deltaY || e.wheelDelta || 0;
  if (delta > 0) nextShot();
  else if (delta < 0) previousShot();
}

// passive:false so preventDefault works
window.addEventListener("wheel", onWheelAdvance, { passive: false });


// --- Mobile touch swipe (vertical) ---
let touchStartY = 0;
let touchStartX = 0;

function onTouchStart(e) {
  if (!openingScreen.classList.contains("hidden")) return;
  if (performance.now() < blockAdvanceUntil) return;
  const t = e.touches[0];
  touchStartY = t.clientY;
  touchStartX = t.clientX;
}

function onTouchEnd(e) {
  if (!openingScreen.classList.contains("hidden")) return;
  if (performance.now() < blockAdvanceUntil) return;

  const t = e.changedTouches[0];
  const dy = t.clientY - touchStartY;
  const dx = t.clientX - touchStartX;

  // prefer vertical swipe; ignore tiny moves
  if (Math.abs(dy) < 40) return;
  if (Math.abs(dy) < Math.abs(dx)) return;

  // swipe up = next, swipe down = previous
  if (dy < 0) nextShot();
  else previousShot();
}

window.addEventListener("touchstart", onTouchStart, { passive: true });
window.addEventListener("touchend", onTouchEnd, { passive: true });
