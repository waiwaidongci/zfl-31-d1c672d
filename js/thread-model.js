const ThreadModel = (function() {

  const DEFAULT_COLORS = [
    "#f7e7c4",
    "#a6322d",
    "#1f5f78",
    "#d6a437",
    "#355b38",
    "#713d7b",
    "#1e1b18",
    "#e98c52"
  ];

  function uid() {
    return "t_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function createThread(options = {}) {
    var defaultLoss = {
      lossFactor: typeof options.lossFactor === "number" ? options.lossFactor : 1.15,
      safetyMargin: typeof options.safetyMargin === "number" ? options.safetyMargin : 10
    };
    return {
      id: options.id || uid(),
      name: options.name || "未命名色线",
      color: options.color || "#cccccc",
      note: options.note || "",
      order: typeof options.order === "number" ? options.order : 0,
      lossConfig: options.lossConfig || defaultLoss
    };
  }

  function createDefaultThreads() {
    return DEFAULT_COLORS.map((color, i) =>
      createThread({
        id: "default_" + i,
        name: "色线" + i,
        color: color,
        note: i === 0 ? "底色/空白" : "",
        order: i
      })
    );
  }

  function getColorById(threads, id) {
    const thread = threads.find(t => t.id === id);
    return thread ? thread.color : "#cccccc";
  }

  function getThreadById(threads, id) {
    return threads.find(t => t.id === id) || null;
  }

  function getThreadIndexById(threads, id) {
    return threads.findIndex(t => t.id === id);
  }

  function sortByOrder(threads) {
    return [...threads].sort((a, b) => a.order - b.order);
  }

  function reorderThreads(threads, fromIndex, toIndex) {
    const sorted = sortByOrder(threads);
    const [moved] = sorted.splice(fromIndex, 1);
    sorted.splice(toIndex, 0, moved);
    return sorted.map((t, i) => ({ ...t, order: i }));
  }

  function validateThread(thread) {
    const errors = [];
    if (!thread || typeof thread !== "object") {
      errors.push("色线数据格式错误");
      return errors;
    }
    if (!thread.id || typeof thread.id !== "string") {
      errors.push("色线ID无效");
    }
    if (!thread.name || typeof thread.name !== "string" || thread.name.trim() === "") {
      errors.push("色线名称不能为空");
    }
    if (!thread.color || typeof thread.color !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(thread.color)) {
      errors.push("色线颜色格式无效");
    }
    if (typeof thread.order !== "number") {
      errors.push("色线排序值无效");
    }
    return errors;
  }

  function isThreadUsed(cells, threadId) {
    return cells.some(cellId => cellId === threadId);
  }

  function replaceThreadInCells(cells, oldId, newId) {
    return cells.map(cellId => cellId === oldId ? newId : cellId);
  }

  function computeColorStats(cells, threads) {
    const sorted = sortByOrder(threads);
    return sorted.map(thread => ({
      id: thread.id,
      name: thread.name,
      color: thread.color,
      note: thread.note,
      count: cells.filter(v => v === thread.id).length
    }));
  }

  function migrateIndexToId(oldCells, threads) {
    const sorted = sortByOrder(threads);
    return oldCells.map(idx => {
      if (typeof idx === "string") return idx;
      if (typeof idx === "number" && idx >= 0 && idx < sorted.length) {
        return sorted[idx].id;
      }
      return sorted[0] ? sorted[0].id : null;
    });
  }

  return {
    DEFAULT_COLORS,
    createThread,
    createDefaultThreads,
    getColorById,
    getThreadById,
    getThreadIndexById,
    sortByOrder,
    reorderThreads,
    validateThread,
    isThreadUsed,
    replaceThreadInCells,
    computeColorStats,
    migrateIndexToId
  };
})();
