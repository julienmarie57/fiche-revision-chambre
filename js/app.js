"use strict";

/* ============ Stockage local ============ */
const STORE = "mtn_inspections_v2";
const STORE_PROFIL = "mtn_profil";
const STORE_QUARTER_SEEN = "mtn_last_quarter_seen";

function loadInspections() {
  try { return JSON.parse(localStorage.getItem(STORE)) || []; }
  catch { return []; }
}
function saveInspections(list) {
  localStorage.setItem(STORE, JSON.stringify(list));
}
function loadProfil() {
  try { return JSON.parse(localStorage.getItem(STORE_PROFIL)) || {}; }
  catch { return {}; }
}
function saveProfil(p) {
  localStorage.setItem(STORE_PROFIL, JSON.stringify(p));
}

/* ============ Utilitaires ============ */
function isoWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `S${String(week).padStart(2, "0")} - ${date.getUTCFullYear()}`;
}

function quarterKey(d) {
  return `${d.getFullYear()}-T${Math.floor(d.getMonth() / 3) + 1}`;
}

function quarterLabel(key) {
  const [year, q] = key.split("-T");
  const months = { "1": "janv. – mars", "2": "avr. – juin", "3": "juil. – sept.", "4": "oct. – déc." };
  return `T${q} ${year} (${months[q]})`;
}

function previousQuarterKey(key) {
  const [year, q] = key.split("-T").map(Number);
  return q === 1 ? `${year - 1}-T4` : `${year}-T${q - 1}`;
}

function allQuarterKeys(inspections) {
  const keys = new Set(inspections.map(i => i.quarter));
  let k = quarterKey(new Date());
  for (let n = 0; n < 8; n++) { keys.add(k); k = previousQuarterKey(k); }
  return [...keys].sort();
}

function formatDate(d) {
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function formatTime(d) {
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatShortDate(ts) {
  return new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function compressImage(file, maxSize = 1024, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture impossible"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image invalide"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.hidden = true; }, 2200);
}

function esc(s) {
  const div = document.createElement("div");
  div.textContent = s ?? "";
  return div.innerHTML;
}

function splitDetail(detail) {
  return detail.split(",").map(s => s.trim()).filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1));
}

/* ============ Navigation ============ */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  window.scrollTo(0, 0);
}

document.querySelectorAll(".btn-back").forEach(btn => {
  btn.addEventListener("click", () => showScreen(btn.dataset.target));
});

/* ============ État ============ */
let inspections = loadInspections();
let currentId = null;
let pendingRemarkKey = null;
let recapQuarter = null;
let remarksSort = "date";

function persist(insp) {
  saveInspections(inspections);
  if (Cloud.enabled) {
    const target = insp || getInspection(currentId);
    if (target) Cloud.push(target).catch(() => {});
  }
}

function getInspection(id) {
  return inspections.find(i => i.id === id) || null;
}

function inspectionForRoom(room, quarter) {
  return inspections.find(i => i.room === room && i.quarter === quarter) || null;
}

function itemProgress(insp) {
  let done = 0, total = 0;
  CHECKLIST.forEach((cat, ci) => cat.items.forEach((_, ii) => {
    const st = insp.items[`${ci}-${ii}`];
    total++;
    if (st && st.actions.length && st.actions.every(Boolean)) done++;
  }));
  return { done, total };
}

/* ============ Accueil ============ */
function renderHome() {
  inspections = loadInspections();
  const q = quarterKey(new Date());

  document.getElementById("home-quarter").textContent = quarterLabel(q);

  const enCours = inspections
    .filter(i => i.quarter === q && i.status === "en_cours")
    .sort((a, b) => ROOMS.indexOf(a.room) - ROOMS.indexOf(b.room));
  const realisees = inspections
    .filter(i => i.quarter === q && i.status === "terminee")
    .sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));
  const aRealiser = ROOMS.filter(room => !inspectionForRoom(room, q));

  const grid = document.getElementById("list-a-realiser");
  grid.innerHTML = "";
  if (!aRealiser.length) {
    grid.innerHTML = '<p class="empty-note">Toutes les chambres du trimestre sont inspectées ✓</p>';
  } else {
    aRealiser.forEach(room => {
      const btn = document.createElement("button");
      btn.className = "room-card";
      btn.textContent = room;
      btn.addEventListener("click", () => openNew(room));
      grid.appendChild(btn);
    });
  }

  renderEnCoursList(enCours);
  renderRealiseesList(realisees);
  renderQuarterBanner(q);
  renderSyncStatus();
}

