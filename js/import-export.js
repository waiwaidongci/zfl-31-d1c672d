const ImportExport = (function() {

  function exportJSON() {
    var active = SchemeStore.getActive();
    var threads = ThreadStore.getAll();
    var colorStats = ThreadModel.computeColorStats(active.cells, threads);
    var versions = VersionHistory.getExportData(active.id);

    var estimateConfig = active.estimateConfig || (typeof YarnEstimate !== 'undefined' ? YarnEstimate.getDefaults() : null);
    var yarnEstimate = null;
    if (typeof YarnEstimate !== 'undefined') {
      yarnEstimate = YarnEstimate.computePerThreadEstimate({
        cells: active.cells,
        cols: active.cols,
        rows: active.rows,
        threads: threads,
        scheme: active
      });
    }

    var data = {
      name: active.name,
      cols: active.cols,
      rows: active.rows,
      cells: active.cells,
      threads: threads.map(function(t) {
        return {
          id: t.id,
          name: t.name,
          color: t.color,
          note: t.note,
          order: t.order,
          lossConfig: t.lossConfig || { lossFactor: 1.15, safetyMargin: 10 }
        };
      }),
      usage: colorStats.map(function(s) {
        return {
          id: s.id,
          name: s.name,
          color: s.color,
          note: s.note,
          count: s.count
        };
      }),
      estimateConfig: estimateConfig,
      yarnEstimate: yarnEstimate,
      versions: versions
    };

    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (active.name || "brocade-pattern") + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportSVG() {
    if (typeof ExportPreview !== "undefined") {
      ExportPreview.open();
    }
  }

  function importJSON() {
    if (typeof ImportDialog !== "undefined") {
      ImportDialog.open({
        onImport: function(result) {
          document.querySelector("#cols").value = AppState.cols;
          document.querySelector("#rows").value = AppState.rows;
          SchemeUI.refreshAll();
        }
      });
    }
  }

  function parseImportedVersions(raw) {
    if (!raw || !Array.isArray(raw.versions)) return [];
    return raw.versions.filter(function(v) {
      return v && v.id && v.timestamp && Array.isArray(v.cells);
    });
  }

  return {
    exportJSON: exportJSON,
    exportSVG: exportSVG,
    importJSON: importJSON,
    parseImportedVersions: parseImportedVersions
  };
})();
