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

    const blocks = BlockStore.getAll();
    const activeBlock = typeof AppState !== 'undefined' ? AppState.block : null;

    const customBlocksHtml = blocks.length > 0 ? blocks.map(block => {
      const isActive = activeBlock === block.id;
      const previewHtml = renderBlockPreview(block);
      return `
        <div class="custom-block-item ${isActive ? 'active' : ''}" data-block-id="${block.id}">
          <div class="custom-block-preview">
            ${previewHtml}
          </div>
          <div class="custom-block-info">
            <span class="custom-block-name" data-role="name">${escapeHtml(block.name)}</span>
            <span class="custom-block-size">${block.cols}×${block.rows}</span>
          </div>
          <div class="custom-block-actions">
            <button class="ghost" data-action="edit" title="编辑">✎</button>
            <button class="ghost" data-action="rename" title="重命名">↺</button>
            <button class="ghost" data-action="duplicate" title="复制">⧉</button>
            <button class="danger" data-action="delete" title="删除">✕</button>
          </div>
        </div>
      `;
    }).join("") : `<div class="empty-hint">暂无自定义纹样块</div>`;

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
      <div class="custom-blocks-section">
        <div class="section-title">自定义纹样块</div>
        <div class="custom-blocks-list">
          ${customBlocksHtml}
        </div>
      </div>
    `;

    _bindEvents();
  }

  function renderBlockPreview(block) {
    const { cols, rows, pattern } = block;
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

  return {
    init,
    render
  };
})();
