"use strict";

/* ============ Stockage ============ */
const STORE_FICHES = "mtn_fiches";
const STORE_PROFIL = "mtn_profil";

function loadFiches() {
  try { return JSON.parse(localStorage.getItem(STORE_FICHES)) || []; }
  catch { return []; }
}
function saveFiches(list) {
  localStorage.setItem(STORE_FICHES, JSON.stringify(list));
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

function formatDate(d) {
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function formatTime(d) {
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function guessDeviceName() {
  const ua = navigator.userAgent;
  const android = ua.match(/Android[^;]*;\s*([^;)]+?)\s*(?:Build|\))/i);
  if (android && android[1] && !/^\d/.test(android[1])) return android[1].trim();
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  return "Appareil inconnu";
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

/* ============ Navigation ============ */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  window.scrollTo(0, 0);
}

document.querySelectorAll(".btn-back").forEach(btn => {
  btn.addEventListener("click", () => showScreen(btn.dataset.target));
});

/* ============ État courant ============ */
let fiches = loadFiches();
let currentFicheId = null;
let pendingRemarkKey = null;

function getCurrentFiche() {
  return fiches.find(f => f.id === currentFicheId) || null;
}
function persist() {
  saveFiches(fiches);
}

/* ============ Accueil ============ */
function renderHome() {
  fiches = loadFiches();
  const enCours = fiches.filter(f => f.status === "en_cours").sort((a, b) => b.createdAt - a.createdAt);
  const terminees = fiches.filter(f => f.status === "terminee").sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));

  renderFicheList("list-en-cours", enCours, "Aucune fiche en cours.");
  renderFicheList("list-terminees", terminees, "Aucune fiche terminée.");
}

function itemProgress(fiche) {
  let done = 0, total = 0;
  CHECKLIST.forEach((cat, ci) => cat.items.forEach((item, ii) => {
    const st = fiche.items[`${ci}-${ii}`];
    total++;
    if (st && st.actions.length && st.actions.every(Boolean)) done++;
  }));
  return { done, total };
}

function renderFicheList(listId, list, emptyMsg) {
  const el = document.getElementById(listId);
  el.innerHTML = "";
  if (!list.length) {
    el.innerHTML = `<p class="empty-note">${emptyMsg}</p>`;
    return;
  }
  list.forEach(f => {
    const { done, total } = itemProgress(f);
    const div = document.createElement("div");
    div.className = "fiche-item";
    div.innerHTML = `
      <div class="badge ${f.status === "terminee" ? "done" : ""}">${f.status === "terminee" ? "✓" : esc(f.chambre)}</div>
      <div class="fiche-info">
        <div class="fiche-room">${esc(f.chambre || "Chambre ?")}</div>
        <div class="fiche-meta">${esc(f.semaine)} · ${esc(f.date)} · ${esc(f.personne)} · ${done}/${total}</div>
      </div>
      <span class="chevron">›</span>`;
    div.addEventListener("click", () => {
      if (f.status === "terminee") openDetail(f.id);
      else openChecklist(f.id);
    });
    el.appendChild(div);
  });
}

/* ============ Nouvelle fiche ============ */
const inputRoomPhoto = document.getElementById("input-room-photo");
const roomPreview = document.getElementById("room-photo-preview");
const roomPlaceholder = document.getElementById("room-photo-placeholder");
const ocrStatus = document.getElementById("ocr-status");
let roomPhotoData = null;

document.getElementById("btn-new-fiche").addEventListener("click", () => {
  roomPhotoData = null;
  roomPreview.hidden = true;
  roomPreview.removeAttribute("src");
  roomPlaceholder.style.display = "";
  ocrStatus.hidden = true;
  document.getElementById("fiche-chambre").value = "";
  const now = new Date();
  document.getElementById("fiche-semaine").value = isoWeek(now);
  document.getElementById("fiche-date").value = `${formatDate(now)} ${formatTime(now)}`;
  const profil = loadProfil();
  document.getElementById("fiche-personne").value = profil.personne || guessDeviceName();
  checkStartReady();
  showScreen("screen-new");
});

