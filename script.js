const openingScreen = document.getElementById("openingDoor");
const timecodeUI = document.getElementById("timecode");
const beginAgainButton = document.getElementById("beginAgain");

const shots = Array.from(document.querySelectorAll(".shot"));
const shotNumbersWrap = document.getElementById("shotNums");
const shotCounterUI = document.getElementById("shotCount"); // optional

let currentShotIndex = 0;

// prevents the same click from triggering enter/reset + next
let blockAdvanceUntil = 0;

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
  // optional: "01 / 11"
  if (shotCounterUI) {
    shotCounterUI.textContent =
      `${String(currentShotIndex + 1).padStart(2, "0")} / ${String(shots.length).padStart(2, "0")}`;
  }

  // ONLY the current one is white
  const nums = Array.from(document.querySelectorAll(".shotnum"));
  nums.forEach((el, i) => {
    el.classList.toggle("active", i === currentShotIndex);
  });
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
}

function nextShot() {
  showShot(currentShotIndex + 1);
}

function previousShot() {
  showShot(currentShotIndex - 1);
}

// -----------------------------
// Enter / Reset
// -----------------------------
function enterFilm(e) {
  if (e) e.stopPropagation();

  // Always start at Shot 1
  shots.forEach((s) => s.classList.remove("active"));
  currentShotIndex = 0;
  shots[0].classList.add("active");

  openingScreen.classList.add("hidden");
  updateShotNumbersUI();
  startTimecodeForCurrentShot();

  // block the same click from advancing
  blockAdvanceUntil = performance.now() + 350;
}

function resetToOpening() {
  if (rafId) cancelAnimationFrame(rafId);

  // reset the film state
  shots.forEach((s) => s.classList.remove("active"));
  currentShotIndex = 0;
  shots[0].classList.add("active");

  if (timecodeUI) timecodeUI.textContent = "00:00:00:00";

  updateShotNumbersUI();
  openingScreen.classList.remove("hidden");

  // block accidental advance
  blockAdvanceUntil = performance.now() + 350;
}

// -----------------------------
// Controls (click + keyboard)
// -----------------------------
if (openingScreen) {
  openingScreen.addEventListener("click", enterFilm);
}

document.addEventListener("click", (e) => {
  // if opening is visible, don't advance (opening click handles enter)
  if (!openingScreen.classList.contains("hidden")) return;

  // block right after enter/reset
  if (performance.now() < blockAdvanceUntil) return;

  // don't advance if clicking shot list or Begin Again
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

// -----------------------------
// Preload chair images (smoother fades)
// -----------------------------
(function preloadChairImages() {
  shots.forEach((shot) => {
    const img = shot.querySelector(".chair-image");
    if (!img) return;
    const pre = new Image();
    pre.src = img.src;
  });
})();

// -----------------------------
// Init
// -----------------------------
buildShotNumbers();
updateShotNumbersUI();
if (timecodeUI) timecodeUI.textContent = "00:00:00:00";
