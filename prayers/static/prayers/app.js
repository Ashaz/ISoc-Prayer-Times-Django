// ==============================
// DEV TIME OVERRIDE (TESTING)
// ==============================
const DEV_NOW = null; // e.g. "06:55" or null

function getNow() {
  if (!DEV_NOW) return new Date();
  const [h, m] = DEV_NOW.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

// ==============================
// GLOBAL STATE
// ==============================
let CONFIG = null;
let TODAY_DATA = null;
let CURRENT_LANG = "en";

// ==============================
// TRANSLATION
// ==============================
function t(key, vars = {}) {
  const dict = CONFIG?.translations?.[CURRENT_LANG];
  if (!dict || !dict[key]) return "";
  let str = dict[key];
  for (const k in vars) {
    str = str.replace(`{${k}}`, vars[k]);
  }
  return str;
}

function setLanguage(lang) {
  CURRENT_LANG = lang;
  document.body.setAttribute("data-lang", lang);
  document.body.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");

  updateStaticText();
  startAnnouncements(true);
}

// ==============================
// CLOCK
// ==============================
function updateClock() {
  document.getElementById("clock").textContent =
    getNow().toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
}
setInterval(updateClock, 1000);
updateClock();

// ==============================
// LOAD DATA (DJANGO API)
// ==============================
Promise.all([
  fetch("/api/config/").then(r => r.json()),
  fetch("/api/today/").then(r => r.json())
]).then(([config, today]) => {
  CONFIG = config;
  TODAY_DATA = today;

  populateTimes();
  updateStaticText();
  startCountdown();
  startAnnouncements();
  startLanguageRotation();
  highlightJumuah();

  setInterval(highlightJumuah, 60000);
}).catch(err => {
  console.error("Failed to load data from Django API", err);
});

// ==============================
// TIME HELPERS
// ==============================
function getJamaahDate(prayer) {
  const cfg = CONFIG.jamaahTimes[prayer];
  const d = new Date();

  if (typeof cfg === "string") {
    const [h, m] = cfg.split(":").map(Number);
    d.setHours(h, m, 0, 0);
    return d;
  }

  if (cfg?.offsetMinutes != null) {
    const [h, m] = TODAY_DATA[prayer].split(":").map(Number);
    d.setHours(h, m + cfg.offsetMinutes, 0, 0);
    return d;
  }
}

// ==============================
// POPULATE PRAYER TABLE
// ==============================
function populateTimes() {
  document.getElementById("day").textContent =
    TODAY_DATA.Day?.toUpperCase() || "";
  document.getElementById("date").textContent =
    TODAY_DATA.Date?.replace(/-/g, " ") || "";
  document.getElementById("hijri").textContent =
    (TODAY_DATA.Hijri?.replace(/-/g, " ") || "") + " AH";

  Object.keys(CONFIG.jamaahTimes).forEach(p => {
    document.getElementById(`${p}-begins`).textContent = TODAY_DATA[p] || "--:--";
    document.getElementById(`${p}-jamaah`).textContent =
      getJamaahDate(p).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit"
      });
  });
}

// ==============================
// STATIC TEXT (MULTI-LANG)
// ==============================
function updateStaticText() {
  document.querySelector(".jumuah-title").textContent = t("jumuah");

  const labels = document.querySelectorAll(".jumuah-time span");
  if (labels[0]) labels[0].textContent = t("firstJumuah");
  if (labels[1]) labels[1].textContent = t("secondJumuah");

  document.getElementById("countdown-label").textContent =
    t("nextLabel", { PRAYER: "" });
}

// ==============================
// HIGHLIGHT NEXT SALAH ROW
// ==============================
function highlightNextPrayer(prayerName) {
  document.querySelectorAll(".row").forEach(row =>
    row.classList.remove("active")
  );

  if (!prayerName) return;

  const row = document.querySelector(`.row[data-prayer="${prayerName}"]`);
  if (row) row.classList.add("active");
}

