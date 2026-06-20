const SchemeUI = (function() {

  var _listEl = null;
  var _filterEl = null;
  var _favoriteFirst = false;
  var _selectedTag = null;

  function init(options) {
    _listEl = options.listEl || null;
    _filterEl = options.filterEl || null;
  }

  function _escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function _getFilteredSchemes() {
    return SchemeStore.getFiltered({
      favoriteFirst: _favoriteFirst,
      tag: _selectedTag
    });
  }

  function renderFilterBar() {
    if (!_filterEl) return;

    var allTags = SchemeStore.getAllTags();
    var hasFilter = _favoriteFirst || _selectedTag;

    var html = '<div class="scheme-filter-bar">';

    html += '<button class="filter-btn fav-btn ' + (_favoriteFirst ? "active" : "") + '" data-action="toggle-fav" title="收藏优先">';
    html += _favoriteFirst ? "★ 收藏优先" : "☆ 收藏优先";
    html += "</button>";

    html += '<div class="tag-filter-wrapper">';
    html += '<select class="tag-filter-select" data-action="filter-tag">';
    html += '<option value="">全部标签</option>';
    allTags.forEach(function(tag) {
      html += '<option value="' + _escapeHtml(tag) + '"' + (_selectedTag === tag ? " selected" : "") + '>' + _escapeHtml(tag) + '</option>';
    });
    html += '</select>';
    html += '</div>';

    if (hasFilter) {
      html += '<button class="filter-btn clear-btn" data-action="clear-filter" title="清空筛选">清空筛选</button>';
    }

    html += '</div>';

    _filterEl.innerHTML = html;

    _filterEl.querySelectorAll("[data-action]").forEach(function(btn) {
      btn.addEventListener("click", function(e) {
        e.stopPropagation();
        var action = btn.dataset.action;
        if (action === "toggle-fav") {
          _favoriteFirst = !_favoriteFirst;
          renderAll();
        } else if (action === "clear-filter") {
          _favoriteFirst = false;
          _selectedTag = null;
          renderAll();
        }
      });
    });

    var selectEl = _filterEl.querySelector('[data-action="filter-tag"]');
    if (selectEl) {
      selectEl.addEventListener("change", function(e) {
        _selectedTag = e.target.value || null;
        renderAll();
      });
    }
  }

  function renderSchemeList() {
    var schemes = _getFilteredSchemes();
    var activeId = SchemeStore.getActiveId();
    if (!_listEl) return;

    if (schemes.length === 0) {
      _listEl.innerHTML = '<div class="empty-hint">暂无符合条件的方案</div>';
      return;
    }

    _listEl.innerHTML = schemes.map(function(s) {
      var isActive = s.id === activeId;
      var firstId = ThreadStore.getFirstId();
      var filledCount = s.cells.filter(function(v) { return v !== firstId; }).length;
      var meta = s.cols + "×" + s.rows + " · " + filledCount + " 格已填";
      var versionCount = (s.versions && s.versions.length) || 0;
      var versionMeta = versionCount > 0 ? ' · ' + versionCount + '个版本' : '';
      var favIcon = s.favorite ? "★" : "☆";
      var favClass = s.favorite ? "fav-active" : "";

      var tagsHtml = "";
      if (s.tags && s.tags.length > 0) {
        tagsHtml = '<div class="scheme-tags">';
        s.tags.forEach(function(tag) {
          tagsHtml += '<span class="scheme-tag" data-tag="' + _escapeHtml(tag) + '">' + _escapeHtml(tag) + '<span class="tag-remove" data-remove-tag="' + _escapeHtml(tag) + '">×</span></span>';
        });
        tagsHtml += '<button class="tag-add-btn" data-action="add-tag" title="添加标签">+</button>';
        tagsHtml += '</div>';
      } else {
        tagsHtml = '<div class="scheme-tags"><button class="tag-add-btn" data-action="add-tag" title="添加标签">+ 添加标签</button></div>';
      }

      return '<div class="scheme-item ' + (isActive ? "active" : "") + ' ' + favClass + '" data-id="' + s.id + '">' +
        '<div class="scheme-item-head">' +
          '<button class="fav-toggle ' + (s.favorite ? "favorited" : "") + '" data-action="favorite" title="' + (s.favorite ? "取消收藏" : "收藏") + '">' + favIcon + '</button>' +
          '<span class="scheme-name" data-role="name">' + _escapeHtml(s.name) + '</span>' +
          '<div class="scheme-actions">' +
            '<button class="ghost" data-action="rename" title="重命名">✎</button>' +
            '<button class="ghost" data-action="duplicate" title="复制">⧉</button>' +
            '<button class="danger" data-action="delete" title="删除">✕</button>' +
          '</div>' +
        '</div>' +
        '<div class="scheme-meta">' + meta + versionMeta + '</div>' +
        tagsHtml +
      '</div>';
    }).join("");

    _listEl.querySelectorAll(".scheme-item").forEach(function(item) {
      var id = item.dataset.id;

      item.addEventListener("click", function(e) {
        if (e.target.closest("[data-action]")) return;
        if (e.target.closest(".scheme-tag")) return;
        if (e.target.closest(".tag-add-btn")) return;
        switchScheme(id);
      });

      item.querySelector('[data-action="favorite"]').addEventListener("click", function(e) {
        e.stopPropagation();
        SchemeStore.toggleFavorite(id);
        renderAll();
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
          renderAll();
        }
      });

      var tagAddBtn = item.querySelector(".tag-add-btn");
      if (tagAddBtn) {
        tagAddBtn.addEventListener("click", function(e) {
          e.stopPropagation();
          _startAddTag(id, item);
        });
      }

      item.querySelectorAll(".tag-remove").forEach(function(removeEl) {
        removeEl.addEventListener("click", function(e) {
          e.stopPropagation();
          var tag = removeEl.dataset.removeTag;
          SchemeStore.removeTag(id, tag);
          renderAll();
        });
      });

      item.querySelectorAll(".scheme-tag").forEach(function(tagEl) {
        tagEl.addEventListener("click", function(e) {
          e.stopPropagation();
          var tag = tagEl.dataset.tag;
          if (tag) {
            _selectedTag = tag;
            renderAll();
          }
        });
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
      renderAll();
    };

    input.addEventListener("blur", function() { finish(true); });
    input.addEventListener("keydown", function(e) {
      if (e.key === "Enter") { e.preventDefault(); finish(true); }
      else if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });
  }

  function _startAddTag(id, itemEl) {
    var tagsEl = itemEl.querySelector(".scheme-tags");
    var addBtn = itemEl.querySelector(".tag-add-btn");

    var input = document.createElement("input");
    input.type = "text";
    input.className = "tag-input";
    input.placeholder = "输入标签名，回车确认";

    addBtn.replaceWith(input);
    input.focus();

    var finish = function(save) {
      var val = input.value.trim();
      if (save && val) {
        SchemeStore.addTag(id, val);
      }
      renderAll();
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
      renderAll();
    }
  }

  function renderAll() {
    renderFilterBar();
    renderSchemeList();
  }

  function refreshAll() {
    renderAll();
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
    renderFilterBar: renderFilterBar,
    renderAll: renderAll,
    switchScheme: switchScheme,
    refreshAll: refreshAll
  };
})();
