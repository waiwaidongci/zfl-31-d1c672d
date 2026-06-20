const SchemeUI = (function() {

  var _listEl = null;

  function init(options) {
    _listEl = options.listEl || null;
  }

  function _escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function renderSchemeList() {
    var schemes = SchemeStore.getAll();
    var activeId = SchemeStore.getActiveId();
    if (!_listEl) return;

    if (schemes.length === 0) {
      _listEl.innerHTML = '<div class="empty-hint">暂无方案</div>';
      return;
    }

    _listEl.innerHTML = schemes.map(function(s) {
      var isActive = s.id === activeId;
      var firstId = ThreadStore.getFirstId();
      var filledCount = s.cells.filter(function(v) { return v !== firstId; }).length;
      var meta = s.cols + "×" + s.rows + " · " + filledCount + " 格已填";
      var versionCount = (s.versions && s.versions.length) || 0;
      var versionMeta = versionCount > 0 ? ' · ' + versionCount + '个版本' : '';

      return '<div class="scheme-item ' + (isActive ? "active" : "") + '" data-id="' + s.id + '">' +
        '<div class="scheme-item-head">' +
          '<span class="scheme-name" data-role="name">' + _escapeHtml(s.name) + '</span>' +
          '<div class="scheme-actions">' +
            '<button class="ghost" data-action="rename" title="重命名">✎</button>' +
            '<button class="ghost" data-action="duplicate" title="复制">⧉</button>' +
            '<button class="danger" data-action="delete" title="删除">✕</button>' +
          '</div>' +
        '</div>' +
        '<div class="scheme-meta">' + meta + versionMeta + '</div>' +
      '</div>';
    }).join("");

    _listEl.querySelectorAll(".scheme-item").forEach(function(item) {
      var id = item.dataset.id;

      item.addEventListener("click", function(e) {
        if (e.target.closest("[data-action]")) return;
        switchScheme(id);
      });

      item.querySelector('[data-action="rename"]').addEventListener("click", function(e) {
        e.stopPropagation();
        _startRename(id, item);
      });

      item.querySelector('[data-action="duplicate"]').addEventListener("click", function(e) {
        e.stopPropagation();
        var newScheme = SchemeStore.duplicate(id);
        if (newScheme) switchScheme(newScheme.id);
      });

      item.querySelector('[data-action="delete"]').addEventListener("click", function(e) {
        e.stopPropagation();
        var sch = SchemeStore._schemes[id];
        var count = Object.keys(SchemeStore._schemes).length;
        var msg = count <= 1
          ? "只剩一个方案，删除后将自动创建新的默认方案。确定删除吗？"
          : '确定删除方案"' + (sch ? sch.name : "") + '"吗？';
        if (confirm(msg)) {
          SchemeStore.remove(id);
          refreshAll();
        }
      });
    });
  }

  function _startRename(id, itemEl) {
    var nameEl = itemEl.querySelector('[data-role="name"]');
    var currentName = SchemeStore._schemes[id].name;
    var input = document.createElement("input");
    input.type = "text";
    input.className = "scheme-rename-input";
    input.value = currentName;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    var finish = function(save) {
      var val = input.value.trim();
      if (save && val) {
        SchemeStore.rename(id, val);
      }
      refreshAll();
    };

    input.addEventListener("blur", function() { finish(true); });
    input.addEventListener("keydown", function(e) {
      if (e.key === "Enter") { e.preventDefault(); finish(true); }
      else if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });
  }

  function switchScheme(id) {
    if (SchemeStore.setActive(id)) {
      document.querySelector("#cols").value = AppState.cols;
      document.querySelector("#rows").value = AppState.rows;
      if (typeof ProcessView !== "undefined" && ProcessView.isProcessView()) {
        ProcessView.switchToCanvas();
      }
      SelectionState.reset();
      GridInteraction.setGridSize(AppState.cols, AppState.rows);
      refreshAll();
    }
  }

  function refreshAll() {
    renderSchemeList();
    GridRender.render();
    if (typeof ThreadPanel !== "undefined" && typeof ThreadPanel.refresh === "function") {
      ThreadPanel.refresh();
    }
    if (typeof VersionTimelineUI !== "undefined" && typeof VersionTimelineUI.refresh === "function") {
      VersionTimelineUI.refresh();
    }
  }

  return {
    init: init,
    renderSchemeList: renderSchemeList,
    switchScheme: switchScheme,
    refreshAll: refreshAll
  };
})();
