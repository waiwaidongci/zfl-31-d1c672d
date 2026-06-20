const ImportWriter = (function() {

  function createNewScheme(parsedData, schemeStore, options = {}) {
    if (!parsedData || !schemeStore) {
      throw new Error("参数不完整");
    }

    const { cols, rows, cells, name } = parsedData;

    if (cols === null || rows === null || !cells) {
      throw new Error("导入数据不完整，无法创建方案");
    }

    const finalName = options.name || schemeStore.nextName(name || "导入方案");
    const newScheme = schemeStore.create(finalName, cols, rows);

    const normalizedCells = normalizeCells(cells, cols, rows, options.maxColorIndex);
    schemeStore.update(newScheme.id, {
      cells: normalizedCells,
      undo: [],
      redo: []
    });

    return schemeStore._schemes[newScheme.id];
  }

  function overwriteCurrentScheme(parsedData, schemeStore, options = {}) {
    if (!parsedData || !schemeStore) {
      throw new Error("参数不完整");
    }

    const { cols, rows, cells, name } = parsedData;

    if (cols === null || rows === null || !cells) {
      throw new Error("导入数据不完整，无法覆盖方案");
    }

    const activeId = schemeStore.getActiveId();
    if (!activeId) {
      throw new Error("当前没有活动方案");
    }

    const normalizedCells = normalizeCells(cells, cols, rows, options.maxColorIndex);
    const updateData = {
      cols,
      rows,
      cells: normalizedCells,
      undo: [],
      redo: []
    };

    if (options.rename && name) {
      updateData.name = resolveUniqueName(name, schemeStore, activeId);
    }

    const updated = schemeStore.update(activeId, updateData);
    return updated;
  }

  function resolveUniqueName(name, schemeStore, excludeId) {
    const allSchemes = schemeStore.getAll();
    const conflict = allSchemes.find(s => s.id !== excludeId && s.name === name);
    if (!conflict) return name;
    return schemeStore.nextName(name);
  }

  function normalizeCells(cells, cols, rows, maxColorIndex) {
    const total = cols * rows;
    const result = [];
    const hasMax = typeof maxColorIndex === "number" && maxColorIndex >= 0;

    for (let i = 0; i < total; i++) {
      if (i < cells.length) {
        const v = cells[i];
        if (typeof v === "number" && Number.isInteger(v) && v >= 0) {
          if (hasMax && v > maxColorIndex) {
            result.push(0);
          } else {
            result.push(v);
          }
        } else {
          result.push(0);
        }
      } else {
        result.push(0);
      }
    }

    return result;
  }

  function importAsNew(parsedData, schemeStore, options = {}) {
    const result = createNewScheme(parsedData, schemeStore, options);

    if (options.setActive !== false) {
      schemeStore.setActive(result.id);
    }

    return {
      success: true,
      mode: "new",
      scheme: result
    };
  }

  function importAsOverwrite(parsedData, schemeStore, options = {}) {
    const result = overwriteCurrentScheme(parsedData, schemeStore, options);

    return {
      success: true,
      mode: "overwrite",
      scheme: result
    };
  }

  return {
    importAsNew,
    importAsOverwrite,
    createNewScheme,
    overwriteCurrentScheme,
    normalizeCells
  };
})();