inputRoomPhoto.addEventListener("change", async () => {
  const file = inputRoomPhoto.files[0];
  if (!file) return;
  ocrStatus.hidden = true;
  try {
    roomPhotoData = await compressImage(file, 1024, 0.7);
  } catch {
    showToast("Photo illisible");
    return;
  }
  roomPreview.src = roomPhotoData;
  roomPreview.hidden = false;
  roomPlaceholder.style.display = "none";
  await runOcr();
  inputRoomPhoto.value = "";
});

async function loadTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    s.onload = resolve;
    s.onerror = () => reject(new Error("CDN indisponible"));
    document.head.appendChild(s);
  });
  return window.Tesseract;
}

function setOcrStatus(msg, isError = false, spinner = false) {
  ocrStatus.hidden = false;
  ocrStatus.classList.toggle("error", isError);
  ocrStatus.textContent = (spinner ? "⏳ " : isError ? "⚠️ " : "✅ ") + msg;
}

async function runOcr() {
  setOcrStatus("Lecture du numéro de chambre…", false, true);
  try {
    const Tesseract = await loadTesseract();
    const worker = await Tesseract.createWorker("eng");
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcedfghijklmnopqrstuvwxyz-",
      tessedit_pageseg_mode: "7"
    });
    const { data } = await worker.recognize(roomPhotoData);
    await worker.terminate();
    const candidates = (data.text || "").toUpperCase().match(/(?:[A-Z-]*\d[A-Z0-9-]*)/g) || [];
    candidates.sort((a, b) => b.length - a.length);
    if (candidates.length) {
      const num = candidates[0].replace(/[^A-Z0-9-]/g, "");
      document.getElementById("fiche-chambre").value = num;
      setOcrStatus(`Numéro détecté : ${num}. Vérifiez et corrigez si besoin.`);
    } else {
      setOcrStatus("Numéro non détecté. Saisissez-le manuellement ci-dessous.", true);
    }
  } catch {
    setOcrStatus("Détection indisponible (hors-ligne ?). Saisissez le numéro manuellement.", true);
  }
  checkStartReady();
}

document.getElementById("fiche-chambre").addEventListener("input", checkStartReady);
document.getElementById("fiche-personne").addEventListener("input", checkStartReady);

function checkStartReady() {
  const chambre = document.getElementById("fiche-chambre").value.trim();
  const personne = document.getElementById("fiche-personne").value.trim();
  document.getElementById("btn-start-checklist").disabled = !(chambre && personne);
}

document.getElementById("btn-start-checklist").addEventListener("click", () => {
  const chambre = document.getElementById("fiche-chambre").value.trim();
  const personne = document.getElementById("fiche-personne").value.trim();
  saveProfil({ personne });

  const now = new Date();
  const fiche = {
    id: uid(),
    createdAt: now.getTime(),
    semaine: isoWeek(now),
    date: `${formatDate(now)} ${formatTime(now)}`,
    chambre,
    personne,
    roomPhoto: roomPhotoData,
    status: "en_cours",
    finishedAt: null,
    items: {}
  };
  fiches.push(fiche);
  persist();
  currentFicheId = fiche.id;
  openChecklist(fiche.id);
});

/* ============ Checklist ============ */
function itemKey(ci, ii) { return `${ci}-${ii}`; }

function getItemState(fiche, ci, ii, detail) {
  const key = itemKey(ci, ii);
  if (!fiche.items[key]) {
    fiche.items[key] = { actions: new Array(detail.length).fill(false), remark: null };
  }
  return fiche.items[key];
}

function openChecklist(ficheId) {
  currentFicheId = ficheId;
  const fiche = getCurrentFiche();
  if (!fiche) { showScreen("screen-home"); return; }
  document.getElementById("cl-title").textContent = `Chambre ${fiche.chambre}`;
  document.getElementById("cl-meta").textContent = `${fiche.semaine} · ${fiche.date} · ${fiche.personne}`;
  renderChecklist();
  showScreen("screen-checklist");
}

