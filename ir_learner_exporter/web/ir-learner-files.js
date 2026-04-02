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

  function clearAllMessages() {
    // On nettoie les anciens messages pour éviter d'avoir des statuts contradictoires.
    setImportStatus("");
    setPasteStatus("");
    setFilesStatus("");
    setMatrixStatus("");
  }

  // ----- Etat UI (commandes) -----
  var commands = [];
  var remoteEntitiesById = {};

  function upsertCommand(name, code) {
    var i = commands.findIndex(function (c) {
      return c.name === name;
    });
    if (i >= 0) commands[i].code = code;
    else commands.push({ name: name, code: code });
  }

  async function learnIr() {
    var lr = $("learnResult");
    var learnBtn = $("learnBtn");
    var entityId = $("learnEntityId") ? $("learnEntityId").value.trim() : "";
    if (!entityId && $("learnEntitySelect")) {
      entityId = $("learnEntitySelect").value || "";
    }
    var label = ($("cmdName") && $("cmdName").value.trim()) || "learned_command";

    if (!entityId) {
      var select = $("learnEntitySelect");
      if (
        select &&
        (select.options.length === 0 ||
          /aucune entité remote\.\*/i.test(select.options[0] ? select.options[0].text : ""))
      ) {
        if (lr)
          lr.innerHTML =
            '<span class="warn">Aucune entité <code>remote.*</code> disponible actuellement dans Home Assistant.</span>';
        return;
      }
      if (lr)
        lr.innerHTML =
          '<span class="warn">Erreur: saisis l’entité <code>remote.*</code> (ex. <code>remote.salon</code>).</span>';
      return;
    }
    if (entityId.indexOf("remote.") !== 0) {
      if (lr)
        lr.innerHTML =
          '<span class="warn">Erreur: pour <code>remote.learn_command</code>, l’entité doit commencer par <code>remote.</code></span>';
      return;
    }
    var selectedInfo = remoteEntitiesById[entityId];
    if (selectedInfo && selectedInfo.available === false) {
      if (lr)
        lr.innerHTML =
          '<span class="warn">Erreur: cette entité est indisponible (<code>unavailable</code>).</span>';
      if (learnBtn) learnBtn.disabled = true;
      return;
    }

    try {
      if (lr) lr.innerHTML = "Chargement… pointe la télécommande vers le récepteur IR si demandé.";
      var learnBody = {
        label: label,
        entity_id: entityId,
      };
      var r = await fetch(`${API_BASE}/learn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(learnBody),
        cache: "no-store",
      });
      if (!r.ok) {
        var errText = await r.text();
        if (lr)
          lr.innerHTML =
            '<span class="warn">Erreur HTTP ' + escText(String(r.status)) + ": " + escText(errText) + "</span>";
        return;
      }
      var j = await r.json();
      if (!j || typeof j !== "object") {
        if (lr) lr.innerHTML = '<span class="warn">Réponse invalide (POST /api/learn).</span>';
        return;
      }
      var codeVal = j.code || j.example_code || "";
      var msgClass = j.ok ? "ok" : "warn";
      if (lr) {
        lr.innerHTML =
          '<span class="' + msgClass + '">' + esc(j.message || "") + "</span>";
        if (codeVal) lr.innerHTML += "<br>Code appliqué dans le champ ci-dessus.";
      }
      if ($("cmdCode") && codeVal) $("cmdCode").value = codeVal;
      if ($("cmdName") && !$("cmdName").value.trim() && j.suggested_name) {
        $("cmdName").value = j.suggested_name;
      }
    } catch (e) {
      console.error("learnIr error:", e);
      if (lr) lr.innerHTML = '<span class="warn">Erreur: ' + escText(e && e.message ? e.message : e) + "</span>";
    }
  }

  async function refreshRemoteEntities() {
    var select = $("learnEntitySelect");
    var lr = $("learnResult");
    if (!select) return;

    select.innerHTML = '<option value="">Chargement…</option>';
    try {
      var resp = await fetch(`${API_BASE}/remote_entities`, { cache: "no-store" });
      var j = await resp.json();
      if (!resp.ok || !j || !j.ok || !Array.isArray(j.entities)) {
        select.innerHTML = '<option value="">(erreur de chargement)</option>';
        if (lr) {
          lr.innerHTML =
            '<span class="warn">Erreur: impossible de récupérer les entités <code>remote.*</code> depuis Home Assistant.</span>';
        }
        return;
      }

      var learnableEntities = j.entities.filter(function (e) {
        return !!e.supports_learn;
      });

      if (learnableEntities.length === 0) {
        remoteEntitiesById = {};
        select.innerHTML = '<option value="">(aucune entité remote.* compatible learn_command)</option>';
        if (lr) {
          lr.innerHTML =
            '<span class="warn">Aucune entité <code>remote.*</code> compatible <code>learn_command</code>. Vérifie ton intégration IR dans Home Assistant.</span>';
        }
        return;
      }

      select.innerHTML = '<option value="">-- Choisir une entité remote.* --</option>';
      remoteEntitiesById = {};
      learnableEntities.forEach(function (e) {
        var opt = document.createElement("option");
        opt.value = e.entity_id;
        remoteEntitiesById[e.entity_id] = e;
        var suffix = "";
        if (!e.available) suffix += " (unavailable)";
        opt.textContent = `${e.name} (${e.entity_id})${suffix}`;
        select.appendChild(opt);
      });
      if (lr && !($("learnEntityId") && $("learnEntityId").value.trim())) {
        lr.innerHTML = "";
      }
    } catch (e) {
      console.error("refreshRemoteEntities error:", e);
      remoteEntitiesById = {};
      select.innerHTML = '<option value="">(erreur de chargement)</option>';
      if (lr) {
        lr.innerHTML =
          '<span class="warn">Erreur: Home Assistant indisponible, impossible de lister les entités <code>remote.*</code>.</span>';
      }
    }
  }

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
      var operationModes = linesFromEl("operationModes");
      var payload = {
        minTemperature: numberFromEl("minTemperature", 16),
        maxTemperature: numberFromEl("maxTemperature", 31),
        precision: numberFromEl("precision", 1) || 1,
        operationModes: operationModes,
        fanModes: linesFromEl("fanModes"),
        swingModes: includeSwing ? linesFromEl("swingModes") : [],
        includeOff: true,
      };

      if (payload.maxTemperature < payload.minTemperature) {
        setMatrixStatus(
          '<span class="warn">Erreur: la température max ne peut pas être inférieure à la température min.</span>'
        );
        return;
      }

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

  function applyImportedData(j, mode) {
    // mode: 'file' | 'paste' | 'generated'
    if (!j) {
      var err = '<span class="warn">Erreur: réponse du serveur vide.</span>';
      if (mode === "file") setImportStatus(err);
      if (mode === "paste") setPasteStatus(err);
      if (mode === "generated") setFilesStatus(err);
      setMatrixStatus(err);
      return;
    }

    if (j.ok === false) {
      var msg = "Erreur: " + (j.error ? j.error : "inconnu");
      var err = '<span class="warn">' + escText(msg) + '</span>';
      if (mode === "file") setImportStatus(err);
      if (mode === "paste") setPasteStatus(err);
      if (mode === "generated") setFilesStatus(err);
      setMatrixStatus(err);
      return;
    }

    if (!j.commands) {
      var msg = "Erreur: JSON importé invalide ou sans commandes.";
      var err = '<span class="warn">' + escText(msg) + '</span>';
      if (mode === "file") setImportStatus(err);
      if (mode === "paste") setPasteStatus(err);
      if (mode === "generated") setFilesStatus(err);
      setMatrixStatus(err);
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
    if (mode === "file") setImportStatus(msg);
    if (mode === "paste") setPasteStatus(msg);
    if (mode === "generated") setFilesStatus(msg);
    setMatrixStatus(msg);
    renderCommandsTable();
    visualizeMatrix(commands);
  }

  async function importFromFile() {
    var fileInput = $("importFile");
    if (!fileInput) return;

    clearAllMessages();

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
      applyImportedData(j, "file");
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

    clearAllMessages();

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
      applyImportedData(j, "paste");
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

    clearAllMessages();

    var filename = select.value;
    if (!filename) {
      if ($("matrixStatus")) $("matrixStatus").innerHTML = '<span class="warn">Veuillez sélectionner un fichier JSON généré.</span>';
      return;
    }

    // Harmonisation des messages
    if ($("matrixStatus")) $("matrixStatus").innerHTML = `<span class="small">Chargement...</span>`;
    setFilesStatus(`Chargement...`);

    try {
      var r = await fetch(
        `${API_BASE}/load?filename=${encodeURIComponent(filename)}`,
        { cache: "no-store" }
      );
      var j = await r.json();

      if (!j.ok) {
        if ($("matrixStatus"))
          $("matrixStatus").innerHTML = `<span class="warn">Erreur: ${esc(j.error || "inconnu")}</span>`;
        setFilesStatus(`<span class="warn">Erreur: ${esc(j.error || "inconnu")}</span>`);
        return;
      }

      if (!j.data) {
        if ($("matrixStatus"))
          $("matrixStatus").innerHTML =
            '<span class="warn">Erreur: Données manquantes dans la réponse du serveur.</span>';
        setFilesStatus('<span class="warn">Erreur: Données manquantes dans la réponse du serveur.</span>');
        return;
      }

      var r2 = await fetch(`${API_BASE}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: JSON.stringify(j.data) }),
        cache: "no-store",
      });
      var j2 = await r2.json();
      applyImportedData(j2, "generated");
    } catch (e) {
      console.error("loadGeneratedFile error:", e);
      if ($("matrixStatus")) $("matrixStatus").innerHTML = `<span class="warn">Erreur: ${escText(e && e.message ? e.message : e)}</span>`;
      setFilesStatus(`<span class="warn">Erreur: ${escText(e && e.message ? e.message : e)}</span>`);
    }
  }

  async function exportJson() {
    try {
      var includeSwing = $("includeSwing") ? $("includeSwing").checked : true;
      var payload = {
        filename: $("filename") ? $("filename").value.trim() : "learned_codes.json",
        manufacturer: $("manufacturer") ? $("manufacturer").value.trim() : "",
        supportedModels: linesFromEl("supportedModels"),
        minTemperature: numberFromEl("minTemperature", 16),
        maxTemperature: numberFromEl("maxTemperature", 31),
        precision: numberFromEl("precision", 1) || 1,
        operationModes: linesFromEl("operationModes"),
        fanModes: linesFromEl("fanModes"),
        swingModes: includeSwing ? linesFromEl("swingModes") : [],
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
      document.addEventListener("DOMContentLoaded", refreshRemoteEntities);
    } else {
      refreshGeneratedFiles();
      refreshRemoteEntities();
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

    var reloadEntitiesBtn = $("reloadEntitiesBtn");
    if (reloadEntitiesBtn) {
      reloadEntitiesBtn.onclick = function () {
        refreshRemoteEntities();
      };
    }

    var learnEntitySelect = $("learnEntitySelect");
    if (learnEntitySelect) {
      learnEntitySelect.onchange = function () {
        if (!learnEntitySelect.value) return;
        if ($("learnEntityId")) $("learnEntityId").value = learnEntitySelect.value;
        var e = remoteEntitiesById[learnEntitySelect.value];
        var lr = $("learnResult");
        var learnBtn = $("learnBtn");
        if (lr) lr.innerHTML = "";
        if (e && e.available === false) {
          if (learnBtn) learnBtn.disabled = true;
          if (lr) {
            lr.innerHTML =
              '<span class="warn">Entité indisponible: impossible d’apprendre tant que son état reste <code>unavailable</code>.</span>';
          }
        } else {
          if (learnBtn) learnBtn.disabled = false;
        }
      };
    }

    var learnEntityId = $("learnEntityId");
    if (learnEntityId) {
      learnEntityId.addEventListener("input", function () {
        var e = remoteEntitiesById[learnEntityId.value.trim()];
        var lr = $("learnResult");
        var learnBtn = $("learnBtn");
        if (lr) lr.innerHTML = "";
        if (e && e.available === false) {
          if (learnBtn) learnBtn.disabled = true;
          if (lr) {
            lr.innerHTML =
              '<span class="warn">Entité indisponible: impossible d’apprendre tant que son état reste <code>unavailable</code>.</span>';
          }
        } else if (learnBtn) {
          learnBtn.disabled = false;
        }
      });
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

    var learnBtn = $("learnBtn");
    if (learnBtn) {
      learnBtn.onclick = function () {
        learnIr();
      };
    }

    var addBtn = $("addBtn");
    if (addBtn) {
      addBtn.onclick = function () {
        var name = $("cmdName") ? $("cmdName").value.trim() : "";
        var code = $("cmdCode") ? $("cmdCode").value.trim() : "";
        var lr = $("learnResult");
        if (!name) {
          if (lr) lr.innerHTML = '<span class="warn">Nom requis.</span>';
          return;
        }
        upsertCommand(name, code);
        if (lr) lr.innerHTML = '<span class="ok">Commande enregistrée.</span>';
        renderCommandsTable();
        visualizeMatrix(commands);
      };
    }

    var findNextEmptyBtn = $("findNextEmptyBtn");
    if (findNextEmptyBtn) {
      findNextEmptyBtn.onclick = function () {
        var next = commands.find(function (c) {
          return !(c.code || "").trim();
        });
        var lr = $("learnResult");
        if (!next) {
          if (lr) lr.innerHTML = '<span class="ok">Toutes les commandes sont remplies.</span>';
          return;
        }
        if ($("cmdName")) $("cmdName").value = next.name;
        if ($("cmdCode")) $("cmdCode").value = next.code || "";
        if (lr)
          lr.innerHTML = '<span class="warn">Prochaine commande vide : ' + esc(next.name) + "</span>";
      };
    }

    var exampleBtn = $("exampleBtn");
    if (exampleBtn) {
      exampleBtn.onclick = function () {
        if ($("manufacturer")) $("manufacturer").value = "Mitsubishi Electric Starmex";
        if ($("supportedModels")) $("supportedModels").value = "MSXY-FN10VE\nMSXY-FN07VE";
        if ($("operationModes")) $("operationModes").value = "cool\ndry\nfanonly";
        if ($("fanModes")) $("fanModes").value = "Auto\nLow\nMid\nHigh";
        if ($("swingModes")) $("swingModes").value = "Auto\nTop\nMid\nBottom\nSwing";
        if ($("includeSwing")) $("includeSwing").checked = true;
        updateSwingSectionVisibility();
        generateMatrix();
      };
    }
  }

  boot();
})();

