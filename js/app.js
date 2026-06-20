var colors = ["#f7e7c4","#a6322d","#1f5f78","#d6a437","#355b38","#713d7b","#1e1b18","#e98c52"];
window.colors = colors;

const App = (function() {

  var _gridEl = null;
  var _statsEl = null;
  var _previewEl = null;
  var _riskEl = null;
  var _schemeListEl = null;
  var _schemeFilterEl = null;
  var _colsInput = null;
  var _rowsInput = null;
  var _currentWorkspace = "edit";

  function init() {
    _cacheDom();
    _initData();
    _initRenderers();
    _initInteractions();
    _initPanels();
    _bindGlobalEvents();
    _bindToolbarEvents();
    _bindSchemeEvents();
    _bindBatchEvents();
    _bindWorkspaceEvents();
    _renderInitial();
  }

  function _cacheDom() {
    _gridEl = document.querySelector("#grid");
    _statsEl = document.querySelector("#stats");
    _previewEl = document.querySelector("#preview");
    _riskEl = document.querySelector("#risk");
    _schemeListEl = document.querySelector("#schemeList");
    _schemeFilterEl = document.querySelector("#schemeFilter");
    _colsInput = document.querySelector("#cols");
    _rowsInput = document.querySelector("#rows");
  }

  function _initData() {
    ThreadStore.load();
    StorageMigration.migrateAll();
    SchemeStore.load();
    _colsInput.value = AppState.cols;
    _rowsInput.value = AppState.rows;
  }

  function _initRenderers() {
    GridRender.init({
      gridEl: _gridEl,
      statsEl: _statsEl,
      previewEl: _previewEl,
      riskEl: _riskEl
    });
    SchemeUI.init({ listEl: _schemeListEl, filterEl: _schemeFilterEl });
  }

  function _initInteractions() {
    GridInteraction.init({ gridEl: _gridEl });
    GridInteraction.setGridSize(AppState.cols, AppState.rows);
    GridInteraction.bindDocumentEvents();

    _gridEl.addEventListener("pointerdown", function(e) {
      if (SelectionState.getMode() === "select") {
        GridInteraction.handlePointerDown(e);
      }
    });

    _gridEl.addEventListener("click", function(e) {
      if (SelectionState.getMode() === "select") {
        GridInteraction.handleGridClick(e);
      }
    });

    SelectionState.subscribe(function() {
      GridRender.render();
    });
  }

  function _initPanels() {
    var threadPanelEl = document.querySelector("#threadPanel");
    if (threadPanelEl && ThreadPanel && typeof ThreadPanel.init === "function") {
      ThreadPanel.init({
        container: threadPanelEl,
        onChange: function() {
          GridRender.render();
          SchemeUI.renderSchemeList();
          if (typeof ProcessView !== "undefined" && ProcessView.isProcessView()) {
            ProcessView.refresh();
          }
        }
      });
    }

    var templatePanel = document.querySelector("#templatePanel");
    if (templatePanel && TemplateUI && typeof TemplateUI.init === "function") {
      TemplateUI.init(templatePanel);
    }

    if (typeof ProcessView !== "undefined") {
      ProcessView.init({ gridEl: _gridEl });
    }

    ExportConfig.load();
    if (typeof ExportPreview !== "undefined") {
      ExportPreview.init({
        getCurrentData: function() {
          var active = SchemeStore.getActive();
          var threads = ThreadStore.getAll();
          return {
            cells: active.cells,
            cols: active.cols,
            rows: active.rows,
            threads: threads,
            schemeName: active.name
          };
        }
      });
    }

    if (typeof BlockUI !== "undefined") {
      var blocksContainer = document.querySelector(".blocks-container");
      if (blocksContainer) {
        BlockUI.init({
          container: blocksContainer,
          onBlockSelect: function(blockId) {
            AppState.block = blockId;
            GridRender.render();
            SchemeUI.renderSchemeList();
          }
        });
      }
    }

    var versionTimelineEl = document.querySelector("#versionTimeline");
    if (versionTimelineEl && typeof VersionTimelineUI !== "undefined") {
      VersionTimelineUI.init({ container: versionTimelineEl });
      VersionTimelineUI.refresh();
    }

    if (typeof ImportDialog !== "undefined") {
      ImportDialog.init({});
    }

    if (typeof CompareSelector !== "undefined") {
      CompareSelector.init({
        container: document.querySelector("#compareSelector"),
        onStartCompare: function(schemeA, schemeB) {
          document.querySelector("#compareSelector").style.display = "none";
          document.querySelector("#compareView").style.display = "";

          if (typeof CompareView !== "undefined") {
            CompareView.init({
              container: document.querySelector("#compareView"),
              onBack: function() {
                document.querySelector("#compareView").style.display = "none";
                document.querySelector("#compareView").innerHTML = "";
                document.querySelector("#compareSelector").style.display = "";
                CompareSelector.refresh();
              }
            });
            CompareView.showCompare(schemeA, schemeB);
          }
        }
      });
    }
  }

  function _bindGlobalEvents() {
    EventBus.on("grid:changed", function() {
      SchemeUI.renderSchemeList();
    });

    EventBus.on("scheme:switchRequested", function(schemeId) {
      SchemeUI.switchScheme(schemeId);
    });
  }

  function _bindToolbarEvents() {
    document.querySelector("#newBtn").onclick = _handleNewGrid;
    document.querySelector("#undoBtn").onclick = _handleUndo;
    document.querySelector("#redoBtn").onclick = _handleRedo;
    document.querySelector("#saveBtn").onclick = _handleSave;
    document.querySelector("#exportBtn").onclick = _handleExportJSON;
    document.querySelector("#exportSvgBtn").onclick = _handleExportSVG;
    document.querySelector("#importBtn").onclick = _handleImport;
    document.querySelector("#newSchemeBtn").onclick = _handleNewScheme;
    document.querySelector("#selectModeBtn").onclick = _handleToggleMode;
    document.querySelector("#viewToggleBtn").onclick = _handleViewToggle;
  }

  function _bindSchemeEvents() {}

  function _bindBatchEvents() {
    document.querySelector("#fillSelBtn").onclick = _handleBatchFill;
    document.querySelector("#clearSelBtn").onclick = _handleBatchClear;
    document.querySelector("#flipHSelBtn").onclick = _handleBatchFlipH;
    document.querySelector("#flipVSelBtn").onclick = _handleBatchFlipV;
    document.querySelector("#copySelBtn").onclick = _handleBatchCopy;
    document.querySelector("#pasteSelBtn").onclick = _handleBatchPaste;
  }

  function _bindWorkspaceEvents() {
    document.querySelector("#workspaceEditBtn").onclick = function() {
      _switchWorkspace("edit");
    };
    document.querySelector("#workspaceCompareBtn").onclick = function() {
      _switchWorkspace("compare");
    };
  }

  function _renderInitial() {
    GridRender.render();
    SchemeUI.renderAll();
  }

  function _handleNewGrid() {
    var c = Number(_colsInput.value);
    var r = Number(_rowsInput.value);
    SchemeStore.update(SchemeStore.getActiveId(), {
      cols: c,
      rows: r,
      cells: SchemeStore.defaultCells(c, r),
      undo: [],
      redo: []
    });
    SelectionState.reset();
    GridInteraction.setGridSize(c, r);
    GridRender.render();
    SchemeUI.renderSchemeList();
  }

  function _handleUndo() {
    var undoArr = AppState.undo;
    if (!undoArr.length) return;
    var last = undoArr.pop();
    SchemeStore.update(SchemeStore.getActiveId(), {
      undo: undoArr,
      redo: AppState.redo.concat([AppState.cells.slice()]),
      cells: last
    });
    GridRender.render();
    SchemeUI.renderSchemeList();
  }

  function _handleRedo() {
    var redoArr = AppState.redo;
    if (!redoArr.length) return;
    var last = redoArr.pop();
    SchemeStore.update(SchemeStore.getActiveId(), {
      redo: redoArr,
      undo: AppState.undo.concat([AppState.cells.slice()]),
      cells: last
    });
    GridRender.render();
    SchemeUI.renderSchemeList();
  }

  function _handleSave() {
    SchemeStore.saveActive();
    SchemeUI.renderSchemeList();
    if (typeof ThreadPanel !== "undefined" && ThreadPanel.refresh) {
      ThreadPanel.refresh();
    }
    if (typeof VersionTimelineUI !== "undefined") {
      VersionTimelineUI.refresh();
    }
    var btn = document.querySelector("#saveBtn");
    var orig = btn.textContent;
    btn.textContent = "已保存 ✓";
    setTimeout(function() { btn.textContent = orig; }, 1200);
  }

  function _handleExportJSON() {
    ImportExport.exportJSON();
  }

  function _handleExportSVG() {
    ImportExport.exportSVG();
  }

  function _handleImport() {
    ImportExport.importJSON();
  }

  function _handleNewScheme() {
    var c = Number(_colsInput.value) || 18;
    var r = Number(_rowsInput.value) || 14;
    var newScheme = SchemeStore.create(SchemeStore.nextName(), c, r);
    SchemeStore.setActive(newScheme.id);
    _colsInput.value = c;
    _rowsInput.value = r;
    SelectionState.reset();
    GridInteraction.setGridSize(c, r);
    SchemeUI.refreshAll();

    var item = _schemeListEl.querySelector('[data-id="' + newScheme.id + '"]');
    if (item) {
      var nameEl = item.querySelector('[data-role="name"]');
      if (nameEl) {
        var input = document.createElement("input");
        input.type = "text";
        input.className = "scheme-rename-input";
        input.value = newScheme.name;
        nameEl.replaceWith(input);
        input.focus();
        input.select();
        input.addEventListener("blur", function() {
          var val = input.value.trim();
          if (val) SchemeStore.rename(newScheme.id, val);
          SchemeUI.refreshAll();
        });
        input.addEventListener("keydown", function(e) {
          if (e.key === "Enter") { e.preventDefault(); input.blur(); }
          else if (e.key === "Escape") { e.preventDefault(); input.blur(); }
        });
      }
    }
  }

  function _handleToggleMode() {
    SelectionState.toggleMode();
  }

  function _handleViewToggle() {
    if (typeof ProcessView !== "undefined") {
      if (ProcessView.isProcessView()) {
        ProcessView.switchToCanvas();
        document.querySelector("#viewToggleBtn").textContent = "织造工序视图";
        document.querySelector("#exportProcessBtn").style.display = "none";
      } else {
        ProcessView.switchToProcess();
        document.querySelector("#viewToggleBtn").textContent = "返回编辑视图";
        document.querySelector("#exportProcessBtn").style.display = "";
      }
    }
  }

  function _handleBatchFill() {
    GridRender.batchFillSelection();
    SchemeUI.renderSchemeList();
  }

  function _handleBatchClear() {
    GridRender.batchClearSelection();
    SchemeUI.renderSchemeList();
  }

  function _handleBatchFlipH() {
    GridRender.batchFlipHorizontal();
    SchemeUI.renderSchemeList();
  }

  function _handleBatchFlipV() {
    GridRender.batchFlipVertical();
    SchemeUI.renderSchemeList();
  }

  function _handleBatchCopy() {
    GridRender.batchCopySelection();
  }

  function _handleBatchPaste() {
    GridRender.batchPasteSelection();
    SchemeUI.renderSchemeList();
  }

  function _switchWorkspace(workspace) {
    _currentWorkspace = workspace;

    var editWorkspace = document.querySelector("#editWorkspace");
    var compareWorkspace = document.querySelector("#compareWorkspace");
    var editBtn = document.querySelector("#workspaceEditBtn");
    var compareBtn = document.querySelector("#workspaceCompareBtn");
    var viewToggleBar = document.querySelector(".view-toggle-bar");

    if (workspace === "edit") {
      editWorkspace.style.display = "";
      compareWorkspace.classList.remove("active");
      editBtn.classList.add("active");
      compareBtn.classList.remove("active");
      if (viewToggleBar) viewToggleBar.style.display = "";
    } else {
      editWorkspace.style.display = "none";
      compareWorkspace.classList.add("active");
      editBtn.classList.remove("active");
      compareBtn.classList.add("active");
      if (viewToggleBar) viewToggleBar.style.display = "none";

      if (typeof CompareSelector !== "undefined") {
        CompareSelector.refresh();
      }
    }
  }

  return {
    init: init
  };
})();

document.addEventListener("DOMContentLoaded", function() {
  App.init();
});
