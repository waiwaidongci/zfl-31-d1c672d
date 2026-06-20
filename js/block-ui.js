const BlockUI = (function() {

  let _container = null;
  let _onBlockSelect = null;

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function init(options = {}) {
    _container = options.container || null;
    _onBlockSelect = options.onBlockSelect || null;

    if (!_container) return;

    BlockStore.load();

    BlockStore.subscribe(() => render());

    render();
  }

  function render() {
    if (!_container) return;

    const activeBlock = typeof AppState !== 'undefined' ? AppState.block : null;
    const transform = typeof AppState !== 'undefined' ? AppState.blockTransform : { rotate90: false, flipH: false, flipV: false };
    const tileMode = typeof AppState !== 'undefined' ? AppState.blockTileMode : false;
    const filter = typeof AppState !== 'undefined' ? AppState.blockFilter : { category: "all", search: "" };

    const blocks = BlockStore.getFiltered(filter);
    const categories = BlockStore.getAllCategories();

    const customBlocksHtml = blocks.length > 0 ? blocks.map(block => {
      const isActive = activeBlock === block.id;
      const previewHtml = renderBlockPreview(block, transform);
      const category = block.category || "未分类";
      const notes = block.notes || "";
      return `
        <div class="custom-block-item ${isActive ? 'active' : ''}" data-block-id="${block.id}">
          <div class="custom-block-preview">
            ${previewHtml}
          </div>
          <div class="custom-block-info">
            <span class="custom-block-name" data-role="name">${escapeHtml(block.name)}</span>
            <span class="custom-block-category">${escapeHtml(category)}</span>
            <span class="custom-block-size">${block.cols}×${block.rows}${notes ? ' · ' + escapeHtml(notes) : ''}</span>
          </div>
          <div class="custom-block-actions">
            <button class="ghost" data-action="edit" title="编辑">✎</button>
            <button class="ghost" data-action="rename" title="重命名">↺</button>
            <button class="ghost" data-action="category" title="修改分类">⚑</button>
            <button class="ghost" data-action="duplicate" title="复制">⧉</button>
            <button class="danger" data-action="delete" title="删除">✕</button>
          </div>
        </div>
      `;
    }).join("") : `<div class="empty-hint">暂无自定义纹样块</div>`;

    const categoryOptions = [
      `<option value="all">全部分类</option>`,
      ...categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)
    ].join("");

    _container.innerHTML = `
      <div class="blocks-header">
        <h2 style="margin:0;">基础纹样块</h2>
        <button id="newBlockBtn" class="secondary" style="padding:6px 10px;font-size:13px;">+ 新建</button>
      </div>
      <div class="blocks builtin-blocks">
        <button data-block="dot" class="secondary ${activeBlock === 'dot' ? 'active' : ''}">单点</button>
        <button data-block="cross" class="secondary ${activeBlock === 'cross' ? 'active' : ''}">十字</button>
        <button data-block="diamond" class="secondary ${activeBlock === 'diamond' ? 'active' : ''}">小菱形</button>
      </div>

      <div class="block-transform-section">
        <div class="section-title">变换设置</div>
        <div class="transform-toolbar">
          <button class="transform-btn ${transform.rotate90 ? 'active' : ''}" data-transform="rotate90" title="旋转90度">↻</button>
          <button class="transform-btn ${transform.flipH ? 'active' : ''}" data-transform="flipH" title="水平翻转">⇋</button>
          <button class="transform-btn ${transform.flipV ? 'active' : ''}" data-transform="flipV" title="垂直翻转">⇵</button>
          <button class="transform-btn ${tileMode ? 'active' : ''}" data-transform="tile" title="按选择区域铺贴">▦</button>
          <button class="transform-btn reset-btn" data-transform="reset" title="重置变换">⟲</button>
        </div>
      </div>

      <div class="custom-blocks-section">
        <div class="custom-blocks-header">
          <div class="section-title">自定义纹样块</div>
          <div class="block-filters">
            <input type="text" class="block-search" id="blockSearch" placeholder="搜索名称..." value="${escapeHtml(filter.search || '')}">
            <select class="block-category-filter" id="blockCategoryFilter">
              ${categoryOptions}
            </select>
          </div>
        </div>
        <div class="custom-blocks-list">
          ${customBlocksHtml}
        </div>
      </div>
    `;

    _bindEvents();
  }

  function renderBlockPreview(block, transform = {}) {
    const transformed = BlockStore.getTransformedPattern(block.id, transform);
    if (!transformed) return "";
    const { cols, rows, pattern } = transformed;
    let html = `<div class="block-mini-preview" style="grid-template-columns: repeat(${cols}, 1fr);">`;
    for (let i = 0; i < pattern.length; i++) {
      html += `<div class="block-mini-cell ${pattern[i] ? 'filled' : ''}"></div>`;
    }
    html += `</div>`;
    return html;
  }

  function _bindEvents() {
    if (!_container) return;

    _container.querySelectorAll("[data-block]").forEach(btn => {
      btn.onclick = () => {
        const blockId = btn.dataset.block;
        if (typeof _onBlockSelect === "function") {
          _onBlockSelect(blockId);
        }
        render();
      };
    });

    _container.querySelectorAll(".transform-btn").forEach(btn => {
      btn.onclick = () => {
        const transformType = btn.dataset.transform;
        _handleTransform(transformType);
      };
    });

    const searchInput = _container.querySelector("#blockSearch");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        AppState.setBlockFilter({ search: e.target.value });
        render();
      });
    }

    const categoryFilter = _container.querySelector("#blockCategoryFilter");
    if (categoryFilter) {
      categoryFilter.value = AppState.blockFilter.category || "all";
      categoryFilter.addEventListener("change", (e) => {
        AppState.setBlockFilter({ category: e.target.value });
        render();
      });
    }

    _container.querySelectorAll(".custom-block-item").forEach(item => {
      const blockId = item.dataset.blockId;

      item.addEventListener("click", (e) => {
        if (e.target.closest("[data-action]")) return;
        if (typeof _onBlockSelect === "function") {
          _onBlockSelect(blockId);
        }
        render();
      });

      const editBtn = item.querySelector('[data-action="edit"]');
      if (editBtn) {
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          BlockEditor.open({
            blockId,
            onSave: () => {
              if (typeof AppState !== 'undefined' && AppState.block === blockId) {
                if (typeof _onBlockSelect === "function") {
                  _onBlockSelect(blockId);
                }
              }
            }
          });
        });
      }

      const renameBtn = item.querySelector('[data-action="rename"]');
      if (renameBtn) {
        renameBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          _startRename(blockId, item);
        });
      }

      const categoryBtn = item.querySelector('[data-action="category"]');
      if (categoryBtn) {
        categoryBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          _startEditCategory(blockId, item);
        });
      }

      const duplicateBtn = item.querySelector('[data-action="duplicate"]');
      if (duplicateBtn) {
        duplicateBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const newBlock = BlockStore.duplicate(blockId);
          if (newBlock && typeof _onBlockSelect === "function") {
            _onBlockSelect(newBlock.id);
          }
        });
      }

      const deleteBtn = item.querySelector('[data-action="delete"]');
      if (deleteBtn) {
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const block = BlockStore.getById(blockId);
          if (!block) return;
          if (confirm(`确定删除纹样块"${block.name}"吗？`)) {
            BlockStore.remove(blockId);
            if (typeof AppState !== 'undefined' && AppState.block === blockId) {
              AppState.block = "dot";
              if (typeof _onBlockSelect === "function") {
                _onBlockSelect("dot");
              }
            }
          }
        });
      }
    });

    const newBlockBtn = _container.querySelector("#newBlockBtn");
    if (newBlockBtn) {
      newBlockBtn.onclick = () => {
        BlockEditor.open({
          onSave: () => {
            const blocks = BlockStore.getAll();
            if (blocks.length > 0 && typeof _onBlockSelect === "function") {
              _onBlockSelect(blocks[0].id);
            }
          }
        });
      };
    }
  }

  function _handleTransform(transformType) {
    if (transformType === "reset") {
      AppState.resetBlockTransform();
      AppState.blockTileMode = false;
    } else if (transformType === "tile") {
      AppState.blockTileMode = !AppState.blockTileMode;
    } else {
      const current = AppState.blockTransform;
      AppState.setBlockTransform({ [transformType]: !current[transformType] });
    }
    if (typeof _onBlockSelect === "function" && typeof AppState !== 'undefined') {
      _onBlockSelect(AppState.block);
    }
    render();
  }

  function _startRename(blockId, itemEl) {
    const nameEl = itemEl.querySelector('[data-role="name"]');
    const currentName = BlockStore.getById(blockId)?.name || "";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "block-rename-input";
    input.value = currentName;
    input.maxLength = 20;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    const finish = (save) => {
      const val = input.value.trim();
      if (save && val) {
        BlockStore.rename(blockId, val);
      } else {
        render();
      }
    };

    input.addEventListener("blur", () => finish(true));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); finish(true); }
      else if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });
  }

  function _startEditCategory(blockId, itemEl) {
    const categoryEl = itemEl.querySelector('.custom-block-category');
    const currentCategory = BlockStore.getById(blockId)?.category || "未分类";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "block-category-input";
    input.value = currentCategory;
    input.maxLength = 20;
    categoryEl.replaceWith(input);
    input.focus();
    input.select();

    const finish = (save) => {
      const val = input.value.trim();
      if (save && val) {
        BlockStore.setCategory(blockId, val);
      } else {
        render();
      }
    };

    input.addEventListener("blur", () => finish(true));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); finish(true); }
      else if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });
  }

  return {
    init,
    render
  };
})();
