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

    const normalizedCells = normalizeCells(cells, cols, rows);
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

    const normalizedCells = normalizeCells(cells, cols, rows);
    const updateData = {
      cols,
      rows,
      cells: normalizedCells,
      undo: [],
      redo: []
    };

    if (options.rename && name) {
      updateData.name = name;
    }

    const updated = schemeStore.update(activeId, updateData);
    return updated;
  }

  function normalizeCells(cells, cols, rows) {
    const total = cols * rows;
    const result = [];

    for (let i = 0; i < total; i++) {
      if (i < cells.length) {
        const v = cells[i];
        if (typeof v === "number" && Number.isInteger(v) && v >= 0) {
          result.push(v);
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
