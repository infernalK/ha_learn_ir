// Script externe pour peupler le combobox des fichiers.
// (Le script inline de la page peut être bloqué par une CSP dans Home Assistant.)
(function () {
  // ----- Helpers DOM / API -----
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

  function esc(v) {
    return String(v ?? "").replace(/[&<>"]/g, s => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    }[s]));
  }

  function escText(s) {
    return String(s ?? "");
  }

  function setImportStatus(html) {
    var el = $("importStatus");
    if (el) el.innerHTML = html;
  }

  function setPasteStatus(html) {
    var el = $("pasteStatus");
    if (el) el.innerHTML = html;
  }

  function setMatrixStatus(html) {
    var el = $("matrixStatus");
    if (el) el.innerHTML = html;
  }

  function setFilesStatus(html) {
    var el = $("filesStatus");
    if (el) el.innerHTML = html;
  }

  // ----- Etat UI (commandes) -----
  var commands = [];

  function linesFromEl(id) {
    var el = $(id);
    if (!el) return [];
    return el.value
      .split(/\n/)
      .map(v => v.trim())
      .filter(Boolean);
  }

  function numberFromEl(id, fallback) {
    var el = $(id);
    if (!el) return fallback;
    var n = Number(el.value);
    return Number.isFinite(n) ? n : fallback;
  }

  async function generateMatrix() {
    try {
      var includeSwing = $("includeSwing") ? $("includeSwing").checked : true;
      var payload = {
        minTemperature: numberFromEl("minTemperature", 16),
        maxTemperature: numberFromEl("maxTemperature", 31),
        precision: numberFromEl("precision", 1) || 1,
        operationModes: linesFromEl("operationModes"),
        fanModes: linesFromEl("fanModes"),
        swingModes: includeSwing ? linesFromEl("swingModes") : [],
        includeOff: true,
        includeIFeelAutoAuto: true,
      };

      setMatrixStatus("Génération...");

      var r = await fetch(`${API_BASE}/generate_matrix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      if (!r.ok) {
        var text = await r.text();
        setMatrixStatus(`<span class="warn">Erreur HTTP ${escText(r.status)}: ${escText(text)}</span>`);
        return;
      }

      var j = await r.json();
      if (!j || !j.ok || !Array.isArray(j.commands)) {
        setMatrixStatus('<span class="warn">Réponse invalide (POST /api/generate_matrix).</span>');
        return;
      }

      // Préserve les codes déjà saisis si le nom de commande existe.
      var previous = new Map(commands.map(c => [c.name, c.code]));
      commands.length = 0;
      j.commands.forEach(function (c) {
        commands.push({
          name: c.name,
          code: previous.get(c.name) || "",
        });
      });

      setMatrixStatus(`<span class="ok">${escText(j.count || commands.length)} combinaisons générées.</span>`);
      renderCommandsTable();
      visualizeMatrix(commands);
    } catch (e) {
      console.error("generateMatrix error:", e);
      setMatrixStatus(`<span class="warn">Erreur: ${escText(e && e.message ? e.message : e)}</span>`);
    }
  }

  function renderCommandsTable() {
    var body = $("commandsBody");
    if (!body) return;

    body.innerHTML = commands
      .map((c, i) => `
        <tr>
          <td>${esc(c.name)}</td>
          <td><code>${esc(c.code || "")}</code></td>
          <td>
            <button class="btn secondary" style="width:auto" onclick="editCmd(${i})">Éditer</button>
          </td>
        </tr>
      `)
      .join("");

    var filled = commands.filter(c => (c.code || "").trim()).length;
    if ($("status")) {
      $("status").innerHTML = `${commands.length} commande(s), ${filled} remplie(s), ${commands.length - filled} vide(s).`;
    }
  }

  function visualizeMatrix(list) {
    var viz = $("matrixVisualization");
    var grid = $("matGrid");
    if (!viz || !grid) return;

    if (!list || !list.length) {
      viz.style.display = "none";
      grid.innerHTML = "";
      return;
    }

    viz.style.display = "block";
    grid.innerHTML = list
      .slice(0, 300)
      .map(item => `
        <div class="mat-item">
          <strong>${esc(item.name)}</strong><br>
          ${item.code ? `<code>${esc(item.code)}</code>` : '<span class="warn">vide</span>'}
        </div>
      `)
      .join("");

    if (list.length > 300) {
      var more = document.createElement("div");
      more.style.gridColumn = "1 / -1";
      more.style.color = "#cbd5e1";
      more.style.fontSize = "12px";
      more.textContent = `${list.length - 300} autres commandes non affichées`;
      grid.appendChild(more);
    }
  }

  window.editCmd = function (i) {
    var cmdName = $("cmdName");
    var cmdCode = $("cmdCode");
    if (!cmdName || !cmdCode) return;
    cmdName.value = commands[i].name;
    cmdCode.value = commands[i].code || "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function updateSwingSectionVisibility() {
    var swingSection = $("swingSection");
    var includeSwing = $("includeSwing");
    if (!swingSection || !includeSwing) return;
    swingSection.style.display = includeSwing.checked ? "block" : "none";
  }

  function applyImportedData(j) {
    if (!j || !j.commands) {
      setImportStatus('<span class="warn">JSON importé invalide ou sans commandes.</span>');
      setMatrixStatus('<span class="warn">JSON importé invalide ou sans commandes.</span>');
      return;
    }

    if ($("manufacturer")) $("manufacturer").value = j.manufacturer || "";
    if ($("supportedModels")) $("supportedModels").value = (j.supportedModels || []).join("\n");
    if ($("minTemperature")) $("minTemperature").value = j.minTemperature || 16;
    if ($("maxTemperature")) $("maxTemperature").value = j.maxTemperature || 31;
    if ($("precision")) $("precision").value = j.precision || 1;
    if ($("operationModes")) $("operationModes").value = (j.operationModes || []).join("\n");
    if ($("fanModes")) $("fanModes").value = (j.fanModes || []).join("\n");
    if ($("swingModes")) $("swingModes").value = (j.swingModes || []).join("\n");

    if ($("includeSwing")) {
      $("includeSwing").checked = Array.isArray(j.swingModes) && j.swingModes.length > 0;
    }
    updateSwingSectionVisibility();

    commands.length = 0;
    (j.commands || []).forEach(c => commands.push(c));

    var msg = `<span class="ok">Import OK : ${commands.length} commandes.</span>`;
    setImportStatus(msg);
    setPasteStatus(msg);
    setMatrixStatus(msg);
    renderCommandsTable();
    visualizeMatrix(commands);
  }

  async function importFromFile() {
    var fileInput = $("importFile");
    if (!fileInput) return;

    var raw = "";
    if (fileInput.files && fileInput.files.length > 0) {
      raw = await fileInput.files[0].text();
    } else {
      var warn = '<span class="warn">Sélectionne un fichier JSON.</span>';
      setImportStatus(warn);
      setMatrixStatus(warn);
      return;
    }

    try {
      setImportStatus("Chargement...");
      setMatrixStatus("Chargement...");

      var r = await fetch(`${API_BASE}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: raw }),
        cache: "no-store",
      });

      var j = await r.json();
      applyImportedData(j);
    } catch (e) {
      console.error("importFromFile error:", e);
      var err = `<span class="warn">Erreur: ${escText(e && e.message ? e.message : e)}</span>`;
      setImportStatus(err);
      setMatrixStatus(err);
    }
  }

  async function importFromPaste() {
    var importJson = $("importJson");
    if (!importJson) return;

    var raw = (importJson.value || "").trim();
    if (!raw) {
      var warn = '<span class="warn">Colle un JSON avant de cliquer.</span>';
      setPasteStatus(warn);
      setMatrixStatus(warn);
      return;
    }

    try {
      setPasteStatus("Chargement...");
      setMatrixStatus("Chargement...");

      var r = await fetch(`${API_BASE}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: raw }),
        cache: "no-store",
      });

      var j = await r.json();
      applyImportedData(j);
    } catch (e) {
      console.error("importFromPaste error:", e);
      var err = `<span class="warn">Erreur: ${escText(e && e.message ? e.message : e)}</span>`;
      setPasteStatus(err);
      setMatrixStatus(err);
    }
  }

  async function loadGeneratedFile() {
    var select = $("generatedFileSelect");
    if (!select) return;

    var filename = select.value;
    if (!filename) {
      if ($("matrixStatus")) $("matrixStatus").innerHTML = '<span class="warn">Veuillez sélectionner un fichier JSON généré.</span>';
      return;
    }

    if ($("matrixStatus")) $("matrixStatus").innerHTML = `<span class="small">Chargement de ${esc(filename)}…</span>`;

    try {
      var r = await fetch(
        `${API_BASE}/load?filename=${encodeURIComponent(filename)}`,
        { cache: "no-store" }
      );
      var j = await r.json();

      if (!j.ok) {
        if ($("matrixStatus")) $("matrixStatus").innerHTML = `<span class="warn">Erreur chargement: ${esc(j.error || "inconnu")}</span>`;
        return;
      }

      if (!j.data) {
        if ($("matrixStatus")) $("matrixStatus").innerHTML = '<span class="warn">Données manquantes dans la réponse du serveur.</span>';
        return;
      }

      var r2 = await fetch(`${API_BASE}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: JSON.stringify(j.data) }),
        cache: "no-store",
      });
      var j2 = await r2.json();
      applyImportedData(j2);

      if ($("matrixStatus")) $("matrixStatus").innerHTML = `<span class="ok">Fichier ${esc(filename)} chargé.</span>`;
    } catch (e) {
      console.error("loadGeneratedFile error:", e);
      if ($("matrixStatus")) $("matrixStatus").innerHTML = `<span class="warn">Erreur: ${escText(e && e.message ? e.message : e)}</span>`;
    }
  }

  async function exportJson() {
    try {
      var payload = {
        filename: $("filename") ? $("filename").value.trim() : "learned_codes.json",
        manufacturer: $("manufacturer") ? $("manufacturer").value.trim() : "",
        supportedModels: linesFromEl("supportedModels"),
        minTemperature: numberFromEl("minTemperature", 16),
        maxTemperature: numberFromEl("maxTemperature", 31),
        precision: numberFromEl("precision", 1) || 1,
        operationModes: linesFromEl("operationModes"),
        fanModes: linesFromEl("fanModes"),
        swingModes: linesFromEl("swingModes"),
        commands: commands,
      };

      if ($("status")) $("status").innerHTML = "Export...";

      var r = await fetch(`${API_BASE}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      var j = await r.json().catch(() => null);
      if (!r.ok || !j) {
        var txt = j && j.error ? j.error : `HTTP ${r.status}`;
        if ($("status")) $("status").innerHTML = `<span class="warn">Erreur export: ${esc(txt)}</span>`;
        return;
      }
      if (!j.ok) {
        if ($("status")) $("status").innerHTML = `<span class="warn">Erreur export: ${esc(j.error || "inconnu")}</span>`;
        return;
      }

      if ($("status")) {
        $("status").innerHTML =
          `<span class="ok">JSON généré : ${esc(j.filename)} — ${escText(j.command_count)} commande(s) — chemin : ${esc(j.public_path)}</span>`;
      }
      // Refresh dropdown
      await refreshGeneratedFiles();
    } catch (e) {
      console.error("exportJson error:", e);
      if ($("status")) $("status").innerHTML = `<span class="warn">Erreur export: ${escText(e && e.message ? e.message : e)}</span>`;
    }
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

    var loadBtn = $("loadGeneratedBtn");
    if (loadBtn) {
      loadBtn.onclick = function () {
        loadGeneratedFile();
      };
    }

    var includeSwing = $("includeSwing");
    if (includeSwing) {
      includeSwing.addEventListener("change", updateSwingSectionVisibility);
    }

    var generateMatrixBtn = $("generateMatrixBtn");
    if (generateMatrixBtn) {
      generateMatrixBtn.onclick = function () {
        generateMatrix();
      };
    }

    var exportBtn = $("exportBtn");
    if (exportBtn) {
      exportBtn.onclick = function () {
        exportJson();
      };
    }

    var importBtn = $("importBtn");
    if (importBtn) {
      importBtn.onclick = function () {
        importFromFile();
      };
    }

    var importPasteBtn = $("importPasteBtn");
    if (importPasteBtn) {
      importPasteBtn.onclick = function () {
        importFromPaste();
      };
    }

    var clearBtn = $("clearBtn");
    if (clearBtn) {
      clearBtn.onclick = function () {
        commands.length = 0;
        renderCommandsTable();
        visualizeMatrix(commands);
        setImportStatus('<span class="ok">Commandes vidées.</span>');
        setPasteStatus('<span class="ok">Commandes vidées.</span>');
        setMatrixStatus('<span class="ok">Commandes vidées.</span>');
      };
    }
  }

  boot();
})();