function renderChecklist() {
  const fiche = getCurrentFiche();
  const container = document.getElementById("checklist-container");
  container.innerHTML = "";

  CHECKLIST.forEach((cat, ci) => {
    const catDiv = document.createElement("div");
    catDiv.className = "category";
    const catDone = cat.items.filter((_, ii) => {
      const st = fiche.items[itemKey(ci, ii)];
      return st && st.actions.every(Boolean);
    }).length;
    catDiv.innerHTML = `
      <div class="category-title">
        <span>${esc(cat.category)}</span>
        <span class="category-count">${catDone}/${cat.items.length}</span>
      </div>`;

    cat.items.forEach((item, ii) => {
      const detail = splitDetail(item.detail);
      const st = getItemState(fiche, ci, ii, detail);
      const allChecked = st.actions.every(Boolean);
      const someChecked = st.actions.some(Boolean);

      const equip = document.createElement("div");
      equip.className = "equip" + (allChecked ? " done" : someChecked ? " partial" : "");
      equip.dataset.key = itemKey(ci, ii);

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
          updateEquipVisual(equip, fiche, ci, ii, detail);
          updateProgress();
          persist();
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
        const wasDone = st.actions.every(Boolean);
        if (wasDone) {
          equip.classList.add("open");
          return;
        }
        st.actions = st.actions.map(() => true);
        body.querySelectorAll("input[type=checkbox]").forEach(cb => {
          cb.checked = true;
          cb.closest(".action-row").classList.add("checked");
        });
        updateEquipVisual(equip, fiche, ci, ii, detail);
        updateProgress();
        persist();
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

function splitDetail(detail) {
  return detail.split(",").map(s => s.trim()).filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1));
}

function updateEquipVisual(equip, fiche, ci, ii, detail) {
  const st = getItemState(fiche, ci, ii, detail);
  const allChecked = st.actions.every(Boolean);
  const someChecked = st.actions.some(Boolean);
  equip.classList.toggle("done", allChecked);
  equip.classList.toggle("partial", !allChecked && someChecked);
  equip.querySelector(".equip-check").textContent = allChecked ? "✓" : "";
  const catDiv = equip.closest(".category");
  const items = CHECKLIST[ci].items;
  const catDone = items.filter((_, j) => {
    const s = fiche.items[itemKey(ci, j)];
    return s && s.actions.every(Boolean);
  }).length;
  catDiv.querySelector(".category-count").textContent = `${catDone}/${items.length}`;
}

function updateProgress() {
  const fiche = getCurrentFiche();
  if (!fiche) return;
  const { done, total } = itemProgress(fiche);
  document.getElementById("progress-fill").style.width = total ? `${(done / total) * 100}%` : "0";
  document.getElementById("progress-label").textContent = `${done} / ${total}`;
  document.getElementById("btn-finish").disabled = done !== total;
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
  const fiche = getCurrentFiche();
  const st = fiche.items[key];
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
  const fiche = getCurrentFiche();
  fiche.items[pendingRemarkKey].remark = null;
  persist();
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
  const fiche = getCurrentFiche();
  fiche.items[pendingRemarkKey].remark = { text, photo: remarkPhotoData };
  persist();
  closeRemarkModal();
  renderChecklist();
  showToast("Remarque enregistrée");
});

/* ============ Chargement jsPDF ============ */
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

function reportFileName(fiche) {
  const d = new Date(fiche.createdAt);
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const room = (fiche.chambre || "XXX").toUpperCase().replace(/[^A-Z0-9]/g, "") || "XXX";
  const person = (fiche.personne || "").replace(/[^A-Za-z0-9]/g, "");
  return `${ymd}_RAP_INSPCH${room}_${person}.pdf`;
}

async function buildReportPdf(fiche) {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  const M = 15;
  const W = 210 - 2 * M;
  const MAX_Y = 280;
  let y = 0;

  const ensureSpace = (h) => {
    if (y + h > MAX_Y) {
      doc.addPage();
      y = M;
    }
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
    `Semaine : ${fiche.semaine}`,
    `Date : ${fiche.date}`,
    `Chambre : ${fiche.chambre}`,
    `Personne : ${fiche.personne}`
  ];
  y = 34;
  info.forEach((line, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    doc.text(line, M + col * (W / 2), y + row * 6);
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
      const st = fiche.items[itemKey(ci, ii)];
      const detail = splitDetail(item.detail);
      const done = st && st.actions.every(Boolean);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const mark = done ? "[X]" : "[ ]";
      doc.text(`${mark} ${item.name}`, M, y);
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

async function sendReportEmail(fiche, fileName) {
  const subject = reportFileName(fiche).replace(/\.pdf$/, "");
  const body = [
    "Bonjour,",
    "",
    `Veuillez trouver ci-joint le rapport d'inspection de la chambre ${fiche.chambre}.`,
    `Fichier : ${fileName}`,
    "",
    "Cordialement,",
    fiche.personne
  ].join("\n");
  window.location.href =
    `mailto:technique@csfds.be?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function generateReport(fiche, withEmail) {
  showToast("Génération du rapport…");
  try {
    const doc = await buildReportPdf(fiche);
    const fileName = reportFileName(fiche);
    doc.save(fileName);
    if (withEmail) await sendReportEmail(fiche, fileName);
    showToast("Rapport généré ✓");
  } catch {
    showToast("Erreur : rapport indisponible (hors-ligne ?)");
  }
}

/* ============ Terminer la fiche ============ */
const modalReport = document.getElementById("modal-report");

document.getElementById("btn-finish").addEventListener("click", () => {
  const fiche = getCurrentFiche();
  if (!fiche) return;
  modalReport.hidden = false;
});

document.getElementById("btn-report-no").addEventListener("click", () => {
  modalReport.hidden = true;
  closeFiche(null);
});

document.getElementById("btn-report-yes").addEventListener("click", async () => {
  modalReport.hidden = true;
  const fiche = getCurrentFiche();
  closeFiche(fiche);
});

function closeFiche(ficheForReport) {
  const fiche = getCurrentFiche();
  if (!fiche) return;
  fiche.status = "terminee";
  fiche.finishedAt = Date.now();
  persist();
  currentFicheId = null;
  renderHome();
  showScreen("screen-home");
  showToast("Fiche terminée ✓");
  if (ficheForReport) generateReport(ficheForReport, true);
}

/* ============ Détail fiche terminée ============ */
function openDetail(ficheId) {
  const fiche = fiches.find(f => f.id === ficheId);
  if (!fiche) return;
  document.getElementById("detail-title").textContent = `Chambre ${fiche.chambre}`;
  document.getElementById("detail-meta").textContent =
    `${fiche.semaine} · ${fiche.date} · ${fiche.personne}`;
  const container = document.getElementById("detail-container");
  container.innerHTML = "";

  if (fiche.roomPhoto) {
    const img = document.createElement("img");
    img.src = fiche.roomPhoto;
    img.alt = "Photo du numéro de chambre";
    img.style.cssText = "width:100%;border-radius:14px;margin-bottom:16px;";
    container.appendChild(img);
  }

  CHECKLIST.forEach((cat, ci) => {
    const catDiv = document.createElement("div");
    catDiv.className = "category";
    catDiv.innerHTML = `<div class="category-title"><span>${esc(cat.category)}</span></div>`;
    cat.items.forEach((item, ii) => {
      const st = fiche.items[itemKey(ci, ii)];
      const done = st && st.actions.every(Boolean);
      const equip = document.createElement("div");
      equip.className = "equip" + (done ? " done" : "");
      const detailTxt = st
        ? st.actions.map((a, i) => a ? `✓ ${esc(splitDetail(item.detail)[i])}` : `○ ${esc(splitDetail(item.detail)[i])}`).join(" · ")
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

  document.getElementById("btn-detail-report").onclick = () => generateReport(fiche, false);
  showScreen("screen-detail");
}

/* ============ Export ============ */
document.getElementById("btn-export").addEventListener("click", () => {
  const data = JSON.stringify(fiches, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `fiches-revision-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

/* ============ Démarrage ============ */
renderHome();
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
