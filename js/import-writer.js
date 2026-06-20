const ImportWriter = (function() {

  function createNewScheme(parsedData, schemeStore, options = {}) {
    if (!parsedData || !schemeStore) {
      throw new Error("参数不完整");
    }

    const { cols, rows, cells, name, threads, versions } = parsedData;

    if (cols === null || rows === null || !cells) {
      throw new Error("导入数据不完整，无法创建方案");
    }

    const finalName = options.name || schemeStore.nextName(name || "导入方案");

    const importedThreads = threads && Array.isArray(threads) ? threads : null;
    const threadConflicts = options.threadConflicts || [];
    const conflictResolutions = options.conflictResolutions || [];
    const hasConflictInfo = threadConflicts.length > 0 && conflictResolutions.length > 0;
    const idMap = {};

    if (importedThreads && importedThreads.length > 0 && ThreadStore) {
      if (hasConflictInfo && ThreadStore.resolveAndImportThreads) {
        Object.assign(idMap, ThreadStore.resolveAndImportThreads(importedThreads, threadConflicts, conflictResolutions));
      } else if (ThreadStore.importThreads) {
        ThreadStore.importThreads(importedThreads, "merge");
      }
    }

    const newScheme = schemeStore.create(finalName, cols, rows);

    const threadList = ThreadStore && ThreadStore.getAll ? ThreadStore.getAll() : [];
    const normalizedCells = normalizeCells(cells, cols, rows, threadList, importedThreads, idMap);
    const firstThreadId = threadList.length > 0 ? threadList[0].id : null;

    const updateData = {
      cells: normalizedCells,
      activeColor: firstThreadId,
      undo: [],
      redo: []
    };

    if (parsedData.estimateConfig && typeof parsedData.estimateConfig === "object") {
      updateData.estimateConfig = parsedData.estimateConfig;
    }

    if (versions && Array.isArray(versions) && versions.length > 0 &&
        typeof VersionHistory !== "undefined" && VersionHistory.importVersions) {
      const validVersions = versions.filter(function(v) {
        return v && v.id && v.timestamp && Array.isArray(v.cells);
      }).map(function(v) {
        const normalizedV = Object.assign({}, v);
        if (Array.isArray(v.cells)) {
          normalizedV.cells = normalizeCells(v.cells, v.cols || cols, v.rows || rows, threadList, importedThreads, idMap);
        }
        if (Array.isArray(v.colorStats)) {
          normalizedV.colorStats = remapColorStats(v.colorStats, idMap);
        }
        return normalizedV;
      });
      if (validVersions.length > 0) {
        VersionHistory.importVersions(newScheme.id, validVersions);
      }
    }

    schemeStore.update(newScheme.id, updateData);

    return schemeStore._schemes[newScheme.id];
  }

  function overwriteCurrentScheme(parsedData, schemeStore, options = {}) {
    if (!parsedData || !schemeStore) {
      throw new Error("参数不完整");
    }

    const { cols, rows, cells, name, threads, versions } = parsedData;

    if (cols === null || rows === null || !cells) {
      throw new Error("导入数据不完整，无法覆盖方案");
    }

    const importedThreads = threads && Array.isArray(threads) ? threads : null;
    const threadConflicts = options.threadConflicts || [];
    const conflictResolutions = options.conflictResolutions || [];
    const hasConflictInfo = threadConflicts.length > 0 && conflictResolutions.length > 0;
    const idMap = {};

    if (importedThreads && importedThreads.length > 0 && ThreadStore) {
      if (hasConflictInfo && ThreadStore.resolveAndImportThreads) {
        Object.assign(idMap, ThreadStore.resolveAndImportThreads(importedThreads, threadConflicts, conflictResolutions));
      } else if (ThreadStore.importThreads) {
        ThreadStore.importThreads(importedThreads, "merge");
      }
    }

    const activeId = schemeStore.getActiveId();
    if (!activeId) {
      throw new Error("当前没有活动方案");
    }

    const threadList = ThreadStore && ThreadStore.getAll ? ThreadStore.getAll() : [];
    const normalizedCells = normalizeCells(cells, cols, rows, threadList, importedThreads, idMap);
    const firstThreadId = threadList.length > 0 ? threadList[0].id : null;

    const updateData = {
      cols,
      rows,
      cells: normalizedCells,
      activeColor: firstThreadId,
      undo: [],
      redo: []
    };

    if (parsedData.estimateConfig && typeof parsedData.estimateConfig === "object") {
      updateData.estimateConfig = parsedData.estimateConfig;
    }

    if (options.rename && name) {
      updateData.name = resolveUniqueName(name, schemeStore, activeId);
    }

    if (versions && Array.isArray(versions) && versions.length > 0 &&
        typeof VersionHistory !== "undefined" && VersionHistory.importVersions) {
      const validVersions = versions.filter(function(v) {
        return v && v.id && v.timestamp && Array.isArray(v.cells);
      }).map(function(v) {
        const normalizedV = Object.assign({}, v);
        if (Array.isArray(v.cells)) {
          normalizedV.cells = normalizeCells(v.cells, v.cols || cols, v.rows || rows, threadList, importedThreads, idMap);
        }
        if (Array.isArray(v.colorStats)) {
          normalizedV.colorStats = remapColorStats(v.colorStats, idMap);
        }
        return normalizedV;
      });
      if (validVersions.length > 0) {
        VersionHistory.importVersions(activeId, validVersions);
      }
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

  function normalizeCells(cells, cols, rows, currentThreads, importedThreads, idMap) {
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
            const fileThreadId = sortedThreads[v].id;
            if (idMap && idMap[fileThreadId]) {
              result.push(idMap[fileThreadId]);
            } else {
              result.push(fileThreadId);
            }
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
            if (idMap && idMap[v]) {
              result.push(idMap[v]);
            } else {
              result.push(v);
            }
          } else if (typeof v === "string" && idMap && idMap[v]) {
            result.push(idMap[v]);
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

  function remapColorStats(colorStats, idMap) {
    if (!Array.isArray(colorStats) || !idMap) {
      return colorStats;
    }
    const currentThreads = ThreadStore && ThreadStore.getAll ? ThreadStore.getAll() : [];
    const threadById = {};
    currentThreads.forEach(t => { threadById[t.id] = t; });

    return colorStats.map(s => {
      const newId = idMap[s.id] || s.id;
      const t = threadById[newId];
      if (t) {
        return {
          ...s,
          id: newId,
          name: t.name || s.name,
          color: t.color || s.color,
          note: t.note != null ? t.note : s.note
        };
      }
      return { ...s, id: newId };
    });
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
