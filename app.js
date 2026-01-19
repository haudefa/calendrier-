const gridEl = document.getElementById("grid");

function parseYMD(ymd) {
  // ymd: "YYYY-MM-DD"
  const [y, m, d] = ymd.split("-").map(Number);
  // Use UTC to avoid DST issues while iterating
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)); // noon UTC
}

function ymdInTZ(date, timeZone) {
  // Returns YYYY-MM-DD in the requested timeZone
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date); // en-CA gives YYYY-MM-DD
}

function addDaysUTC(date, days) {
  const ms = date.getTime() + days * 86400000;
  return new Date(ms);
}

function countDaysInclusive(startUTC, endUTC) {
  const start = Date.UTC(startUTC.getUTCFullYear(), startUTC.getUTCMonth(), startUTC.getUTCDate());
  const end = Date.UTC(endUTC.getUTCFullYear(), endUTC.getUTCMonth(), endUTC.getUTCDate());
  const diff = Math.floor((end - start) / 86400000);
  return diff + 1;
}

function pickGridSize(n, width, height) {
  // Choose columns/rows to maximize dot diameter (no scroll).
  // We assume gap is proportional to diameter.
  const r = 0.65; // gap ratio: gap = d * r
  let best = { cols: 1, rows: n, d: 1, gap: 1 };

  // Search sensible column counts
  const maxCols = Math.min(n, 80);
  for (let cols = 6; cols <= maxCols; cols++) {
    const rows = Math.ceil(n / cols);

    // Diameter bounds given proportional gap
    const dW = width / (cols + (cols - 1) * r);
    const dH = height / (rows + (rows - 1) * r);
    const d = Math.floor(Math.min(dW, dH));

    if (d > best.d) {
      best = { cols, rows, d, gap: Math.floor(d * r) };
    }
  }

  // Safety clamp (avoid microscopic)
  best.d = Math.max(best.d, 3);
  best.gap = Math.max(best.gap, 2);

  return best;
}

async function loadConfig() {
  const res = await fetch("./config.json", { cache: "no-store" });
  if (!res.ok) throw new Error("config.json introuvable");
  return res.json();
}

function buildDays(startUTC, endUTC, timeZone) {
  const n = countDaysInclusive(startUTC, endUTC);
  const todayKey = ymdInTZ(new Date(), timeZone);

  const days = [];
  for (let i = 0; i < n; i++) {
    const d = addDaysUTC(startUTC, i);
    const key = ymdInTZ(d, timeZone);
    const isPast = key < todayKey; // today + future are empty circles
    days.push({ isPast });
  }
  return days;
}

function render(days) {
  // Measure available area inside safe padding
  const stage = document.getElementById("stage");
  const rect = stage.getBoundingClientRect();

  // A little inner margin to keep it “wallpaper clean”
  const width = rect.width - 8;
  const height = rect.height - 8;

  const { cols, d, gap } = pickGridSize(days.length, width, height);

  gridEl.style.setProperty("--d", `${d}px`);
  gridEl.style.setProperty("--b", `${Math.max(1, Math.floor(d * 0.12))}px`);
  gridEl.style.gridTemplateColumns = `repeat(${cols}, var(--d))`;
  gridEl.style.gap = `${gap}px`;

  const frag = document.createDocumentFragment();
  for (const day of days) {
    const el = document.createElement("div");
    el.className = `dot ${day.isPast ? "past" : "future"}`;
    frag.appendChild(el);
  }

  gridEl.innerHTML = "";
  gridEl.appendChild(frag);
}

async function main() {
  const cfg = await loadConfig();
  const startUTC = parseYMD(cfg.startDate);
  const endUTC = parseYMD(cfg.endDate);
  const tz = cfg.timeZone || "Europe/Paris";

  const days = buildDays(startUTC, endUTC, tz);
  render(days);

  // Re-layout on orientation change / resize (still no scroll)
  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => render(days), 100);
  });
}

main().catch(() => {
  // Fail silent: keep black screen if config missing
  document.body.style.background = "#000";
});
