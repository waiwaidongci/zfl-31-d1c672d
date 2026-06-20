const ImportValidator = (function() {

  const VALIDATION_ERROR = "error";
  const VALIDATION_WARNING = "warning";
  const VALIDATION_INFO = "info";

  function validate(parsedData, options = {}) {
    const results = [];
    const { currentScheme, threads, schemeStore } = options;

    results.push(...validateRequiredFields(parsedData));

    if (parsedData.cols !== null && parsedData.rows !== null && parsedData.cells !== null) {
      results.push(...validateDimensions(parsedData));
      results.push(...validateCellValues(parsedData, threads));
    }

    if (parsedData.threads) {
      results.push(...validateThreads(parsedData.threads));
    }

    if (currentScheme) {
      results.push(...compareWithCurrentScheme(parsedData, currentScheme));
    }

    if (schemeStore) {
      results.push(...checkDuplicateName(parsedData, schemeStore, options));
    }

    const errors = results.filter(r => r.type === VALIDATION_ERROR);
    const warnings = results.filter(r => r.type === VALIDATION_WARNING);
    const infos = results.filter(r => r.type === VALIDATION_INFO);

    return {
      valid: errors.length === 0,
      canImport: errors.length === 0,
      canOverwrite: errors.length === 0 && parsedData.cols !== null && parsedData.rows !== null,
      errors,
      warnings,
      infos,
      all: results
    };
  }

  function validateThreads(threads) {
    const results = [];
    if (!Array.isArray(threads) || threads.length === 0) {
      results.push({
        type: VALIDATION_WARNING,
        code: "no_threads_data",
        message: "文件中不包含色线元数据，将使用当前色线库",
        field: "threads"
      });
      return results;
    }

    const ids = new Set();
    let hasInvalid = false;

    threads.forEach((t, i) => {
      if (!t || typeof t !== "object") {
        hasInvalid = true;
        return;
      }
      if (typeof t.id !== "string" || !t.id) {
        hasInvalid = true;
        return;
      }
      if (ids.has(t.id)) {
        results.push({
          type: VALIDATION_WARNING,
          code: "duplicate_thread_id",
          message: `色线 ID 重复：${t.id}`,
          field: "threads"
        });
      }
      ids.add(t.id);
    });

    if (hasInvalid) {
      results.push({
        type: VALIDATION_WARNING,
        code: "invalid_threads_data",
        message: "部分色线数据格式无效，已忽略",
        field: "threads"
      });
    }

    if (threads.length > 0) {
      results.push({
        type: VALIDATION_INFO,
        code: "has_threads_data",
        message: `文件包含 ${threads.length} 种色线的元数据`,
        field: "threads"
      });
    }

    return results;
  }

  function validateRequiredFields(parsedData) {
    const results = [];

    if (parsedData.cols === null) {
      results.push({
        type: VALIDATION_ERROR,
        code: "missing_cols",
        message: '缺少 "cols" 字段（经向列数）',
        field: "cols"
      });
    } else if (parsedData.cols <= 0 || !Number.isInteger(parsedData.cols)) {
      results.push({
        type: VALIDATION_ERROR,
        code: "invalid_cols",
        message: "经向列数必须是正整数",
        field: "cols"
      });
    }

    if (parsedData.rows === null) {
      results.push({
        type: VALIDATION_ERROR,
        code: "missing_rows",
        message: '缺少 "rows" 字段（纬向行数）',
        field: "rows"
      });
    } else if (parsedData.rows <= 0 || !Number.isInteger(parsedData.rows)) {
      results.push({
        type: VALIDATION_ERROR,
        code: "invalid_rows",
        message: "纬向行数必须是正整数",
        field: "rows"
      });
    }

    if (parsedData.cells === null) {
      results.push({
        type: VALIDATION_ERROR,
        code: "missing_cells",
        message: '缺少 "cells" 字段（纹样网格数据）',
        field: "cells"
      });
    }

    return results;
  }

  function validateDimensions(parsedData) {
    const results = [];
    const { cols, rows, cells } = parsedData;
    const expected = cols * rows;

    if (cells.length !== expected) {
      results.push({
        type: VALIDATION_ERROR,
        code: "dimension_mismatch",
        message: `网格数据长度（${cells.length}）与尺寸（${cols}×${rows}=${expected}）不匹配`,
        field: "cells"
      });
    }

    return results;
  }

  function validateCellValues(parsedData, threads) {
    const results = [];
    const { cells } = parsedData;

    if (!cells || cells.length === 0) return results;

    const hasLegacyFormat = cells.some(v => typeof v === "number");
    const hasNewFormat = cells.some(v => typeof v === "string");

    if (hasLegacyFormat && hasNewFormat) {
      results.push({
        type: VALIDATION_ERROR,
        code: "mixed_cell_formats",
        message: "网格数据格式混乱，同时包含数字和字符串 ID",
        field: "cells"
      });
      return results;
    }

    if (hasLegacyFormat) {
      const hasInvalidValues = cells.some(v =>
        typeof v !== "number" || !Number.isInteger(v) || v < 0
      );

      if (hasInvalidValues) {
        results.push({
          type: VALIDATION_ERROR,
          code: "invalid_cell_values",
          message: "网格数据包含非数字或负数",
          field: "cells"
        });
      }

      const maxColorIndex = cells.reduce((max, v) => {
        if (typeof v !== "number" || !Number.isInteger(v) || v < 0) return max;
        return Math.max(max, v);
      }, 0);

      if (threads && Array.isArray(threads)) {
        const threadCount = threads.length;
        if (maxColorIndex >= threadCount) {
          results.push({
            type: VALIDATION_WARNING,
            code: "color_index_out_of_range",
            message: `文件中使用了色线索引 ${maxColorIndex}，超出文件色线数（${threadCount} 色），导入后将以底色显示`,
            field: "cells",
            detail: { maxColorIndex, threadCount }
          });
        }
      }
    }

    if (hasNewFormat && threads && Array.isArray(threads)) {
      const threadIds = new Set(threads.map(t => t.id));
      const unknownIds = new Set();
      cells.forEach(v => {
        if (typeof v === "string" && !threadIds.has(v)) {
          unknownIds.add(v);
        }
      });

      if (unknownIds.size > 0) {
        results.push({
          type: VALIDATION_WARNING,
          code: "unknown_thread_ids",
          message: `文件中有 ${unknownIds.size} 个色线 ID 未在色线元数据中定义，导入后将以底色显示`,
          field: "cells"
        });
      }
    }

    return results;
  }

  function compareWithCurrentScheme(parsedData, currentScheme) {
    const results = [];
    if (!currentScheme) return results;

    const sizeMatch = parsedData.cols === currentScheme.cols && parsedData.rows === currentScheme.rows;

    if (!sizeMatch && parsedData.cols !== null && parsedData.rows !== null) {
      results.push({
        type: VALIDATION_WARNING,
        code: "size_differs_from_current",
        message: `文件尺寸（${parsedData.cols}×${parsedData.rows}）与当前方案（${currentScheme.cols}×${currentScheme.rows}）不一致`,
        field: "size",
        detail: {
          fileSize: { cols: parsedData.cols, rows: parsedData.rows },
          currentSize: { cols: currentScheme.cols, rows: currentScheme.rows }
        }
      });
    }

    return results;
  }

  function checkDuplicateName(parsedData, schemeStore, options = {}) {
    const results = [];
    if (!schemeStore || typeof schemeStore.getAll !== "function") return results;

    const allSchemes = schemeStore.getAll();
    const activeId = typeof schemeStore.getActiveId === "function"
      ? schemeStore.getActiveId()
      : null;

    const duplicateWithOthers = allSchemes.find(s =>
      s.id !== activeId && s.name === parsedData.name
    );
    const duplicateWithActive = activeId && allSchemes.find(s =>
      s.id === activeId && s.name === parsedData.name
    );

    if (duplicateWithOthers) {
      results.push({
        type: VALIDATION_WARNING,
        code: "duplicate_name_others",
        message: `已有名为"${parsedData.name}"的其他方案，导入时将自动重命名为不重复的名称`,
        field: "name",
        detail: { existingId: duplicateWithOthers.id, scope: "others" }
      });
    }

    if (duplicateWithActive) {
      results.push({
        type: VALIDATION_INFO,
        code: "duplicate_name_active",
        message: `方案名"${parsedData.name}"与当前方案相同，覆盖模式下将保留当前方案 ID 并更新内容`,
        field: "name",
        detail: { scope: "active" }
      });
    }

    return results;
  }

  function formatMessages(validationResult) {
    const errors = validationResult.errors.map(e => e.message);
    const warnings = validationResult.warnings.map(w => w.message);
    const infos = validationResult.infos.map(i => i.message);
    return { errors, warnings, infos };
  }

  return {
    validate,
    formatMessages,
    VALIDATION_ERROR,
    VALIDATION_WARNING,
    VALIDATION_INFO
  };
})();
