const ImportParser = (function() {

  function parseFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new ImportError("未选择文件", "no_file"));
        return;
      }

      if (!file.name.toLowerCase().endsWith(".json")) {
        reject(new ImportError("文件格式不正确，请选择 .json 文件", "invalid_format"));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const raw = JSON.parse(e.target.result);
          const parsed = parseObject(raw, file.name);
          resolve(parsed);
        } catch (err) {
          if (err instanceof ImportError) {
            reject(err);
          } else if (err instanceof SyntaxError) {
            reject(new ImportError("JSON 解析失败：文件内容不是有效的 JSON 格式", "parse_error"));
          } else {
            reject(new ImportError("读取文件时发生未知错误", "unknown_error"));
          }
        }
      };
      reader.onerror = () => {
        reject(new ImportError("文件读取失败", "read_error"));
      };
      reader.readAsText(file);
    });
  }

  function parseObject(raw, fileName) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new ImportError("文件内容格式不正确：应为对象", "invalid_structure");
    }

    const name = typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim()
      : fileName ? fileName.replace(/\.json$/i, "") : "导入方案";

    const cols = typeof raw.cols === "number" ? raw.cols : null;
    const rows = typeof raw.rows === "number" ? raw.rows : null;
    const cells = Array.isArray(raw.cells) ? raw.cells : null;

    const usage = Array.isArray(raw.usage)
      ? raw.usage.filter(u => u && typeof u === "object")
      : null;

    const threads = Array.isArray(raw.threads)
      ? raw.threads.filter(t => t && typeof t === "object")
      : null;

    const versions = Array.isArray(raw.versions)
      ? raw.versions.filter(v => v && typeof v === "object")
      : null;

    return {
      name,
      cols,
      rows,
      cells,
      usage,
      threads,
      versions,
      raw
    };
  }

  function computeColorStats(cells, threads) {
    if (!Array.isArray(cells) || !Array.isArray(threads)) {
      return [];
    }
    return threads.map(thread => ({
      id: thread.id,
      name: thread.name || "未命名",
      color: thread.color || "#cccccc",
      note: thread.note || "",
      count: cells.filter(v => v === thread.id).length
    }));
  }

  function buildPreviewData(cells, cols, rows) {
    if (!Array.isArray(cells) || typeof cols !== "number" || typeof rows !== "number") {
      return null;
    }
    const total = cols * rows;
    if (cells.length !== total) {
      return null;
    }
    return { cells, cols, rows };
  }

  class ImportError extends Error {
    constructor(message, code) {
      super(message);
      this.name = "ImportError";
      this.code = code;
    }
  }

  return {
    parseFile,
    parseObject,
    computeColorStats,
    buildPreviewData,
    ImportError
  };
})();