// ==============================
// COUNTDOWN
// ==============================
function startCountdown() {
  const labelEl = document.getElementById("countdown-label");
  const valueEl = document.getElementById("countdown");

  function tick() {
    const now = getNow();
    const events = [];

    for (const p in CONFIG.jamaahTimes) {
      events.push({ name: p, time: getJamaahDate(p) });
    }

    events.sort((a, b) => a.time - b.time);
    let next = events.find(e => e.time > now);

    // If all today's jama'ah times have passed, use tomorrow's Fajr
    if (!next) {
      next = events[0];
      next.time = new Date(next.time.getTime() + 24 * 60 * 60 * 1000);
    }


    highlightNextPrayer(next.name);

    const diff = Math.max(0, next.time - now);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    labelEl.textContent = t("nextLabel", { PRAYER: next.name });
    valueEl.textContent =
      `${String(h).padStart(2, "0")}:` +
      `${String(m).padStart(2, "0")}:` +
      `${String(s).padStart(2, "0")}`;
  }

  tick();
  setInterval(tick, 1000);
}

// ==============================
// JUMUʿAH HIGHLIGHT
// ==============================
function highlightJumuah() {
  if (getNow().getDay() !== 5) return;

  const now = getNow();
  const rows = document.querySelectorAll(".jumuah-time");
  rows.forEach(r => r.classList.remove("active"));

  let next = null;
  rows.forEach(r => {
    const [h, m] = r.dataset.jumuah.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d > now && !next) next = r;
  });

  (next || rows[rows.length - 1])?.classList.add("active");
}

// ==============================
// ANNOUNCEMENTS (MULTI-LANG)
// ==============================
let announcementIndex = 0;
let announcementTimeout = null;

function startAnnouncements(reset = false) {
  const ticker = document.getElementById("ticker-message");
  if (!ticker) return;

  if (announcementTimeout) {
    clearTimeout(announcementTimeout);
    announcementTimeout = null;
  }

  if (reset) announcementIndex = 0;

  const list = CONFIG.announcements?.[CURRENT_LANG];
  if (!list?.length) {
    ticker.textContent = "";
    return;
  }

  function show() {
    const text = list[announcementIndex];
    ticker.textContent = text;

    const screenWidth = document.querySelector(".screen").offsetWidth;
    ticker.style.transition = "none";
    ticker.style.transform = `translateX(${screenWidth}px)`;
    ticker.offsetHeight;

    const textWidth = ticker.offsetWidth;
    const distance = screenWidth + textWidth;
    const speed = 120;
    const duration = distance / speed;

    ticker.style.transition = `transform ${duration}s linear`;
    ticker.style.transform = `translateX(-${textWidth}px)`;

    announcementTimeout = setTimeout(() => {
      announcementIndex = (announcementIndex + 1) % list.length;
      show();
    }, duration * 1000);
  }

  show();
}

// ==============================
// LANGUAGE ROTATION
// ==============================
function startLanguageRotation() {
  if (!CONFIG.languageRotation?.enabled) return;

  const langs = Object.keys(CONFIG.translations);
  let idx = langs.indexOf(CONFIG.languageRotation.default);

  setLanguage(langs[idx]);

  setInterval(() => {
    idx = (idx + 1) % langs.length;
    setLanguage(langs[idx]);
  }, CONFIG.languageRotation.intervalMinutes * 60 * 1000);
}

// ==============================
// PLASMA BURN-IN OVERLAY TIMER
// ==============================
const BURNIN_INTERVAL_MINUTES = 20;
const BURNIN_DURATION_SECONDS = 60;

setInterval(() => {
  const overlay = document.getElementById("burnin-overlay");
  overlay.classList.add("active");

  setTimeout(() => {
    overlay.classList.remove("active");
  }, BURNIN_DURATION_SECONDS * 1000);

}, BURNIN_INTERVAL_MINUTES * 60 * 1000);
