const FIREBASE_CONFIG = {
  apiKey: "A_REMPLACER",
  authDomain: "A_REMPLACER",
  databaseURL: "A_REMPLACER",
  projectId: "A_REMPLACER",
  storageBucket: "A_REMPLACER",
  messagingSenderId: "A_REMPLACER",
  appId: "A_REMPLACER"
};

const FIREBASE_ENABLED = !Object.values(FIREBASE_CONFIG).includes("A_REMPLACER");

const Cloud = (() => {
  let db = null;

  async function init() {
    if (!FIREBASE_ENABLED || db) return FIREBASE_ENABLED;
    await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
    await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js");
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
    return true;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Chargement impossible : " + src));
      document.head.appendChild(s);
    });
  }

  function stripPhotos(inspection) {
    const copy = JSON.parse(JSON.stringify(inspection));
    delete copy.roomPhoto;
    if (copy.items) {
      Object.values(copy.items).forEach(st => {
        if (st.remark) delete st.remark.photo;
      });
    }
    return copy;
  }

  async function pull() {
    if (!await init()) return [];
    const snap = await db.ref("inspections").get();
    return snap.val() ? Object.values(snap.val()) : [];
  }

  async function push(inspection) {
    if (!await init()) return false;
    await db.ref("inspections/" + inspection.id).set(stripPhotos(inspection));
    return true;
  }

  return { init, pull, push, enabled: FIREBASE_ENABLED };
})();
