// Script externe pour peupler le combobox des fichiers.
// (Le script inline de la page peut être bloqué par une CSP dans Home Assistant.)
(function () {
  function computeApiBase() {
    // Ingress sert souvent: /hassio_ingress/<token>/ir-learner.html
    // => on veut:         /hassio_ingress/<token>/api
    var u = new URL(window.location.href);
    u.pathname = u.pathname.replace(/\/[^\/]*$/, "/");
    return u.pathname + "api";
  }

  var API_BASE = computeApiBase();

  function $(id) {
    return document.getElementById(id);
  }

  function escText(s) {
    return String(s ?? "");
  }

  function setFilesStatus(html) {
    var el = $("filesStatus");
    if (el) el.innerHTML = html;
  }

  async function refreshGeneratedFiles() {
    var select = $("generatedFileSelect");
    if (!select) return;

    setFilesStatus("Chargement...");
    select.innerHTML = '<option value="">Chargement…</option>';

    try {
      var resp = await fetch(API_BASE + "/files", { cache: "no-store" });
      var j = await resp.json();

      if (!j || !j.ok || !Array.isArray(j.files)) {
        select.innerHTML = '<option value="">(réponse invalide)</option>';
        setFilesStatus('<span class="warn">Réponse serveur invalide (GET /api/files).</span>');
        return;
      }

      var files = j.files.slice();
      select.innerHTML = '<option value="">-- Choisir un fichier --</option>';

      files.forEach(function (f) {
        var opt = document.createElement("option");
        opt.value = f;
        opt.textContent = f;
        select.appendChild(opt);
      });

      setFilesStatus("Fichiers trouvés: <code>" + escText(files.length) + "</code> (GET /api/files).");
    } catch (e) {
      console.error("refreshGeneratedFiles (external):", e);
      select.innerHTML = '<option value="">(erreur de chargement)</option>';
      setFilesStatus(
        '<span class="warn">Impossible de charger /api/files: ' +
          escText(e && e.message ? e.message : e) +
          "</span>"
      );
    }
  }

  function boot() {
    // Démarre immédiatement (DOM déjà prêt en général, mais on garde la robustesse)
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", refreshGeneratedFiles);
    } else {
      refreshGeneratedFiles();
    }

    var reloadBtn = $("reloadFilesBtn");
    if (reloadBtn) {
      reloadBtn.onclick = function () {
        refreshGeneratedFiles();
      };
    }
  }

  boot();
})();

