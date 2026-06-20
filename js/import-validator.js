const ImportValidator = (function() {

  const VALIDATION_ERROR = "error";
  const VALIDATION_WARNING = "warning";
  const VALIDATION_INFO = "info";

  function validate(parsedData, options = {}) {
    const results = [];
    const { currentScheme, colorPalette, schemeStore } = options;

    results.push(...validateRequiredFields(parsedData));

    if (parsedData.cols !== null && parsedData.rows !== null && parsedData.cells !== null) {
      results.push(...validateDimensions(parsedData));
      results.push(...validateCellValues(parsedData, colorPalette));
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

  function validateCellValues(parsedData, colorPalette) {
    const results = [];
    const { cells } = parsedData;

    if (!cells || cells.length === 0) return results;

    const maxColorIndex = cells.reduce((max, v) => {
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0) return max;
      return Math.max(max, v);
    }, 0);

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

    if (colorPalette && Array.isArray(colorPalette)) {
      const paletteSize = colorPalette.length;
      if (maxColorIndex >= paletteSize) {
        results.push({
          type: VALIDATION_WARNING,
          code: "color_index_out_of_range",
          message: `文件中使用了色线 ${maxColorIndex + 1}，超出当前色线库（${paletteSize} 色），导入后将以底色显示`,
          field: "cells",
          detail: { maxColorIndex, paletteSize }
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