function renderEnCoursList(list) {
  const el = document.getElementById("list-en-cours");
  el.innerHTML = "";
  if (!list.length) {
    el.innerHTML = '<p class="empty-note">Aucune inspection en cours.</p>';
    return;
  }
  list.forEach(i => {
    const { done, total } = itemProgress(i);
    const div = document.createElement("div");
    div.className = "fiche-item";
    div.innerHTML = `
      <div class="badge">${esc(i.room)}</div>
      <div class="fiche-info">
        <div class="fiche-room">Chambre ${esc(i.room)}</div>
        <div class="fiche-meta">${esc(i.person)} · ${done}/${total} · commencé le ${formatShortDate(i.startedAt)}</div>
      </div>
      <span class="chevron">›</span>`;
    div.addEventListener("click", () => openChecklist(i.id));
    el.appendChild(div);
  });
}

function renderRealiseesList(list) {
  const el = document.getElementById("list-realisees");
  el.innerHTML = "";
  if (!list.length) {
    el.innerHTML = '<p class="empty-note">Aucune inspection terminée ce trimestre.</p>';
    return;
  }
  list.forEach(i => {
    const div = document.createElement("div");
    div.className = "fiche-item";
    div.innerHTML = `
      <div class="badge done">✓</div>
      <div class="fiche-info">
        <div class="fiche-room">Chambre ${esc(i.room)}</div>
        <div class="fiche-meta">${esc(i.person)} · ${formatShortDate(i.finishedAt)}</div>
      </div>
      <span class="chevron">›</span>`;
    div.addEventListener("click", () => openDetail(i.id));
    el.appendChild(div);
  });
}

function renderQuarterBanner(q) {
  const banner = document.getElementById("quarter-banner");
  const seen = localStorage.getItem(STORE_QUARTER_SEEN);
  const prev = previousQuarterKey(q);
  const prevHasData = inspections.some(i => i.quarter === prev);
  if (seen !== q && prevHasData) {
    document.getElementById("banner-text").textContent =
      `Nouveau trimestre : ${quarterLabel(q)}. Les chambres repartent en « à réaliser ». Le récap de ${quarterLabel(prev)} est disponible.`;
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }
  localStorage.setItem(STORE_QUARTER_SEEN, q);
}

document.getElementById("btn-banner-recap").addEventListener("click", () => {
  openRecap(previousQuarterKey(quarterKey(new Date())));
});

function renderSyncStatus() {
  const el = document.getElementById("sync-status");
  if (!Cloud.enabled) {
    el.textContent = "Mode local (données sur cet appareil uniquement). Config Firebase à renseigner dans js/firebase.js pour la synchronisation.";
    return;
  }
  const err = Cloud.lastError();
  el.textContent = err
    ? "⚠️ Erreur de synchronisation : " + err
    : "☁️ Synchronisation Firebase active";
}

/* ============ Nouvelle inspection ============ */
const inputRoomPhoto = document.getElementById("input-room-photo");
const roomPreview = document.getElementById("room-photo-preview");
const roomPlaceholder = document.getElementById("room-photo-placeholder");
let newRoomPhoto = null;
let newRoom = null;

function openNew(room) {
  newRoom = room;
  newRoomPhoto = null;
  roomPreview.hidden = true;
  roomPreview.removeAttribute("src");
  roomPlaceholder.style.display = "";
  document.getElementById("new-title").textContent = `Chambre ${room}`;
  document.getElementById("insp-chambre").value = room;
  const now = new Date();
  document.getElementById("insp-semaine").value = isoWeek(now);
  document.getElementById("insp-date").value = `${formatDate(now)} ${formatTime(now)}`;
  const select = document.getElementById("insp-personne");
  select.innerHTML = TECHNICIANS.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
  select.value = loadProfil().personne || TECHNICIANS[0];
  document.getElementById("btn-start-checklist").disabled = false;
  showScreen("screen-new");
}

inputRoomPhoto.addEventListener("change", async () => {
  const file = inputRoomPhoto.files[0];
  if (!file) return;
  try {
    newRoomPhoto = await compressImage(file, 1024, 0.7);
    roomPreview.src = newRoomPhoto;
    roomPreview.hidden = false;
    roomPlaceholder.style.display = "none";
  } catch {
    showToast("Photo illisible");
  }
  inputRoomPhoto.value = "";
});

document.getElementById("btn-start-checklist").addEventListener("click", () => {
  const person = document.getElementById("insp-personne").value;
  saveProfil({ personne: person });
  const now = new Date();
  const insp = {
    id: `${newRoom}_${quarterKey(now)}`,
    room: newRoom,
    quarter: quarterKey(now),
    status: "en_cours",
    person,
    startedAt: now.getTime(),
    finishedAt: null,
    date: `${formatDate(now)} ${formatTime(now)}`,
    roomPhoto: newRoomPhoto,
    items: {},
    updatedAt: now.getTime()
  };
  const existing = inspections.findIndex(i => i.id === insp.id);
  if (existing >= 0) inspections[existing] = insp;
  else inspections.push(insp);
  persist(insp);
  currentId = insp.id;
  openChecklist(insp.id);
});

