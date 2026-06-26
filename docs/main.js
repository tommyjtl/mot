import { animate, inView, stagger } from "https://cdn.jsdelivr.net/npm/motion@12.41.0/+esm";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (reducedMotion) {
  document.documentElement.classList.add("reduce-motion");
}

const HERO_HEADLINE_PHRASES = [
  { lang: "en", lines: ["Learn French", "as you browse."] },
  { lang: "fr", lines: ["Apprenez le français", "en naviguant."] },
];
const HERO_HEADLINE_INTERVAL_MS = 3000;
const HERO_DIGIT_STAGGER_MS = 35;
const HERO_DIGIT_DUR_MS = 500;
const HERO_DIGIT_FADE_OUT_S = 0.22;

/** @param {HTMLElement} lineEl @param {string} text */
function buildLineDigits(lineEl, text) {
  lineEl.replaceChildren();

  let stagger = 0;
  const parts = text.split(/(\s+)/);

  for (const part of parts) {
    if (!part) {
      continue;
    }

    if (/^\s+$/.test(part)) {
      const space = document.createElement("span");
      space.className = "t-space";
      space.setAttribute("aria-hidden", "true");
      space.textContent = " ";
      lineEl.appendChild(space);
      continue;
    }

    const word = document.createElement("span");
    word.className = "t-word";

    for (const char of part) {
      const digit = document.createElement("span");
      digit.className = "t-digit";
      digit.textContent = char;
      if (stagger > 0) {
        digit.style.animationDelay = `${stagger * HERO_DIGIT_STAGGER_MS}ms`;
      }
      word.appendChild(digit);
      stagger += 1;
    }

    lineEl.appendChild(word);
  }
}

/** @param {HTMLElement} group @param {{ lang: string, lines: string[] }} phrase @param {boolean} fillDigits */
function buildHeadlineRows(group, phrase, fillDigits) {
  group.replaceChildren();
  group.lang = phrase.lang;

  for (const lineText of phrase.lines) {
    const row = document.createElement("span");
    row.className = "hero-headline-row";

    const lineEl = document.createElement("span");
    lineEl.className = "hero-headline-line";
    if (fillDigits) {
      buildLineDigits(lineEl, lineText);
    }
    row.appendChild(lineEl);
    group.appendChild(row);
  }
}

/** @param {HTMLElement} group */
function getHeadlineLines(group) {
  return [...group.querySelectorAll(".hero-headline-line")].filter(
    (line) => line instanceof HTMLElement,
  );
}

/** @param {HTMLElement} lineEl */
function playLinePopIn(lineEl) {
  lineEl.classList.remove("is-animating");
  void lineEl.offsetWidth;
  lineEl.classList.add("is-animating");
}

