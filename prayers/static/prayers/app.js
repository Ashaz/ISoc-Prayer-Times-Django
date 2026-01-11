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
let TOMORROW_DATA = null;
const JAMAAH_GRACE_MINUTES = 10; // adjust if needed
document.body.classList.remove("dark-mode");

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
//  startDarkModeWatcher();
  maybeSwitchToTomorrow();
  setInterval(maybeSwitchToTomorrow, 60000);

  setInterval(highlightJumuah, 60000);
  hideLoadingScreen();
}).catch(err => {
  console.error("Failed to load data from Django API", err);
});

// ==============================
// TIME HELPERS
// ==============================
function getJamaahDate(prayer, data = TODAY_DATA) {
  const cfg = CONFIG.jamaahTimes[prayer];
  const d = new Date();

  if (typeof cfg === "string") {
    const [h, m] = cfg.split(":").map(Number);
    d.setHours(h, m, 0, 0);
    return d;
  }

  if (cfg?.offsetMinutes != null) {
    const [h, m] = data[prayer].split(":").map(Number);
    d.setHours(h, m + cfg.offsetMinutes, 0, 0);
    return d;
  }
}


// ==============================
// POPULATE PRAYER TABLE
// ==============================
function populateTimes(data = TODAY_DATA) {
  document.getElementById("day").textContent =
    TODAY_DATA.Day?.toUpperCase() || "";

  document.getElementById("date").textContent =
    TODAY_DATA.Date?.replace(/-/g, " ") || "";

  document.getElementById("hijri").textContent =
    (TODAY_DATA.Hijri?.replace(/-/g, " ") || "") + " AH";

  Object.keys(CONFIG.jamaahTimes).forEach(p => {
    document.getElementById(`${p}-begins`).textContent =
      data[p] || "--:--";

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

    // Build Athaan + Jama'ah events
    for (const p in CONFIG.jamaahTimes) {
      // Athaan
      if (TODAY_DATA[p]) {
        const [h, m] = TODAY_DATA[p].split(":").map(Number);
        const athaan = new Date();
        athaan.setHours(h, m, 0, 0);

        events.push({
          type: "athaan",
          prayer: p,
          time: athaan
        });
      }

      // Jama'ah
      events.push({
        type: "jamaah",
        prayer: p,
        time: getJamaahDate(p)
      });
    }

    // Sort by time
    events.sort((a, b) => a.time - b.time);

    // Find next event
    let next = events.find(e => e.time > now);

    // Find most recent jama'ah (for grace period)
    let lastJamaah = [...events]
      .filter(e => e.type === "jamaah" && e.time <= now)
      .pop();

    if (lastJamaah) {
      const minsAgo = Math.floor((now - lastJamaah.time) / 60000);

      if (minsAgo >= 0 && minsAgo <= JAMAAH_GRACE_MINUTES) {
        highlightNextPrayer(lastJamaah.prayer);

        labelEl.textContent =
          `${lastJamaah.prayer} Jamaʿah started ${minsAgo} minute${minsAgo !== 1 ? "s" : ""} ago`;

        valueEl.textContent = "";
        return;
      }
    }

    // If nothing left today → tomorrow Fajr Athaan
    if (!next) {
      const [h, m] = TODAY_DATA.Fajr.split(":").map(Number);
      const tmr = new Date();
      tmr.setDate(tmr.getDate() + 1);
      tmr.setHours(h, m, 0, 0);

      next = {
        type: "athaan",
        prayer: "Fajr",
        time: tmr
      };
    }

    highlightNextPrayer(next.prayer);

    const diff = Math.max(0, next.time - now);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    // Label text
    if (next.type === "athaan") {
      labelEl.textContent = `The Athaan for ${next.prayer} is in`;
    } else {
      labelEl.textContent = `The Jamaʿah for ${next.prayer} is in`;
    }

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

// ==============================
// AUTO DARK MODE (AFTER ISHA)
// ==============================
function checkDarkMode() {
  if (!CONFIG || !TODAY_DATA) return;

  const now = getNow();

  // Build today's Isha
  const isha = getJamaahDate("Isha", TODAY_DATA);

  // Build tomorrow's Fajr explicitly
  const fajrToday = getJamaahDate("Fajr", TODAY_DATA);
  const fajrTomorrow = new Date(fajrToday);
  fajrTomorrow.setDate(fajrTomorrow.getDate() + 1);

  let isNight = false;

  // After Isha (same day)
  if (now >= isha) {
    isNight = true;
  }

  // After midnight but before Fajr
  if (now.getHours() < 12 && now < fajrTomorrow) {
    isNight = true;
  }

  document.body.classList.toggle("dark-mode", isNight);
}



function startDarkModeWatcher() {
  checkDarkMode();
  setInterval(checkDarkMode, 60 * 1000); // every minute
}

// ==============================
// SWITCH TO TOMORROW AFTER ISHA
// ==============================
let showingTomorrow = false;

function maybeSwitchToTomorrow() {
  if (!CONFIG || !TODAY_DATA) return;

  const now = getNow();
  const isha = getJamaahDate("Isha");

  // Not past Isha yet → do nothing
  if (now < isha) return;

  // Already switched → do nothing
  if (showingTomorrow) return;

  fetch("/api/day/1/")
    .then(r => r.json())
    .then(data => {
      if (!data || !data.Date) return;

      TOMORROW_DATA = data;
      showingTomorrow = true;

      populateTimes(TOMORROW_DATA);
      showTomorrowLabel();

      updateStaticText();
    });
}

function showTomorrowLabel() {
  const el = document.getElementById("tomorrow-label");
  if (el) el.classList.remove("hidden");
}

function hideLoadingScreen() {
  const el = document.getElementById("loading-screen");
  if (!el) return;

  el.style.opacity = "0";
  el.style.transition = "opacity 0.4s ease";

  setTimeout(() => {
    el.remove();
  }, 5000);
}