/* ============ Checklist ============ */
function itemKey(ci, ii) { return `${ci}-${ii}`; }

function getItemState(insp, ci, ii, detail) {
  const key = itemKey(ci, ii);
  if (!insp.items[key]) {
    insp.items[key] = { actions: new Array(detail.length).fill(false), remark: null };
  }
  return insp.items[key];
}

function openChecklist(id) {
  currentId = id;
  const insp = getInspection(id);
  if (!insp) { showScreen("screen-home"); return; }
  document.getElementById("cl-title").textContent = `Chambre ${insp.room}`;
  document.getElementById("cl-meta").textContent = `${insp.quarter} · ${insp.date} · ${insp.person}`;
  renderChecklist();
  showScreen("screen-checklist");
}

function renderChecklist() {
  const insp = getInspection(currentId);
  const container = document.getElementById("checklist-container");
  container.innerHTML = "";

  CHECKLIST.forEach((cat, ci) => {
    const catDiv = document.createElement("div");
    catDiv.className = "category";
    const catDone = cat.items.filter((_, ii) => {
      const st = insp.items[itemKey(ci, ii)];
      return st && st.actions.every(Boolean);
    }).length;
    catDiv.innerHTML = `
      <div class="category-title">
        <span>${esc(cat.category)}</span>
        <span class="category-count">${catDone}/${cat.items.length}</span>
      </div>`;

    cat.items.forEach((item, ii) => {
      const detail = splitDetail(item.detail);
      const st = getItemState(insp, ci, ii, detail);
      const allChecked = st.actions.every(Boolean);
      const someChecked = st.actions.some(Boolean);

      const equip = document.createElement("div");
      equip.className = "equip" + (allChecked ? " done" : someChecked ? " partial" : "");

      const head = document.createElement("button");
      head.className = "equip-head";
      head.type = "button";
      head.innerHTML = `
        <span class="equip-check">${allChecked ? "✓" : ""}</span>
        <span class="equip-name">${esc(item.name)}</span>
        <span class="equip-arrow">›</span>`;
      head.addEventListener("click", () => equip.classList.toggle("open"));
      equip.appendChild(head);

      const body = document.createElement("div");
      body.className = "equip-body";

      const label = document.createElement("div");
      label.className = "equip-detail-label";
      label.textContent = item.detail;
      body.appendChild(label);

      detail.forEach((action, ai) => {
        const row = document.createElement("label");
        row.className = "action-row" + (st.actions[ai] ? " checked" : "");
        row.innerHTML = `<input type="checkbox" ${st.actions[ai] ? "checked" : ""}><span>${esc(action)}</span>`;
        row.querySelector("input").addEventListener("change", (e) => {
          st.actions[ai] = e.target.checked;
          row.classList.toggle("checked", e.target.checked);
          updateEquipVisual(equip, insp, ci, ii, detail);
          updateProgress();
          touch();
          if (st.actions.every(Boolean)) openRemarkModal(itemKey(ci, ii), item.name);
        });
        body.appendChild(row);
      });

      const actions = document.createElement("div");
      actions.className = "equip-actions";
      const btnAll = document.createElement("button");
      btnAll.className = "btn-validate-all";
      btnAll.type = "button";
      btnAll.textContent = allChecked ? "Revoir les étapes" : "Tout valider";
      btnAll.addEventListener("click", () => {
        if (st.actions.every(Boolean)) { equip.classList.add("open"); return; }
        st.actions = st.actions.map(() => true);
        body.querySelectorAll("input[type=checkbox]").forEach(cb => {
          cb.checked = true;
          cb.closest(".action-row").classList.add("checked");
        });
        updateEquipVisual(equip, insp, ci, ii, detail);
        updateProgress();
        touch();
        openRemarkModal(itemKey(ci, ii), item.name);
      });
      actions.appendChild(btnAll);
      body.appendChild(actions);

      if (st.remark && (st.remark.text || st.remark.photo)) {
        const ind = document.createElement("div");
        ind.className = "remark-indicator";
        ind.textContent = "📝 Remarque enregistrée";
        body.appendChild(ind);
      }

      equip.appendChild(body);
      catDiv.appendChild(equip);
    });

    container.appendChild(catDiv);
  });

  updateProgress();
}