/** @param {HTMLElement} lineEl */
function waitForLinePopIn(lineEl) {
  const digitCount = lineEl.querySelectorAll(".t-digit").length;
  const durationMs =
    digitCount > 0
      ? (digitCount - 1) * HERO_DIGIT_STAGGER_MS + HERO_DIGIT_DUR_MS
      : 0;

  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

/** @param {HTMLElement} lineEl */
async function fadeOutLineDigits(lineEl) {
  const digits = [...lineEl.querySelectorAll(".t-digit")].filter(
    (digit) => digit instanceof HTMLElement,
  );

  if (digits.length === 0) {
    return;
  }

  lineEl.classList.remove("is-animating");

  await Promise.all(
    digits.map((digit, index) =>
      animate(
        digit,
        {
          opacity: [1, 0],
          y: [0, -6],
          filter: ["blur(0px)", "blur(4px)"],
        },
        {
          duration: HERO_DIGIT_FADE_OUT_S,
          delay: index * 0.025,
          ease: [0.4, 0, 1, 1],
        },
      ),
    ),
  );

  lineEl.replaceChildren();
}

/** @param {HTMLElement} lineEl @param {string} text */
async function replaceLineWithPopIn(lineEl, text) {
  buildLineDigits(lineEl, text);
  playLinePopIn(lineEl);
  await waitForLinePopIn(lineEl);
  lineEl.classList.remove("is-animating");
}

function setupHeroHeadline() {
  const group = document.querySelector("[data-hero-headline]");
  if (!(group instanceof HTMLElement)) {
    return;
  }

  let phraseIndex = 0;
  let transitioning = false;

  if (reducedMotion) {
    buildHeadlineRows(group, HERO_HEADLINE_PHRASES[0], true);
    return;
  }

  buildHeadlineRows(group, HERO_HEADLINE_PHRASES[0], false);

  const animatePhraseIn = async (phrase) => {
    const lineEls = getHeadlineLines(group);

    for (let index = 0; index < lineEls.length; index += 1) {
      await replaceLineWithPopIn(lineEls[index], phrase.lines[index] ?? "");
    }
  };

  const transitionToPhrase = async (nextIndex) => {
    if (transitioning || nextIndex === phraseIndex) {
      return;
    }

    transitioning = true;
    const phrase = HERO_HEADLINE_PHRASES[nextIndex];
    const lineEls = getHeadlineLines(group);
    group.lang = phrase.lang;

    for (let index = 0; index < lineEls.length; index += 1) {
      await fadeOutLineDigits(lineEls[index]);
      await replaceLineWithPopIn(lineEls[index], phrase.lines[index] ?? "");
    }

    phraseIndex = nextIndex;
    transitioning = false;
  };

  const scheduleNextTransition = () => {
    window.setTimeout(async () => {
      await transitionToPhrase((phraseIndex + 1) % HERO_HEADLINE_PHRASES.length);
      scheduleNextTransition();
    }, HERO_HEADLINE_INTERVAL_MS);
  };

  void (async () => {
    await animatePhraseIn(HERO_HEADLINE_PHRASES[0]);
    scheduleNextTransition();
  })();
}

if (!reducedMotion) {
  animate(
    ".hero-banner",
    { opacity: [0, 1], y: [18, 0] },
    { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  );

  inView(
    ".feature-reveal",
    (element) => {
      animate(
        element,
        { opacity: [0, 1], y: [22, 0] },
        { duration: 0.5, ease: "easeOut" },
      );
    },
    { amount: 0.25, once: true },
  );

  inView(
    ".section-reveal",
    (element) => {
      animate(
        element,
        { opacity: [0, 1], y: [22, 0] },
        { duration: 0.5, ease: "easeOut" },
      );
    },
    { amount: 0.15, once: true },
  );

  inView(
    ".trust-grid",
    () => {
      animate(
        ".trust-card",
        { opacity: [0, 1], y: [14, 0] },
        { delay: stagger(0.08), duration: 0.4, ease: "easeOut" },
      );
    },
    { amount: 0.2, once: true },
  );

  inView(
    ".pillars-list",
    () => {
      animate(
        ".pillar-item",
        { opacity: [0, 1], y: [14, 0] },
        { delay: stagger(0.08), duration: 0.4, ease: "easeOut" },
      );
    },
    { amount: 0.2, once: true },
  );
}

const FEATURE_VISIBILITY_THRESHOLD = 0.6;

/** @type {HTMLElement | null} */
let activeFeatureRow = null;
/** @type {HTMLElement | null} */
let audioFeatureRow = null;
/** @type {number | null} */
let progressAnimationFrame = null;

function getFeatureRows() {
  return [...document.querySelectorAll(".feature-row")];
}

/** @param {HTMLElement} row */
function getFeatureVideo(row) {
  return row.querySelector(".feature-media-frame video");
}

/** @param {HTMLElement} row */
function getFeaturePlayer(row) {
  return row.querySelector("[data-feature-demo]");
}

/** @param {HTMLElement} row */
function updateFeatureProgress(row) {
  const video = getFeatureVideo(row);
  const fill = row.querySelector(".feature-demo-progress-fill");
  const bar = row.querySelector(".feature-demo-progress");

  if (!video || !fill || !Number.isFinite(video.duration) || video.duration <= 0) {
    return;
  }

  const percent = (video.currentTime / video.duration) * 100;
  fill.style.width = `${percent}%`;
  bar?.setAttribute("aria-valuenow", String(Math.round(percent)));
}

/** @param {HTMLElement} row */
function syncFeaturePlayButton(row) {
  const video = getFeatureVideo(row);
  const button = row.querySelector('[data-action="toggle-play"]');

  if (!video || !button) {
    return;
  }

  const isPlaying = !video.paused;
  button.classList.toggle("is-playing", isPlaying);
  button.setAttribute("aria-label", isPlaying ? "Pause demo" : "Play demo");
}

/** @param {HTMLElement} row */
function syncFeatureAudioButton(row) {
  const video = getFeatureVideo(row);
  const button = row.querySelector('[data-action="toggle-audio"]');

  if (!video || !button) {
    return;
  }

  const hasAudio = row === audioFeatureRow && !video.muted;
  button.classList.toggle("is-audio-on", hasAudio);
  button.setAttribute("aria-pressed", hasAudio ? "true" : "false");
  button.setAttribute("aria-label", hasAudio ? "Mute audio" : "Play audio");
}

function syncFeatureMediaFrames() {
  getFeatureRows().forEach((row) => {
    const frame = row.querySelector(".feature-media-frame");
    const video = getFeatureVideo(row);
    if (!frame) {
      return;
    }

    const audioOn = row === audioFeatureRow && video !== null && !video.muted;
    frame.classList.toggle("is-audio-active", audioOn);
    frame.classList.toggle("is-paused", video !== null && video.paused && row !== activeFeatureRow);
  });
}

/** @param {HTMLElement} row */
function syncFeatureRowUI(row) {
  const isActive = row === activeFeatureRow;
  getFeaturePlayer(row)?.classList.toggle("is-active", isActive);
  syncFeaturePlayButton(row);
  syncFeatureAudioButton(row);

  if (!isActive) {
    const fill = row.querySelector(".feature-demo-progress-fill");
    const bar = row.querySelector(".feature-demo-progress");
    fill?.style.setProperty("width", "0%");
    bar?.setAttribute("aria-valuenow", "0");
  }
}

function syncAllFeatureRowsUI() {
  getFeatureRows().forEach(syncFeatureRowUI);
  syncFeatureMediaFrames();
}

function stopFeatureProgressLoop() {
  if (progressAnimationFrame !== null) {
    cancelAnimationFrame(progressAnimationFrame);
    progressAnimationFrame = null;
  }
}

function startFeatureProgressLoop() {
  stopFeatureProgressLoop();

  const tick = () => {
    if (activeFeatureRow) {
      updateFeatureProgress(activeFeatureRow);
      progressAnimationFrame = requestAnimationFrame(tick);
    }
  };

  progressAnimationFrame = requestAnimationFrame(tick);
}

/** @param {HTMLElement | null} exceptRow */
function muteAllFeatureVideos(exceptRow = null) {
  getFeatureRows().forEach((row) => {
    const video = getFeatureVideo(row);
    if (!video) {
      return;
    }

    if (row !== exceptRow) {
      video.muted = true;
    }
  });
}

/** @param {HTMLElement} row */
function clearFeatureAudio(row) {
  const video = getFeatureVideo(row);
  if (video) {
    video.muted = true;
  }

  if (audioFeatureRow === row) {
    audioFeatureRow = null;
  }
}

/** @param {HTMLElement} row */
async function enableFeatureAudio(row) {
  if (activeFeatureRow && activeFeatureRow !== row) {
    await activateFeatureRow(row, { restart: true });
  }

  if (!activeFeatureRow) {
    await activateFeatureRow(row, { restart: true });
  }

  const video = getFeatureVideo(row);
  if (!video) {
    return;
  }

  audioFeatureRow = row;
  muteAllFeatureVideos(row);
  video.muted = false;

  if (video.paused) {
    await playFeatureVideo(row);
  }

  syncAllFeatureRowsUI();
}

/** @param {HTMLElement} row */
async function playFeatureVideo(row) {
  const video = getFeatureVideo(row);
  if (!video) {
    return;
  }

  try {
    await video.play();
  } catch {
    // Browser blocked playback.
  }

  syncFeaturePlayButton(row);
  syncFeatureMediaFrames();
}

/** @param {HTMLElement} row */
function pauseFeatureVideo(row) {
  const video = getFeatureVideo(row);
  if (!video) {
    return;
  }

  video.pause();
  syncFeaturePlayButton(row);
  syncFeatureMediaFrames();
}

/** @param {HTMLElement} row */
function deactivateFeatureRow(row) {
  pauseFeatureVideo(row);
  clearFeatureAudio(row);

  if (activeFeatureRow === row) {
    activeFeatureRow = null;
    stopFeatureProgressLoop();
  }

  syncAllFeatureRowsUI();
}

/** @param {HTMLElement} row @param {{ restart?: boolean }} [options] */
async function activateFeatureRow(row, { restart = false } = {}) {
  if (activeFeatureRow && activeFeatureRow !== row) {
    deactivateFeatureRow(activeFeatureRow);
  }

  activeFeatureRow = row;
  const video = getFeatureVideo(row);

  if (!video) {
    return;
  }

  if (restart) {
    video.currentTime = 0;
    clearFeatureAudio(row);
  }

  video.muted = row !== audioFeatureRow;
  muteAllFeatureVideos(row === audioFeatureRow ? row : null);

  if (row === audioFeatureRow) {
    video.muted = false;
  }

  await playFeatureVideo(row);
  syncAllFeatureRowsUI();
  startFeatureProgressLoop();
}

/** @param {number} [threshold] */
function getMostVisibleFeatureRow(threshold = FEATURE_VISIBILITY_THRESHOLD) {
  const viewportHeight = window.innerHeight;
  /** @type {HTMLElement | null} */
  let bestRow = null;
  let bestRatio = -1;

  getFeatureRows().forEach((row) => {
    const frame = row.querySelector(".feature-media-frame");
    if (!frame) {
      return;
    }

    const rect = frame.getBoundingClientRect();
    if (rect.height <= 0) {
      return;
    }

    const visibleHeight =
      Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
    const ratio = Math.max(0, visibleHeight) / rect.height;

    if (ratio >= threshold && ratio > bestRatio) {
      bestRatio = ratio;
      bestRow = row;
    }
  });

  return bestRow;
}

function syncActiveFeatureRowFromScroll() {
  const row = getMostVisibleFeatureRow();

  if (!row) {
    if (activeFeatureRow) {
      deactivateFeatureRow(activeFeatureRow);
    }
    return;
  }

  if (row !== activeFeatureRow) {
    void activateFeatureRow(row, { restart: true });
  }
}

/** @param {HTMLElement} row */
async function handleFeatureTogglePlay(row) {
  if (row !== activeFeatureRow) {
    await activateFeatureRow(row, { restart: true });
    return;
  }

  const video = getFeatureVideo(row);
  if (!video) {
    return;
  }

  if (video.paused) {
    await playFeatureVideo(row);
    startFeatureProgressLoop();
  } else {
    pauseFeatureVideo(row);
    stopFeatureProgressLoop();
  }
}

/** @param {HTMLElement} row */
async function handleFeatureRestart(row) {
  if (row !== activeFeatureRow) {
    await activateFeatureRow(row, { restart: true });
    return;
  }

  const video = getFeatureVideo(row);
  if (!video) {
    return;
  }

  video.currentTime = 0;
  updateFeatureProgress(row);
  await playFeatureVideo(row);
  startFeatureProgressLoop();
}

/** @param {HTMLElement} row */
async function handleFeatureToggleAudio(row) {
  if (row !== activeFeatureRow) {
    await activateFeatureRow(row, { restart: true });
    await enableFeatureAudio(row);
    return;
  }

  if (audioFeatureRow === row) {
    clearFeatureAudio(row);
    syncAllFeatureRowsUI();
    return;
  }

  await enableFeatureAudio(row);
}

function setupFeatureDemoControls() {
  const featuresSection = document.querySelector(".features");
  if (!featuresSection) {
    return;
  }

  featuresSection.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest("[data-action]");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const row = button.closest(".feature-row");
    if (!(row instanceof HTMLElement)) {
      return;
    }

    const action = button.dataset.action;

    if (action === "toggle-play") {
      void handleFeatureTogglePlay(row);
      return;
    }

    if (action === "restart") {
      void handleFeatureRestart(row);
      return;
    }

    if (action === "toggle-audio") {
      void handleFeatureToggleAudio(row);
    }
  });
}

