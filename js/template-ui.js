const TemplateUI = (function() {
  let activeCategory = "border";
  let selectedTemplateId = null;
  let applyMode = TemplateApplier.MODE_OVERWRITE;
  let containerEl = null;

  function init(container) {
    containerEl = container;
    render();
  }

  function render() {
    if (!containerEl) return;

    const categories = TemplateData.getCategories();
    const templates = TemplateData.getByCategory(activeCategory);

    containerEl.innerHTML = `
      <div class="template-section-title">
        <h2>纹样模板库</h2>
      </div>
      <div class="template-tabs">
        ${categories.map(cat => `
          <button class="template-tab ${cat.id === activeCategory ? 'active' : ''}" data-cat="${cat.id}">
            ${cat.name}
          </button>
        `).join("")}
      </div>
      <div class="template-grid" id="templateGrid"></div>
      <div class="template-controls">
        <div class="template-mode">
          <label>
            <input type="radio" name="tplMode" value="${TemplateApplier.MODE_OVERWRITE}" ${applyMode === TemplateApplier.MODE_OVERWRITE ? 'checked' : ''}>
            覆盖模式
          </label>
          <label>
            <input type="radio" name="tplMode" value="${TemplateApplier.MODE_SKIP}" ${applyMode === TemplateApplier.MODE_SKIP ? 'checked' : ''}>
            跳过模式
          </label>
        </div>
        <button class="insert-btn" id="insertTemplateBtn" ${!selectedTemplateId ? 'disabled' : ''}>
          ${selectedTemplateId ? '插入到画布' : '请选择模板'}
        </button>
      </div>
    `;

    const gridEl = containerEl.querySelector("#templateGrid");
    renderTemplateGrid(gridEl, templates);

    containerEl.querySelectorAll(".template-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        activeCategory = tab.dataset.cat;
        selectedTemplateId = null;
        render();
      });
    });

    containerEl.querySelectorAll('input[name="tplMode"]').forEach(radio => {
      radio.addEventListener("change", () => {
        applyMode = radio.value;
      });
    });

    containerEl.querySelector("#insertTemplateBtn").addEventListener("click", () => {
      if (!selectedTemplateId) return;
      const template = TemplateData.getById(selectedTemplateId);
      if (template) {
        const changed = TemplateApplier.applyTemplate(template, { mode: applyMode });
        if (changed) {
          render();
          if (typeof window.render === 'function') {
            window.render();
          }
          if (typeof window.renderSchemeList === 'function') {
            window.renderSchemeList();
          }
        }
      }
    });
  }

  function renderTemplateGrid(gridEl, templates) {
    if (templates.length === 0) {
      gridEl.innerHTML = '<div class="empty-hint">暂无模板</div>';
      return;
    }

    gridEl.innerHTML = templates.map(tpl => {
      const isActive = tpl.id === selectedTemplateId;
      const previewHtml = renderPreview(tpl);
      return `
        <div class="template-card ${isActive ? 'active' : ''}" data-id="${tpl.id}" title="${tpl.name}">
          <div class="template-preview" style="grid-template-columns: repeat(${tpl.cols}, 1fr);">
            ${previewHtml}
          </div>
          <div class="template-name">${tpl.name}</div>
          <div class="template-size">${tpl.cols}×${tpl.rows}</div>
        </div>
      `;
    }).join("");

    gridEl.querySelectorAll(".template-card").forEach(card => {
      card.addEventListener("click", () => {
        selectedTemplateId = card.dataset.id;
        render();
      });

      card.addEventListener("dblclick", () => {
        selectedTemplateId = card.dataset.id;
        const template = TemplateData.getById(selectedTemplateId);
        if (template) {
          TemplateApplier.applyTemplate(template, { mode: applyMode });
          render();
          if (typeof window.render === 'function') {
            window.render();
          }
          if (typeof window.renderSchemeList === 'function') {
            window.renderSchemeList();
          }
        }
      });
    });
  }

  function renderPreview(tpl) {
    const cells = [];
    const threads = ThreadStore.getAll();
    const sortedThreads = ThreadModel.sortByOrder(threads);
    const firstColor = sortedThreads.length > 0 ? sortedThreads[0].color : "transparent";

    for (let y = 0; y < tpl.rows; y++) {
      for (let x = 0; x < tpl.cols; x++) {
        const v = tpl.pattern[y][x];
        let color = firstColor;
        if (v !== 0 && v < sortedThreads.length) {
          color = sortedThreads[v].color;
        }
        const bg = v === 0 ? "transparent" : color;
        cells.push(`<div class="tcell" style="background:${bg};"></div>`);
      }
    }
    return cells.join("");
  }

  function getSelectedTemplate() {
    if (!selectedTemplateId) return null;
    return TemplateData.getById(selectedTemplateId);
  }

  return {
    init,
    render,
    getSelectedTemplate
  };
})();