function updateEquipVisual(equip, insp, ci, ii, detail) {
  const st = getItemState(insp, ci, ii, detail);
  const allChecked = st.actions.every(Boolean);
  const someChecked = st.actions.some(Boolean);
  equip.classList.toggle("done", allChecked);
  equip.classList.toggle("partial", !allChecked && someChecked);
  equip.querySelector(".equip-check").textContent = allChecked ? "✓" : "";
  const catDiv = equip.closest(".category");
  const items = CHECKLIST[ci].items;
  const catDone = items.filter((_, j) => {
    const s = insp.items[itemKey(ci, j)];
    return s && s.actions.every(Boolean);
  }).length;
  catDiv.querySelector(".category-count").textContent = `${catDone}/${items.length}`;
}

function updateProgress() {
  const insp = getInspection(currentId);
  if (!insp) return;
  const { done, total } = itemProgress(insp);
  document.getElementById("progress-fill").style.width = total ? `${(done / total) * 100}%` : "0";
  document.getElementById("progress-label").textContent = `${done} / ${total}`;
  document.getElementById("btn-finish").disabled = done !== total;
}

function touch() {
  const insp = getInspection(currentId);
  if (insp) {
    insp.updatedAt = Date.now();
    persist(insp);
  }
}

/* ============ Pop-up remarque ============ */
const modal = document.getElementById("modal-remark");
const remarkText = document.getElementById("remark-text");
const remarkPhotoInput = document.getElementById("input-remark-photo");
const remarkPhotoWrap = document.getElementById("remark-photo-preview-wrap");
const remarkPhotoPreview = document.getElementById("remark-photo-preview");
let remarkPhotoData = null;

function openRemarkModal(key, itemName) {
  pendingRemarkKey = key;
  const insp = getInspection(currentId);
  const st = insp.items[key];
  remarkText.value = st.remark?.text || "";
  remarkPhotoData = st.remark?.photo || null;
  remarkPhotoPreview.src = remarkPhotoData || "";
  remarkPhotoWrap.hidden = !remarkPhotoData;
  document.getElementById("remark-subtitle").textContent = `Équipement : ${itemName}`;
  modal.hidden = false;
  remarkText.focus();
}

function closeRemarkModal() {
  modal.hidden = true;
  pendingRemarkKey = null;
  remarkPhotoData = null;
  remarkText.value = "";
  remarkPhotoWrap.hidden = true;
}

remarkPhotoInput.addEventListener("change", async () => {
  const file = remarkPhotoInput.files[0];
  if (!file) return;
  try {
    remarkPhotoData = await compressImage(file, 1024, 0.7);
    remarkPhotoPreview.src = remarkPhotoData;
    remarkPhotoWrap.hidden = false;
  } catch {
    showToast("Photo illisible");
  }
  remarkPhotoInput.value = "";
});

document.getElementById("btn-remove-remark-photo").addEventListener("click", () => {
  remarkPhotoData = null;
  remarkPhotoWrap.hidden = true;
});

document.getElementById("btn-remark-skip").addEventListener("click", () => {
  if (!pendingRemarkKey) return;
  getInspection(currentId).items[pendingRemarkKey].remark = null;
  touch();
  closeRemarkModal();
  renderChecklist();
});

document.getElementById("btn-remark-save").addEventListener("click", () => {
  if (!pendingRemarkKey) return;
  const text = remarkText.value.trim();
  if (!text && !remarkPhotoData) {
    showToast("Remarque vide : texte ou photo requis");
    return;
  }
  getInspection(currentId).items[pendingRemarkKey].remark = { text, photo: remarkPhotoData };
  touch();
  closeRemarkModal();
  renderChecklist();
  showToast("Remarque enregistrée");
});

/* ============ Rapport PDF ============ */
async function loadJsPDF() {
  if (window.jspdf) return window.jspdf.jsPDF;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js";
    s.onload = resolve;
    s.onerror = () => reject(new Error("CDN indisponible"));
    document.head.appendChild(s);
  });
  return window.jspdf.jsPDF;
}

function getImageSize(dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = () => reject(new Error("Image invalide"));
    img.src = dataURL;
  });
}

function reportFileName(insp) {
  const d = new Date(insp.finishedAt || insp.startedAt);
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const room = (insp.room || "XXX").toUpperCase().replace(/[^A-Z0-9]/g, "") || "XXX";
  const person = (insp.person || "").replace(/[^A-Za-z0-9]/g, "");
  return `${ymd}_RAP_INSPCH${room}_${person}.pdf`;
}