function setupFeatureScrollPlayback() {
  const rowVisibility = new Map();

  getFeatureRows().forEach((row) => {
    const frame = row.querySelector(".feature-media-frame");
    if (!frame) {
      return;
    }

    rowVisibility.set(row, 0);

    const observer = new IntersectionObserver(
      ([entry]) => {
        rowVisibility.set(row, entry.intersectionRatio);

        /** @type {HTMLElement | null} */
        let bestRow = null;
        let bestRatio = -1;

        rowVisibility.forEach((ratio, candidate) => {
          if (ratio >= FEATURE_VISIBILITY_THRESHOLD && ratio > bestRatio) {
            bestRatio = ratio;
            bestRow = candidate;
          }
        });

        if (bestRow) {
          if (bestRow !== activeFeatureRow) {
            void activateFeatureRow(bestRow, { restart: true });
          }
          return;
        }

        if (activeFeatureRow && row === activeFeatureRow) {
          deactivateFeatureRow(activeFeatureRow);
        }
      },
      {
        threshold: [0, 0.2, 0.4, FEATURE_VISIBILITY_THRESHOLD, 0.75, 1],
      },
    );

    observer.observe(frame);
  });

  syncActiveFeatureRowFromScroll();
}

setupHeroHeadline();
setupFeatureDemoControls();
setupFeatureScrollPlayback();
syncAllFeatureRowsUI();
