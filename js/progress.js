(function () {
  function safeParse(v, fallback) {
    try {
      return JSON.parse(v);
    } catch {
      return fallback;
    }
  }

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function round1(v) {
    return Math.round(v * 10) / 10;
  }

  function fmtKg(v) {
    if (!Number.isFinite(v)) return "-";
    return `${round1(v)} kg`;
  }

  function fmtPct(v) {
    if (!Number.isFinite(v)) return "-";
    return `${Math.round(v)}%`;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function toISODate(d) {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  }

  function daysAgoISO(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return toISODate(d);
  }

  function getCurrentUser() {
    if (window.CU) return window.CU;

    const uid = localStorage.getItem("uid");
    const users = safeParse(localStorage.getItem("users"), {});
    if (uid && users && users[uid]) return users[uid];

    return null;
  }

  function getUserId() {
    const cu = getCurrentUser();
    return cu?.id || cu?.uid || localStorage.getItem("uid") || "guest";
  }

  function getLogKey(uid) {
    return `log_${uid}`;
  }

  function getWorkoutsKey(uid) {
    return `workouts_${uid}`;
  }

  function getLogData(uid) {
    if (typeof window.getLog === "function") {
      try {
        const x = window.getLog(uid);
        if (x && typeof x === "object") return x;
      } catch {}
    }

    const raw = localStorage.getItem(getLogKey(uid));
    const parsed = safeParse(raw, {});
    return parsed && typeof parsed === "object" ? parsed : {};
  }

  function getWorkoutData(uid) {
    const raw = localStorage.getItem(getWorkoutsKey(uid));
    const parsed = safeParse(raw, []);
    if (Array.isArray(parsed)) return parsed;

    if (window.db && Array.isArray(window.db.workouts)) {
      return window.db.workouts.filter((w) => (w.uid || w.userId) === uid);
    }

    return [];
  }

  function getEntriesFromLog(logObj) {
    const out = [];

    Object.entries(logObj || {}).forEach(([date, day]) => {
      const d = day || {};
      const foods = Array.isArray(d.foods) ? d.foods : [];
      const kcal =
        num(d.kcal) ||
        foods.reduce((s, f) => s + num(f.kcal || f.cal || f.calories), 0);

      const protein =
        num(d.protein) ||
        foods.reduce((s, f) => s + num(f.protein || f.prot || f.p), 0);

      const carbs =
        num(d.carbs) ||
        foods.reduce((s, f) => s + num(f.carbs || f.carb || f.c), 0);

      const fats =
        num(d.fats) ||
        foods.reduce((s, f) => s + num(f.fats || f.fat || f.g), 0);

      const weight = d.weight != null ? num(d.weight) : null;

      out.push({
        date,
        kcal,
        protein,
        carbs,
        fats,
        weight,
      });
    });

    out.sort((a, b) => a.date.localeCompare(b.date));
    return out;
  }

  function getTargetCalories(cu) {
    return (
      num(cu?.kcalTarget) ||
      num(cu?.targetKcal) ||
      num(cu?.goalKcal) ||
      num(cu?.fab) ||
      num(cu?.fabbisogno) ||
      num(cu?.calorieTarget) ||
      0
    );
  }

  function calcAvgWeight(entries, days) {
    const from = daysAgoISO(days - 1);
    const arr = entries
      .filter((e) => e.date >= from && e.weight && e.weight > 0)
      .map((e) => e.weight);

    if (!arr.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  function calcWeightDelta(entries, days) {
    const from = daysAgoISO(days - 1);
    const arr = entries
      .filter((e) => e.date >= from && e.weight && e.weight > 0)
      .map((e) => ({ date: e.date, weight: e.weight }));

    if (arr.length < 2) return null;
    return arr[arr.length - 1].weight - arr[0].weight;
  }

  function calcAdherence(entries, target, days) {
    if (!target || target <= 0) return null;
    const from = daysAgoISO(days - 1);
    const arr = entries.filter((e) => e.date >= from);

    if (!arr.length) return null;

    const scores = arr.map((e) => {
      const diff = Math.abs(num(e.kcal) - target);
      const pct = Math.max(0, 100 - (diff / target) * 100);
      return pct;
    });

    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  function calcWeeklyMacros(entries) {
    const from = daysAgoISO(6);
    const arr = entries.filter((e) => e.date >= from);
    if (!arr.length) return { p: 0, c: 0, g: 0 };

    const totals = arr.reduce(
      (acc, e) => {
        acc.p += num(e.protein);
        acc.c += num(e.carbs);
        acc.g += num(e.fats);
        return acc;
      },
      { p: 0, c: 0, g: 0 }
    );

    return {
      p: totals.p / arr.length,
      c: totals.c / arr.length,
      g: totals.g / arr.length,
    };
  }

  function calcWeeklyWorkouts(workouts) {
    const from = daysAgoISO(6);
    return workouts.filter((w) => {
      const d = toISODate(w.date || w.createdAt || w.ts || w.when);
      return d && d >= from;
    }).length;
  }

  function getWeightSeries(entries, days) {
    const from = daysAgoISO(days - 1);
    return entries
      .filter((e) => e.date >= from && e.weight && e.weight > 0)
      .map((e) => ({
        label: e.date.slice(5),
        value: e.weight,
      }));
  }

  function getCaloriesSeries(entries, days) {
    const from = daysAgoISO(days - 1);
    const filtered = entries.filter((e) => e.date >= from);

    // riempi anche i giorni mancanti
    const map = {};
    filtered.forEach((e) => {
      map[e.date] = num(e.kcal);
    });

    const series = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = daysAgoISO(i);
      series.push({
        label: d.slice(5),
        value: num(map[d]),
      });
    }
    return series;
  }

  function drawLineChart(canvasId, series, opts = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext("2d");
    const w = canvas.width = canvas.clientWidth || 320;
    const h = canvas.height = opts.height || 160;

    ctx.clearRect(0, 0, w, h);

    if (!series || !series.length) {
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("Nessun dato disponibile", 12, 24);
      return;
    }

    const values = series.map((s) => num(s.value));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = 24;
    const left = 34;
    const right = 10;
    const top = 12;
    const bottom = 22;

    const plotW = w - left - right;
    const plotH = h - top - bottom;
    const range = max - min || 1;

    // assi leggeri
    ctx.strokeStyle = "#233044";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, h - bottom);
    ctx.lineTo(w - right, h - bottom);
    ctx.stroke();

    // linea
    ctx.strokeStyle = opts.stroke || "#3ecf8e";
    ctx.lineWidth = 2;
    ctx.beginPath();

    series.forEach((p, i) => {
      const x = left + (plotW * i) / Math.max(series.length - 1, 1);
      const y = top + plotH - ((num(p.value) - min) / range) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();

    // punti
    ctx.fillStyle = opts.stroke || "#3ecf8e";
    series.forEach((p, i) => {
      const x = left + (plotW * i) / Math.max(series.length - 1, 1);
      const y = top + plotH - ((num(p.value) - min) / range) * plotH;
      ctx.beginPath();
      ctx.arc(x, y, 2.8, 0, Math.PI * 2);
      ctx.fill();
    });

    // label min/max
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px sans-serif";
    ctx.fillText(String(round1(max)), 4, top + 8);
    ctx.fillText(String(round1(min)), 4, h - bottom);

    // alcune date
    ctx.fillText(series[0].label, left, h - 6);
    ctx.fillText(series[series.length - 1].label, w - right - 34, h - 6);
  }

  function buildInsights(entries, workouts, cu) {
    const insights = [];
    const target = getTargetCalories(cu);
    const avg7 = calcAvgWeight(entries, 7);
    const delta30 = calcWeightDelta(entries, 30);
    const adh7 = calcAdherence(entries, target, 7);
    const wk7 = calcWeeklyWorkouts(workouts);

    if (Number.isFinite(adh7)) {
      if (adh7 >= 85) insights.push("Ottima aderenza calorica negli ultimi 7 giorni.");
      else if (adh7 >= 65) insights.push("Aderenza discreta: sei vicino al target, ma puoi essere più costante.");
      else insights.push("Aderenza bassa: probabilmente stai andando fuori target troppo spesso.");
    }

    if (Number.isFinite(delta30)) {
      if (delta30 < -0.8) insights.push("Il peso è in calo negli ultimi 30 giorni.");
      else if (delta30 > 0.8) insights.push("Il peso è in aumento negli ultimi 30 giorni.");
      else insights.push("Il peso è abbastanza stabile negli ultimi 30 giorni.");
    }

    if (wk7 === 0) insights.push("Nessun workout registrato questa settimana.");
    else if (wk7 < 3) insights.push("Hai registrato pochi workout questa settimana.");
    else insights.push("Buona costanza negli allenamenti questa settimana.");

    if (!Number.isFinite(avg7)) {
      insights.push("Inserisci più pesi nel diario per avere trend affidabili.");
    }

    return insights;
  }

  function renderInsights(list) {
    const box = document.getElementById("progress-insights");
    if (!box) return;

    if (!list.length) {
      box.innerHTML = '<div class="muted">Nessun insight disponibile.</div>';
      return;
    }

    box.innerHTML = list
      .map((x) => `<div class="insight-item">• ${x}</div>`)
      .join("");
  }

  function renderProgress() {
    const cu = getCurrentUser();
    const uid = getUserId();
    const logObj = getLogData(uid);
    const workouts = getWorkoutData(uid);
    const entries = getEntriesFromLog(logObj);
    const target = getTargetCalories(cu);

    const avg7 = calcAvgWeight(entries, 7);
    const delta30 = calcWeightDelta(entries, 30);
    const adh7 = calcAdherence(entries, target, 7);
    const wk7 = calcWeeklyWorkouts(workouts);
    const macros = calcWeeklyMacros(entries);

    setText("pr-avg7", fmtKg(avg7));
    setText("pr-d30", Number.isFinite(delta30) ? `${delta30 > 0 ? "+" : ""}${round1(delta30)} kg` : "-");
    setText("pr-adh7", fmtPct(adh7));
    setText("pr-wk7", String(wk7));

    setText("pr-mp", `${Math.round(macros.p)}g`);
    setText("pr-mc", `${Math.round(macros.c)}g`);
    setText("pr-mg", `${Math.round(macros.g)}g`);

    renderInsights(buildInsights(entries, workouts, cu));

    drawLineChart("progress-weight-chart", getWeightSeries(entries, 30), {
      stroke: "#3ecf8e",
      height: 160,
    });

    drawLineChart("progress-cal-chart", getCaloriesSeries(entries, 14), {
      stroke: "#ff6b35",
      height: 160,
    });
  }

  // espone funzione globale
  window.renderProgress = renderProgress;
  window.renderProgressPage = renderProgress;

  // si aggancia a mostraPg se esiste
  if (typeof window.mostraPg === "function") {
    const originalMostraPg = window.mostraPg;
    window.mostraPg = function (page) {
      const res = originalMostraPg.apply(this, arguments);
      if (page === "progressi") {
        setTimeout(renderProgress, 0);
      }
      return res;
    };
  }

  // fallback: se clicchi un bottone con data-page="progressi"
  document.addEventListener("click", function (e) {
    const btn = e.target.closest('[data-page="progressi"]');
    if (btn) {
      setTimeout(renderProgress, 50);
    }
  });

  // se la pagina è già aperta
  document.addEventListener("DOMContentLoaded", function () {
    const page = document.getElementById("pg-progressi");
    if (page && !page.classList.contains("hidden")) {
      setTimeout(renderProgress, 0);
    }
  });
})();