async function buildReportPdf(insp) {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  const M = 15;
  const W = 210 - 2 * M;
  const MAX_Y = 280;
  let y = 0;

  const ensureSpace = (h) => {
    if (y + h > MAX_Y) { doc.addPage(); y = M; }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("FICHE REVISION CHAMBRE", 105, 20, { align: "center" });
  doc.setDrawColor(15, 118, 110);
  doc.setLineWidth(0.8);
  doc.line(M, 25, 210 - M, 25);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const info = [
    `Trimestre : ${insp.quarter}`,
    `Date : ${insp.date}`,
    `Chambre : ${insp.room}`,
    `Personne : ${insp.person}`
  ];
  y = 34;
  info.forEach((line, i) => {
    doc.text(line, M + (i % 2) * (W / 2), y + Math.floor(i / 2) * 6);
  });
  y += 16;

  for (const [ci, cat] of CHECKLIST.entries()) {
    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 118, 110);
    doc.text(cat.category.toUpperCase(), M, y);
    doc.setTextColor(0, 0, 0);
    y += 3;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(M, y, 210 - M, y);
    y += 6;

    for (const [ii, item] of cat.items.entries()) {
      const st = insp.items[itemKey(ci, ii)];
      const detail = splitDetail(item.detail);
      const done = st && st.actions.every(Boolean);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`${done ? "[X]" : "[ ]"} ${item.name}`, M, y);
      y += 5;

      if (st) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(90, 90, 90);
        const steps = detail.map((a, i) => `${st.actions[i] ? "X" : "-"} ${a}`).join("   ");
        const lines = doc.splitTextToSize(steps, W - 4);
        ensureSpace(lines.length * 4.5);
        doc.text(lines, M + 4, y);
        y += lines.length * 4.5;
        doc.setTextColor(0, 0, 0);
      } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text("Non controle", M + 4, y);
        doc.setTextColor(0, 0, 0);
        y += 4.5;
      }

      if (st?.remark && (st.remark.text || st.remark.photo)) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(180, 83, 9);
        doc.text("Remarque :", M + 4, y);
        y += 4.5;
        doc.setFont("helvetica", "normal");
        if (st.remark.text) {
          doc.setTextColor(60, 60, 60);
          const rlines = doc.splitTextToSize(st.remark.text, W - 8);
          ensureSpace(rlines.length * 4.5);
          doc.text(rlines, M + 8, y);
          y += rlines.length * 4.5;
        }
        if (st.remark.photo) {
          try {
            const dim = await getImageSize(st.remark.photo);
            const pw = 60;
            const ph = Math.min(70, pw * dim.h / dim.w);
            const pwFinal = ph === 70 ? 70 * dim.w / dim.h : pw;
            ensureSpace(ph + 4);
            doc.addImage(st.remark.photo, "JPEG", M + 8, y, pwFinal, ph);
            y += ph + 4;
          } catch {
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text("(photo indisponible)", M + 8, y);
            y += 4;
            doc.setTextColor(0, 0, 0);
          }
        }
        doc.setTextColor(0, 0, 0);
      }
      y += 3;
    }
    y += 4;
  }

  return doc;
}

