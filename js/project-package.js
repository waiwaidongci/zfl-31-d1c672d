const ProjectPackage = (function() {

  const PACKAGE_FORMAT_VERSION = 1;
  const PACKAGE_TYPE = "zfl31-project-package";

  function uid(prefix) {
    return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function buildExportPackage() {
    const schemes = SchemeStore.getAll();
    const schemesWithData = schemes.map(function(s) {
      return {
        id: s.id,
        name: s.name,
        cols: s.cols,
        rows: s.rows,
        cells: s.cells,
        activeColor: s.activeColor,
        activeBlock: s.activeBlock,
        versions: s.versions || [],
        favorite: s.favorite || false,
        tags: s.tags || [],
        estimateConfig: s.estimateConfig || null,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      };
    });

    const threads = ThreadStore.getAll();
    const blocks = BlockStore ? BlockStore.getAll() : [];
    const exportConfig = ExportConfig ? ExportConfig.getAll() : null;
    const riskConfig = RiskConfig ? RiskConfig.getAll() : null;

    const activeSchemeId = SchemeStore.getActiveId();

    return {
      type: PACKAGE_TYPE,
      formatVersion: PACKAGE_FORMAT_VERSION,
      exportedAt: Date.now(),
      metadata: {
        schemeCount: schemesWithData.length,
        threadCount: threads.length,
        blockCount: blocks.length,
        hasExportConfig: !!exportConfig,
        hasRiskConfig: !!riskConfig
      },
      activeSchemeId: activeSchemeId,
      schemes: schemesWithData,
      threads: threads,
      blocks: blocks,
      exportConfig: exportConfig,
      riskConfig: riskConfig
    };
  }

  function exportProjectPackage() {
    var pkg = buildExportPackage();
    var blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    var timestamp = new Date().toISOString().slice(0, 10);
    a.download = "zfl31-project-" + timestamp + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function parseAndValidatePackage(raw) {
    if (!raw || typeof raw !== "object") {
      throw new Error("文件内容格式不正确");
    }
    if (raw.type !== PACKAGE_TYPE) {
      throw new Error("这不是有效的项目包文件（缺少 type 标识）");
    }
    if (!raw.formatVersion || raw.formatVersion > PACKAGE_FORMAT_VERSION) {
      throw new Error("项目包版本过新，请升级应用后再导入");
    }
    if (!Array.isArray(raw.schemes)) {
      throw new Error("项目包缺少 schemes 数据");
    }
    if (!Array.isArray(raw.threads)) {
      throw new Error("项目包缺少 threads 数据");
    }

    return {
      type: raw.type,
      formatVersion: raw.formatVersion,
      exportedAt: raw.exportedAt || null,
      metadata: raw.metadata || {},
      activeSchemeId: raw.activeSchemeId || null,
      schemes: raw.schemes,
      threads: raw.threads,
      blocks: Array.isArray(raw.blocks) ? raw.blocks : [],
      exportConfig: raw.exportConfig || null,
      riskConfig: raw.riskConfig || null
    };
  }

  function detectConflicts(pkg) {
    const conflicts = {
      schemes: [],
      threads: [],
      blocks: [],
      versions: []
    };

    const currentSchemes = SchemeStore.getAll();
    const currentSchemeIds = {};
    const currentSchemeNames = {};
    currentSchemes.forEach(function(s) {
      currentSchemeIds[s.id] = s;
      currentSchemeNames[(s.name || "").toLowerCase().trim()] = s;
    });

    pkg.schemes.forEach(function(s) {
      const byId = currentSchemeIds[s.id];
      const byName = currentSchemeNames[(s.name || "").toLowerCase().trim()];
      if (byId || byName) {
        conflicts.schemes.push({
          packageScheme: { id: s.id, name: s.name, cols: s.cols, rows: s.rows, updatedAt: s.updatedAt },
          currentScheme: byId ? { id: byId.id, name: byId.name, cols: byId.cols, rows: byId.rows, updatedAt: byId.updatedAt } :
                        byName ? { id: byName.id, name: byName.name, cols: byName.cols, rows: byName.rows, updatedAt: byName.updatedAt } : null,
          conflictType: byId ? "id" : "name"
        });
      }

      if (s.versions && Array.isArray(s.versions)) {
        s.versions.forEach(function(v) {
          if (byId && byId.versions) {
            const exists = byId.versions.some(function(cv) { return cv.id === v.id; });
            if (exists) {
              conflicts.versions.push({
                schemeId: s.id,
                schemeName: s.name,
                versionId: v.id,
                versionLabel: v.label || "",
                versionTimestamp: v.timestamp
              });
            }
          }
        });
      }
    });

    const currentThreads = ThreadStore.getAll();
    const threadConflicts = ImportValidator.detectThreadConflicts(pkg.threads, currentThreads);
    conflicts.threads = threadConflicts;

    if (BlockStore && pkg.blocks && pkg.blocks.length > 0) {
      const currentBlocks = BlockStore.getAll();
      const currentBlockIds = {};
      const currentBlockNames = {};
      currentBlocks.forEach(function(b) {
        currentBlockIds[b.id] = b;
        const key = (b.name || "").toLowerCase().trim() + "|" + (b.category || "未分类").toLowerCase().trim();
        currentBlockNames[key] = b;
      });

      pkg.blocks.forEach(function(b) {
        const byId = currentBlockIds[b.id];
        const nameKey = (b.name || "").toLowerCase().trim() + "|" + (b.category || "未分类").toLowerCase().trim();
        const byName = currentBlockNames[nameKey];
        if (byId || byName) {
          conflicts.blocks.push({
            packageBlock: { id: b.id, name: b.name, category: b.category, cols: b.cols, rows: b.rows, updatedAt: b.updatedAt },
            currentBlock: byId ? { id: byId.id, name: byId.name, category: byId.category, cols: byId.cols, rows: byId.rows, updatedAt: byId.updatedAt } :
                          byName ? { id: byName.id, name: byName.name, category: byName.category, cols: byName.cols, rows: byName.rows, updatedAt: byName.updatedAt } : null,
            conflictType: byId ? "id" : "name"
          });
        }
      });
    }

    return conflicts;
  }

  function buildSummary(pkg, conflicts) {
    const totalVersions = pkg.schemes.reduce(function(sum, s) {
      return sum + (s.versions ? s.versions.length : 0);
    }, 0);

    return {
      packageInfo: {
        exportedAt: pkg.exportedAt,
        formatVersion: pkg.formatVersion,
        schemeCount: pkg.schemes.length,
        threadCount: pkg.threads.length,
        blockCount: pkg.blocks.length,
        versionCount: totalVersions,
        hasExportConfig: !!pkg.exportConfig,
        hasRiskConfig: !!pkg.riskConfig,
        activeSchemeId: pkg.activeSchemeId
      },
      conflicts: conflicts,
      conflictSummary: {
        schemeConflicts: conflicts.schemes.length,
        threadConflicts: conflicts.threads.length,
        blockConflicts: conflicts.blocks.length,
        versionConflicts: conflicts.versions.length,
        hasAnyConflict: conflicts.schemes.length > 0 || conflicts.threads.length > 0 ||
                        conflicts.blocks.length > 0 || conflicts.versions.length > 0
      },
      coverage: {
        schemesToAdd: pkg.schemes.length - conflicts.schemes.filter(function(c) { return c.conflictType === "id"; }).length,
        threadsToAdd: pkg.threads.length - conflicts.threads.length,
        blocksToAdd: pkg.blocks.length - conflicts.blocks.filter(function(c) { return c.conflictType === "id"; }).length,
        willReplaceExportConfig: !!pkg.exportConfig,
        willReplaceRiskConfig: !!pkg.riskConfig
      }
    };
  }

  function importPackage(pkg, options) {
    options = options || {};
    const mode = options.mode || "merge";
    const threadConflictResolutions = options.threadConflictResolutions || [];
    const schemeConflictResolutions = options.schemeConflictResolutions || {};
    const blockConflictResolutions = options.blockConflictResolutions || {};
    const importExportConfig = options.importExportConfig !== false;
    const importRiskConfig = options.importRiskConfig !== false;

    const idMap = {
      schemes: {},
      threads: {},
      blocks: {},
      versions: {}
    };

    if (mode === "replace") {
      return _importReplace(pkg, { importExportConfig, importRiskConfig });
    }

    return _importMerge(pkg, {
      threadConflictResolutions,
      schemeConflictResolutions,
      blockConflictResolutions,
      importExportConfig,
      importRiskConfig,
      idMap
    });
  }

  function _importReplace(pkg, options) {
    const result = {
      success: true,
      mode: "replace",
      imported: { schemes: 0, threads: 0, blocks: 0, versions: 0 },
      idMap: { schemes: {}, threads: {}, blocks: {}, versions: {} }
    };

    var ALL_KEYS = [
      "zfl31Schemes",
      "zfl31ActiveScheme",
      "zfl31Threads",
      "zfl31CustomBlocks"
    ];
    ALL_KEYS.forEach(function(k) {
      try { localStorage.removeItem(k); } catch (e) {}
    });

    if (typeof SchemeStore !== "undefined" && SchemeStore._schemes) {
      try {
        Object.keys(SchemeStore._schemes).forEach(function(id) {
          delete SchemeStore._schemes[id];
        });
      } catch (e) {}
    }
    if (typeof BlockStore !== "undefined" && BlockStore.load) BlockStore.load();
    if (options.importExportConfig && typeof ExportConfig !== "undefined" && ExportConfig.reset) {
      try { localStorage.removeItem("zfl31ExportConfig"); } catch (e) {}
      ExportConfig.reset();
    }
    if (options.importRiskConfig && typeof RiskConfig !== "undefined" && RiskConfig.reset) {
      try { localStorage.removeItem("zfl31RiskConfig"); } catch (e) {}
      RiskConfig.reset();
    }

    const threadMap = {};
    const importedThreads = pkg.threads.map(function(t, i) {
      const newThread = ThreadModel.createThread({
        id: t.id,
        name: t.name,
        color: t.color,
        note: t.note,
        order: i,
        lossConfig: t.lossConfig
      });
      threadMap[t.id] = newThread.id;
      result.idMap.threads[t.id] = newThread.id;
      return newThread;
    });
    ThreadStore.importThreads(importedThreads, "replace");
    result.imported.threads = importedThreads.length;

    if (BlockStore && pkg.blocks && pkg.blocks.length > 0) {
      const blockMap = {};
      pkg.blocks.forEach(function(b) {
        const newId = b.id || uid("b");
        blockMap[b.id] = newId;
        result.idMap.blocks[b.id] = newId;
      });

      try { localStorage.removeItem("zfl31CustomBlocks"); } catch (e) {}
      BlockStore.load();

      pkg.blocks.forEach(function(b) {
        const newId = blockMap[b.id];
        BlockStore.create({
          idOverride: newId,
          name: b.name,
          category: b.category,
          notes: b.notes,
          cols: b.cols,
          rows: b.rows,
          pattern: b.pattern
        });
        result.imported.blocks++;
      });
    }

    const currentThreads = ThreadStore.getAll();
    const schemeMap = {};

    pkg.schemes.forEach(function(s) {
      const newId = s.id || uid("s");
      schemeMap[s.id] = newId;
      result.idMap.schemes[s.id] = newId;

      const normalizedCells = _remapCells(s.cells, threadMap, currentThreads);

      const versions = (s.versions || []).map(function(v) {
        const newVersionId = v.id || uid("v");
        result.idMap.versions[v.id] = newVersionId;
        return {
          id: newVersionId,
          timestamp: v.timestamp,
          label: v.label || "",
          cells: _remapCells(v.cells, threadMap, currentThreads),
          cols: v.cols || s.cols,
          rows: v.rows || s.rows,
          name: v.name || s.name,
          colorStats: v.colorStats ? _remapColorStats(v.colorStats, threadMap) : null,
          riskRows: v.riskRows || [],
          thumbnailData: v.thumbnailData || null
        };
      });
      result.imported.versions += versions.length;

      const defaultEstimate = typeof YarnEstimate !== "undefined" ? YarnEstimate.getDefaults() : null;
      const now = Date.now();

      SchemeStore._schemes[newId] = {
        id: newId,
        name: s.name,
        cols: s.cols,
        rows: s.rows,
        cells: normalizedCells,
        activeColor: _remapThreadId(s.activeColor, threadMap, currentThreads),
        activeBlock: _remapBlockId(s.activeBlock, result.idMap.blocks),
        undo: [],
        redo: [],
        versions: versions,
        favorite: s.favorite || false,
        tags: s.tags || [],
        estimateConfig: s.estimateConfig || defaultEstimate,
        createdAt: s.createdAt || now,
        updatedAt: s.updatedAt || now
      };

      result.imported.schemes++;
    });

    try {
      localStorage.setItem("zfl31Schemes", JSON.stringify(SchemeStore._schemes));
    } catch (e) {}

    if (pkg.activeSchemeId && schemeMap[pkg.activeSchemeId]) {
      SchemeStore.setActive(schemeMap[pkg.activeSchemeId]);
    } else if (Object.keys(SchemeStore._schemes).length > 0) {
      SchemeStore.setActive(Object.keys(SchemeStore._schemes)[0]);
    }

    if (options.importExportConfig && pkg.exportConfig && ExportConfig) {
      ExportConfig.set(pkg.exportConfig);
    }

    if (options.importRiskConfig && pkg.riskConfig && RiskConfig) {
      RiskConfig.set(pkg.riskConfig);
    }

    return result;
  }

  function _importMerge(pkg, options) {
    const result = {
      success: true,
      mode: "merge",
      imported: { schemes: 0, threads: 0, blocks: 0, versions: 0, updatedSchemes: 0 },
      idMap: { schemes: {}, threads: {}, blocks: {}, versions: {} },
      skipped: { schemes: 0, blocks: 0 }
    };

    const threadConflicts = options.threadConflictResolutions || [];
    const currentThreadsSnapshot = ThreadStore.getAll();

    const threadIdMap = ThreadStore.resolveAndImportThreads(
      pkg.threads,
      ImportValidator.detectThreadConflicts(pkg.threads, currentThreadsSnapshot),
      threadConflicts
    );
    Object.assign(result.idMap.threads, threadIdMap);
    pkg.threads.forEach(function(t) {
      if (threadIdMap[t.id]) result.imported.threads++;
    });

    const currentThreads = ThreadStore.getAll();

    if (BlockStore && pkg.blocks && pkg.blocks.length > 0) {
      const blockResolutions = options.blockConflictResolutions || {};
      const currentBlocks = BlockStore.getAll();
      const currentBlockIds = {};
      currentBlocks.forEach(function(b) { currentBlockIds[b.id] = b; });

      pkg.blocks.forEach(function(b) {
        const resolution = blockResolutions[b.id] || { resolution: "skip" };
        const existing = currentBlockIds[b.id];

        if (resolution.resolution === "skip") {
          if (!existing) {
            const newBlock = BlockStore.create({
              name: b.name,
              category: b.category,
              notes: b.notes,
              cols: b.cols,
              rows: b.rows,
              pattern: b.pattern
            });
            result.idMap.blocks[b.id] = newBlock.id;
            result.imported.blocks++;
          } else {
            result.idMap.blocks[b.id] = b.id;
            result.skipped.blocks++;
          }
        } else if (resolution.resolution === "use_package") {
          if (existing) {
            BlockStore.update(b.id, {
              name: b.name,
              category: b.category,
              notes: b.notes,
              cols: b.cols,
              rows: b.rows,
              pattern: b.pattern
            });
            result.idMap.blocks[b.id] = b.id;
            result.imported.blocks++;
          } else {
            BlockStore.create({
              idOverride: b.id,
              name: b.name,
              category: b.category,
              notes: b.notes,
              cols: b.cols,
              rows: b.rows,
              pattern: b.pattern
            });
            result.idMap.blocks[b.id] = b.id;
            result.imported.blocks++;
          }
        } else if (resolution.resolution === "keep_current") {
          result.idMap.blocks[b.id] = b.id;
          result.skipped.blocks++;
        } else if (resolution.resolution === "new_copy") {
          const newName = BlockStore.nextName(b.name + " (导入)");
          const newBlock = BlockStore.create({
            name: newName,
            category: b.category,
            notes: b.notes,
            cols: b.cols,
            rows: b.rows,
            pattern: b.pattern
          });
          result.idMap.blocks[b.id] = newBlock.id;
          result.imported.blocks++;
        }
      });
    }

    const schemeResolutions = options.schemeConflictResolutions || {};

    pkg.schemes.forEach(function(s) {
      const resolution = schemeResolutions[s.id] || { resolution: "new_copy" };
      const existing = SchemeStore.getById(s.id);
      const existingByName = SchemeStore.getAll().find(function(cs) {
        return cs.id !== s.id && (cs.name || "").toLowerCase().trim() === (s.name || "").toLowerCase().trim();
      });

      let targetId;

      if (resolution.resolution === "skip") {
        if (!existing && !existingByName) {
          targetId = _createMergedScheme(s, threadIdMap, result.idMap.blocks, currentThreads, result);
        } else {
          result.idMap.schemes[s.id] = existing ? existing.id : (existingByName ? existingByName.id : null);
          result.skipped.schemes++;
          return;
        }
      } else if (resolution.resolution === "use_package") {
        if (existing) {
          targetId = existing.id;
          _updateMergedScheme(existing.id, s, threadIdMap, result.idMap.blocks, currentThreads, result);
          result.imported.updatedSchemes++;
        } else {
          targetId = _createMergedScheme(s, threadIdMap, result.idMap.blocks, currentThreads, result, s.id);
        }
      } else if (resolution.resolution === "keep_current") {
        result.idMap.schemes[s.id] = existing ? existing.id : (existingByName ? existingByName.id : null);
        result.skipped.schemes++;
        return;
      } else {
        const baseName = s.name + " (导入)";
        const uniqueName = SchemeStore.nextName(baseName);
        const sCopy = Object.assign({}, s, { name: uniqueName });
        targetId = _createMergedScheme(sCopy, threadIdMap, result.idMap.blocks, currentThreads, result);
      }

      result.idMap.schemes[s.id] = targetId;
    });

    if (options.importExportConfig && pkg.exportConfig && ExportConfig) {
      ExportConfig.set(pkg.exportConfig);
    }

    if (options.importRiskConfig && pkg.riskConfig && RiskConfig) {
      RiskConfig.set(pkg.riskConfig);
    }

    return result;
  }

  function _createMergedScheme(s, threadIdMap, blockIdMap, currentThreads, result, forceId) {
    const normalizedCells = _remapCells(s.cells, threadIdMap, currentThreads);
    const versions = (s.versions || []).map(function(v) {
      const newVersionId = v.id || uid("v");
      result.idMap.versions[v.id] = newVersionId;
      return {
        id: newVersionId,
        timestamp: v.timestamp,
        label: v.label || "",
        cells: _remapCells(v.cells, threadIdMap, currentThreads),
        cols: v.cols || s.cols,
        rows: v.rows || s.rows,
        name: v.name || s.name,
        colorStats: v.colorStats ? _remapColorStats(v.colorStats, threadIdMap) : null,
        riskRows: v.riskRows || [],
        thumbnailData: v.thumbnailData || null
      };
    });
    result.imported.versions += versions.length;

    const defaultEstimate = typeof YarnEstimate !== "undefined" ? YarnEstimate.getDefaults() : null;
    const now = Date.now();

    if (forceId) {
      SchemeStore._schemes[forceId] = {
        id: forceId,
        name: s.name,
        cols: s.cols,
        rows: s.rows,
        cells: normalizedCells,
        activeColor: _remapThreadId(s.activeColor, threadIdMap, currentThreads),
        activeBlock: _remapBlockId(s.activeBlock, blockIdMap),
        undo: [],
        redo: [],
        versions: versions,
        favorite: s.favorite || false,
        tags: s.tags || [],
        estimateConfig: s.estimateConfig || defaultEstimate,
        createdAt: s.createdAt || now,
        updatedAt: s.updatedAt || now
      };
      try { localStorage.setItem("zfl31Schemes", JSON.stringify(SchemeStore._schemes)); } catch (e) {}
      result.imported.schemes++;
      return forceId;
    } else {
      const newScheme = SchemeStore.create(s.name, s.cols, s.rows);
      SchemeStore.update(newScheme.id, {
        cells: normalizedCells,
        activeColor: _remapThreadId(s.activeColor, threadIdMap, currentThreads),
        activeBlock: _remapBlockId(s.activeBlock, blockIdMap),
        versions: versions,
        favorite: s.favorite || false,
        tags: s.tags || [],
        estimateConfig: s.estimateConfig || defaultEstimate,
        createdAt: s.createdAt || now,
        updatedAt: s.updatedAt || now
      });
      result.imported.schemes++;
      return newScheme.id;
    }
  }

  function _updateMergedScheme(schemeId, s, threadIdMap, blockIdMap, currentThreads, result) {
    const normalizedCells = _remapCells(s.cells, threadIdMap, currentThreads);

    const existing = SchemeStore.getById(schemeId);
    const existingVersionIds = {};
    (existing.versions || []).forEach(function(v) { existingVersionIds[v.id] = true; });

    const versions = (s.versions || []).map(function(v) {
      let newVersionId;
      if (v.id && existingVersionIds[v.id]) {
        newVersionId = uid("v");
      } else {
        newVersionId = v.id || uid("v");
      }
      result.idMap.versions[v.id] = newVersionId;
      return {
        id: newVersionId,
        timestamp: v.timestamp,
        label: v.label || "",
        cells: _remapCells(v.cells, threadIdMap, currentThreads),
        cols: v.cols || s.cols,
        rows: v.rows || s.rows,
        name: v.name || s.name,
        colorStats: v.colorStats ? _remapColorStats(v.colorStats, threadIdMap) : null,
        riskRows: v.riskRows || [],
        thumbnailData: v.thumbnailData || null
      };
    });
    result.imported.versions += versions.length;

    const mergedVersions = (existing.versions || []).concat(versions);
    mergedVersions.sort(function(a, b) { return a.timestamp - b.timestamp; });
    if (mergedVersions.length > 30) {
      mergedVersions.splice(0, mergedVersions.length - 30);
    }

    const defaultEstimate = typeof YarnEstimate !== "undefined" ? YarnEstimate.getDefaults() : null;

    SchemeStore.update(schemeId, {
      name: s.name,
      cols: s.cols,
      rows: s.rows,
      cells: normalizedCells,
      activeColor: _remapThreadId(s.activeColor, threadIdMap, currentThreads),
      activeBlock: _remapBlockId(s.activeBlock, blockIdMap),
      versions: mergedVersions,
      favorite: s.favorite || existing.favorite || false,
      tags: s.tags || existing.tags || [],
      estimateConfig: s.estimateConfig || existing.estimateConfig || defaultEstimate,
      updatedAt: Date.now()
    });
  }

  function _remapCells(cells, threadIdMap, currentThreads) {
    if (!Array.isArray(cells)) return [];
    const firstId = currentThreads.length > 0 ? currentThreads[0].id : null;
    return cells.map(function(c) {
      return _remapThreadId(c, threadIdMap, currentThreads) || firstId;
    });
  }

  function _remapThreadId(id, threadIdMap, currentThreads) {
    if (!id) return null;
    if (threadIdMap && threadIdMap[id]) return threadIdMap[id];
    if (currentThreads) {
      const exists = currentThreads.some(function(t) { return t.id === id; });
      if (exists) return id;
    }
    return currentThreads && currentThreads.length > 0 ? currentThreads[0].id : null;
  }

  function _remapBlockId(id, blockIdMap) {
    if (!id) return "dot";
    if (blockIdMap && blockIdMap[id]) return blockIdMap[id];
    if (BlockStore && BlockStore.getById && BlockStore.getById(id)) return id;
    return "dot";
  }

  function _remapColorStats(colorStats, threadIdMap) {
    if (!Array.isArray(colorStats)) return colorStats;
    const currentThreads = ThreadStore.getAll();
    const threadById = {};
    currentThreads.forEach(function(t) { threadById[t.id] = t; });

    return colorStats.map(function(s) {
      const newId = threadIdMap[s.id] || s.id;
      const t = threadById[newId];
      if (t) {
        return {
          id: newId,
          name: t.name || s.name,
          color: t.color || s.color,
          note: t.note != null ? t.note : s.note,
          count: s.count
        };
      }
      return Object.assign({}, s, { id: newId });
    });
  }

  return {
    PACKAGE_TYPE: PACKAGE_TYPE,
    PACKAGE_FORMAT_VERSION: PACKAGE_FORMAT_VERSION,
    exportProjectPackage: exportProjectPackage,
    buildExportPackage: buildExportPackage,
    parseAndValidatePackage: parseAndValidatePackage,
    detectConflicts: detectConflicts,
    buildSummary: buildSummary,
    importPackage: importPackage
  };
})();
