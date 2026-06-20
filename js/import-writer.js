const ImportWriter = (function() {

  function createNewScheme(parsedData, schemeStore, options = {}) {
    if (!parsedData || !schemeStore) {
      throw new Error("参数不完整");
    }

    const { cols, rows, cells, name, threads } = parsedData;

    if (cols === null || rows === null || !cells) {
      throw new Error("导入数据不完整，无法创建方案");
    }

    const finalName = options.name || schemeStore.nextName(name || "导入方案");

    const importedThreads = threads && Array.isArray(threads) ? threads : null;
    if (importedThreads && importedThreads.length > 0 && ThreadStore && ThreadStore.importThreads) {
      ThreadStore.importThreads(importedThreads, "merge");
    }

    const newScheme = schemeStore.create(finalName, cols, rows);

    const threadList = ThreadStore && ThreadStore.getAll ? ThreadStore.getAll() : [];
    const normalizedCells = normalizeCells(cells, cols, rows, threadList, importedThreads);
    const firstThreadId = threadList.length > 0 ? threadList[0].id : null;

    schemeStore.update(newScheme.id, {
      cells: normalizedCells,
      activeColor: firstThreadId,
      undo: [],
      redo: []
    });

    return schemeStore._schemes[newScheme.id];
  }

  function overwriteCurrentScheme(parsedData, schemeStore, options = {}) {
    if (!parsedData || !schemeStore) {
      throw new Error("参数不完整");
    }

    const { cols, rows, cells, name, threads } = parsedData;

    if (cols === null || rows === null || !cells) {
      throw new Error("导入数据不完整，无法覆盖方案");
    }

    const importedThreads = threads && Array.isArray(threads) ? threads : null;
    if (importedThreads && importedThreads.length > 0 && ThreadStore && ThreadStore.importThreads) {
      ThreadStore.importThreads(importedThreads, "merge");
    }

    const activeId = schemeStore.getActiveId();
    if (!activeId) {
      throw new Error("当前没有活动方案");
    }

    const threadList = ThreadStore && ThreadStore.getAll ? ThreadStore.getAll() : [];
    const normalizedCells = normalizeCells(cells, cols, rows, threadList, importedThreads);
    const firstThreadId = threadList.length > 0 ? threadList[0].id : null;

    const updateData = {
      cols,
      rows,
      cells: normalizedCells,
      activeColor: firstThreadId,
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

  function normalizeCells(cells, cols, rows, currentThreads, importedThreads) {
    const total = cols * rows;
    const result = [];
    const hasLegacyFormat = cells.some(v => typeof v === "number");
    const firstThreadId = currentThreads.length > 0 ? currentThreads[0].id : null;

    if (hasLegacyFormat) {
      const sortedThreads = importedThreads && importedThreads.length > 0
        ? [...importedThreads].sort((a, b) => (a.order || 0) - (b.order || 0))
        : currentThreads;

      for (let i = 0; i < total; i++) {
        if (i < cells.length) {
          const v = cells[i];
          if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < sortedThreads.length) {
            result.push(sortedThreads[v].id);
          } else {
            result.push(firstThreadId);
          }
        } else {
          result.push(firstThreadId);
        }
      }
    } else {
      const threadIds = new Set(currentThreads.map(t => t.id));
      if (importedThreads && importedThreads.length > 0) {
        importedThreads.forEach(t => threadIds.add(t.id));
      }

      for (let i = 0; i < total; i++) {
        if (i < cells.length) {
          const v = cells[i];
          if (typeof v === "string" && threadIds.has(v)) {
            result.push(v);
          } else {
            result.push(firstThreadId);
          }
        } else {
          result.push(firstThreadId);
        }
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