async function sendReportEmail(insp, fileName) {
  const subject = reportFileName(insp).replace(/\.pdf$/, "");
  const body = [
    "Bonjour,",
    "",
    `Veuillez trouver ci-joint le rapport d'inspection de la chambre ${insp.room}.`,
    `Fichier : ${fileName}`,
    "",
    "Cordialement,",
    insp.person
  ].join("\n");
  window.location.href =
    `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function generateReport(insp, withEmail) {
  showToast("Génération du rapport…");
  try {
    const doc = await buildReportPdf(insp);
    const fileName = reportFileName(insp);
    doc.save(fileName);
    if (withEmail) await sendReportEmail(insp, fileName);
    showToast("Rapport généré ✓");
  } catch {
    showToast("Erreur : rapport indisponible (hors-ligne ?)");
  }
}

/* ============ Clôture ============ */
const modalReport = document.getElementById("modal-report");

document.getElementById("btn-finish").addEventListener("click", () => {
  if (!getInspection(currentId)) return;
  modalReport.hidden = false;
});

document.getElementById("btn-report-no").addEventListener("click", () => {
  modalReport.hidden = true;
  closeInspection(null);
});

document.getElementById("btn-report-yes").addEventListener("click", () => {
  modalReport.hidden = true;
  const insp = getInspection(currentId);
  closeInspection(insp);
});

function closeInspection(inspForReport) {
  const insp = getInspection(currentId);
  if (!insp) return;
  insp.status = "terminee";
  insp.finishedAt = Date.now();
  insp.updatedAt = Date.now();
  persist(insp);
  currentId = null;
  renderHome();
  showScreen("screen-home");
  showToast(`Chambre ${insp.room} inspectée ✓`);
  if (inspForReport) generateReport(inspForReport, true);
}

/* ============ Détail inspection ============ */
function openDetail(id) {
  const insp = inspections.find(i => i.id === id);
  if (!insp) return;
  document.getElementById("detail-title").textContent = `Chambre ${insp.room}`;
  document.getElementById("detail-meta").textContent =
    `${insp.quarter} · ${insp.date} · ${insp.person}`;
  const container = document.getElementById("detail-container");
  container.innerHTML = "";

  if (insp.roomPhoto) {
    const img = document.createElement("img");
    img.src = insp.roomPhoto;
    img.alt = "Photo du numéro de chambre";
    img.style.cssText = "width:100%;border-radius:14px;margin-bottom:16px;";
    container.appendChild(img);
  }

  CHECKLIST.forEach((cat, ci) => {
    const catDiv = document.createElement("div");
    catDiv.className = "category";
    catDiv.innerHTML = `<div class="category-title"><span>${esc(cat.category)}</span></div>`;
    cat.items.forEach((item, ii) => {
      const st = insp.items[itemKey(ci, ii)];
      const done = st && st.actions.every(Boolean);
      const equip = document.createElement("div");
      equip.className = "equip" + (done ? " done" : "");
      const detailTxt = st
        ? st.actions.map((a, i) => `${a ? "✓" : "○"} ${esc(splitDetail(item.detail)[i])}`).join(" · ")
        : "Non contrôlé";
      equip.innerHTML = `
        <div class="equip-head" style="cursor:default">
          <span class="equip-check">${done ? "✓" : ""}</span>
          <span class="equip-name">${esc(item.name)}</span>
        </div>
        <div class="equip-body" style="display:block;padding-top:0">
          <div class="equip-detail-label">${detailTxt}</div>
          ${st?.remark ? `
            <div class="remark-block">
              <div class="remark-label">Remarque</div>
              ${esc(st.remark.text || "")}
              ${st.remark.photo ? `<img src="${st.remark.photo}" alt="Photo remarque">` : ""}
            </div>` : ""}
        </div>`;
      catDiv.appendChild(equip);
    });
    container.appendChild(catDiv);
  });

  document.getElementById("btn-detail-report").onclick = () => generateReport(insp, false);
  showScreen("screen-detail");
}

/* ============ Récap trimestriel ============ */
function openRecap(quarter) {
  recapQuarter = quarter || previousQuarterKey(quarterKey(new Date()));
  const select = document.getElementById("recap-quarter");
  select.innerHTML = allQuarterKeys(inspections)
    .map(k => `<option value="${k}">${quarterLabel(k)}</option>`).join("");
  select.value = recapQuarter;
  select.onchange = () => { recapQuarter = select.value; renderRecap(); };
  renderRecap();
  showScreen("screen-recap");
}

document.getElementById("btn-recap").addEventListener("click", () => {
  openRecap(previousQuarterKey(quarterKey(new Date())));
});

function renderRecap() {
  const q = recapQuarter;
  document.getElementById("recap-subtitle").textContent = quarterLabel(q);
  const inspectedRooms = inspections
    .filter(i => i.quarter === q && i.status === "terminee")
    .map(i => i.room);
  const nonInspectees = ROOMS.filter(r => !inspectedRooms.includes(r));

  const ni = document.getElementById("recap-non-inspectees");
  ni.innerHTML = nonInspectees.length
    ? nonInspectees.map(r => `<span class="room-chip warning">${esc(r)}</span>`).join("")
    : '<p class="empty-note">Toutes les chambres ont été inspectées ✓</p>';

  const rem = document.getElementById("recap-remarques");
  rem.innerHTML = "";
  const quarterInspections = inspections
    .filter(i => i.quarter === q && i.status === "terminee")
    .sort((a, b) => ROOMS.indexOf(a.room) - ROOMS.indexOf(b.room));
  let total = 0;
  quarterInspections.forEach(insp => {
    const remarks = collectRemarks(insp);
    if (!remarks.length) return;
    total += remarks.length;
    const block = document.createElement("div");
    block.className = "recap-room";
    block.innerHTML = `<div class="recap-room-title">Chambre ${esc(insp.room)} — ${esc(insp.person)}</div>`;
    remarks.forEach(r => {
      const div = document.createElement("div");
      div.className = "remark-block";
      div.innerHTML = `
        <div class="remark-label">${esc(r.category)} · ${esc(r.equipment)}</div>
        ${esc(r.text || "")}
        ${r.photo ? `<img src="${r.photo}" alt="Photo remarque">` : ""}`;
      block.appendChild(div);
    });
    rem.appendChild(block);
  });
  if (!total) {
    rem.innerHTML = '<p class="empty-note">Aucune remarque ce trimestre.</p>';
  }
}

async function generateRecapPdf() {
  const q = recapQuarter;
  showToast("Génération du récap…");
  try {
    const JsPDF = await loadJsPDF();
    const doc = new JsPDF({ unit: "mm", format: "a4" });
    const M = 15;
    const MAX_Y = 280;
    let y = 0;
    const ensureSpace = (h) => { if (y + h > MAX_Y) { doc.addPage(); y = M; } };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("RECAP TRIMESTRIEL - REVISION CHAMBRES", 105, 20, { align: "center" });
    doc.setFontSize(11);
    doc.text(quarterLabel(q), 105, 27, { align: "center" });
    doc.setDrawColor(15, 118, 110);
    doc.setLineWidth(0.8);
    doc.line(M, 31, 210 - M, 31);
    y = 40;

    const inspectedRooms = inspections
      .filter(i => i.quarter === q && i.status === "terminee").map(i => i.room);
    const nonInspectees = ROOMS.filter(r => !inspectedRooms.includes(r));

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Chambres non inspectées", M, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    if (nonInspectees.length) {
      doc.text(nonInspectees.join("   "), M, y);
      y += 8;
    } else {
      doc.text("Aucune - toutes les chambres ont été inspectées.", M, y);
      y += 8;
    }
    y += 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Remarques par chambre", M, y);
    y += 8;

    const quarterInspections = inspections
      .filter(i => i.quarter === q && i.status === "terminee")
      .sort((a, b) => ROOMS.indexOf(a.room) - ROOMS.indexOf(b.room));
    let any = false;

    for (const insp of quarterInspections) {
      const remarks = collectRemarks(insp);
      if (!remarks.length) continue;
      any = true;
      ensureSpace(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`Chambre ${insp.room} — ${insp.person}`, M, y);
      y += 6;

      for (const r of remarks) {
        ensureSpace(12);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(`${r.category} / ${r.equipment}`, M + 4, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        if (r.text) {
          const lines = doc.splitTextToSize(r.text, 210 - 2 * M - 8);
          ensureSpace(lines.length * 4.5);
          doc.text(lines, M + 8, y);
          y += lines.length * 4.5;
        }
        if (r.photo) {
          try {
            const dim = await getImageSize(r.photo);
            const ph = Math.min(60, 50 * dim.h / dim.w);
            const pw = Math.min(50, ph * dim.w / dim.h);
            ensureSpace(ph + 4);
            doc.addImage(r.photo, "JPEG", M + 8, y, pw, ph);
            y += ph + 4;
          } catch {}
        }
        y += 2;
      }
      y += 4;
    }
    if (!any) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Aucune remarque ce trimestre.", M, y);
    }

    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    doc.save(`${ymd}_REC_TRIM_${q.replace("-T", "T")}.pdf`);
    showToast("Récap généré ✓");
  } catch {
    showToast("Erreur : récap indisponible (hors-ligne ?)");
  }
}

document.getElementById("btn-recap-pdf").addEventListener("click", generateRecapPdf);

/* ============ Historique & analyses ============ */
function collectRemarks(insp) {
  const out = [];
  CHECKLIST.forEach((cat, ci) => cat.items.forEach((item, ii) => {
    const st = insp.items[itemKey(ci, ii)];
    if (st?.remark && (st.remark.text || st.remark.photo)) {
      out.push({
        room: insp.room,
        quarter: insp.quarter,
        person: insp.person,
        date: insp.finishedAt || insp.startedAt,
        category: cat.category,
        equipment: item.name,
        text: st.remark.text || "",
        photo: st.remark.photo || null
      });
    }
  }));
  return out;
}

function openHistory() {
  const quarters = allQuarterKeys(inspections);
  const selQ = document.getElementById("hist-quarter");
  selQ.innerHTML = `<option value="">Tous les trimestres</option>` +
    quarters.map(k => `<option value="${k}">${quarterLabel(k)}</option>`).join("");
  const selP = document.getElementById("hist-person");
  selP.innerHTML = `<option value="">Toutes les personnes</option>` +
    TECHNICIANS.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
  const selR = document.getElementById("hist-room");
  selR.innerHTML = `<option value="">Toutes les chambres</option>` +
    ROOMS.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join("");
  [selQ, selP, selR].forEach(sel => sel.onchange = renderHistory);
  document.querySelectorAll(".sort-btn").forEach(btn => {
    btn.onclick = () => { remarksSort = btn.dataset.sort; renderHistory(); };
  });
  renderHistory();
  showScreen("screen-history");
}

document.getElementById("btn-history").addEventListener("click", openHistory);

function filteredInspections() {
  const q = document.getElementById("hist-quarter").value;
  const p = document.getElementById("hist-person").value;
  const r = document.getElementById("hist-room").value;
  return inspections.filter(i =>
    i.status === "terminee" &&
    (!q || i.quarter === q) &&
    (!p || i.person === p) &&
    (!r || i.room === r)
  );
}

function renderHistory() {
  const list = filteredInspections();
  document.querySelectorAll(".sort-btn").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.sort === remarksSort));

  const remarks = list.flatMap(collectRemarks);
  const order = {
    date: (a, b) => b.date - a.date,
    room: (a, b) => a.room.localeCompare(b.room) || b.date - a.date,
    equip: (a, b) => a.equipment.localeCompare(b.equipment),
    person: (a, b) => a.person.localeCompare(b.person) || b.date - a.date
  };
  remarks.sort(order[remarksSort] || order.date);

  document.getElementById("remarks-count").textContent = `(${remarks.length})`;
  const table = document.getElementById("remarks-table");
  table.innerHTML = "";
  if (!remarks.length) {
    table.innerHTML = '<p class="empty-note">Aucune remarque pour ces filtres.</p>';
  } else {
    remarks.forEach(r => {
      const div = document.createElement("div");
      div.className = "remark-row";
      div.innerHTML = `
        <div class="remark-row-head">
          <span class="room-chip">${esc(r.room)}</span>
          <span class="remark-equip">${esc(r.equipment)}</span>
          <span class="remark-meta">${esc(r.person)} · ${formatShortDate(r.date)}</span>
        </div>
        ${r.text ? `<div class="remark-text">${esc(r.text)}</div>` : ""}
        ${r.photo ? `<img class="remark-thumb" src="${r.photo}" alt="Photo">` : ""}`;
      table.appendChild(div);
    });
  }

  const freq = {};
  remarks.forEach(r => { freq[r.equipment] = (freq[r.equipment] || 0) + 1; });
  const freqList = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const freqEl = document.getElementById("hist-frequency");
  freqEl.innerHTML = freqList.length
    ? freqList.map(([eq, n]) => {
        const max = freqList[0][1];
        return `<div class="freq-row">
          <span class="freq-name">${esc(eq)}</span>
          <div class="freq-bar"><div style="width:${(n / max) * 100}%"></div></div>
          <span class="freq-count">${n}</span>
        </div>`;
      }).join("")
    : '<p class="empty-note">Aucune donnée.</p>';

  const inspEl = document.getElementById("hist-inspections");
  inspEl.innerHTML = "";
  if (!list.length) {
    inspEl.innerHTML = '<p class="empty-note">Aucune inspection pour ces filtres.</p>';
  } else {
    list.sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0)).forEach(i => {
      const div = document.createElement("div");
      div.className = "fiche-item";
      div.innerHTML = `
        <div class="badge done">✓</div>
        <div class="fiche-info">
          <div class="fiche-room">Chambre ${esc(i.room)}</div>
          <div class="fiche-meta">${esc(i.quarter)} · ${esc(i.person)} · ${formatShortDate(i.finishedAt)}</div>
        </div>
        <span class="chevron">›</span>`;
      div.addEventListener("click", () => openDetail(i.id));
      inspEl.appendChild(div);
    });
  }
}

/* ============ Export / Import ============ */
document.getElementById("btn-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(inspections, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `inspections-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById("input-import").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error("format");
      let added = 0, skipped = 0;
      imported.forEach(f => {
        if (!f || !f.id) return;
        const existing = inspections.find(i => i.id === f.id);
        if (existing) {
          if ((f.updatedAt || 0) > (existing.updatedAt || 0)) {
            Object.assign(existing, f);
            added++;
          } else skipped++;
          return;
        }
        inspections.push(f);
        added++;
      });
      persist();
      renderHome();
      showToast(`${added} inspection(s) mise(s) à jour`);
    } catch {
      showToast("Fichier invalide");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

/* ============ Synchronisation Firebase ============ */
async function syncCloud() {
  if (!Cloud.enabled) return;
  try {
    const remote = await Cloud.pull();
    let changed = false;
    remote.forEach(rIns => {
      const local = inspections.find(i => i.id === rIns.id);
      if (!local) {
        inspections.push(rIns);
        changed = true;
      } else if ((rIns.updatedAt || 0) > (local.updatedAt || 0)) {
        const keepPhoto = local.roomPhoto;
        const photos = {};
        Object.entries(local.items || {}).forEach(([k, st]) => {
          if (st?.remark?.photo) photos[k] = st.remark.photo;
        });
        Object.assign(local, rIns);
        local.roomPhoto = keepPhoto || local.roomPhoto;
        Object.entries(photos).forEach(([k, photo]) => {
          if (local.items?.[k]?.remark) local.items[k].remark.photo = photo;
        });
        changed = true;
      }
    });
    for (const insp of inspections) {
      const remoteMatch = remote.find(r => r.id === insp.id);
      if (!remoteMatch || (insp.updatedAt || 0) > (remoteMatch.updatedAt || 0)) {
        await Cloud.push(insp);
      }
    }
    if (changed) { persist(); }
    renderHome();
  } catch {
    renderHome();
  }
}

/* ============ Démarrage ============ */
renderHome();
syncCloud();
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
