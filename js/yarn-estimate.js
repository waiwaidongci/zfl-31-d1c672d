const YarnEstimate = (function() {

  const DEFAULTS = {
    cellSizeMm: 2.0,
    warpDensity: 5.0,
    weftDensity: 5.0,
    defaultLossFactor: 1.15,
    defaultSafetyMargin: 10
  };

  function getDefaults() {
    return { ...DEFAULTS };
  }

  function ensureSchemeEstimateConfig(scheme) {
    if (!scheme) return { ...DEFAULTS };
    const cfg = scheme.estimateConfig || {};
    return {
      cellSizeMm: typeof cfg.cellSizeMm === "number" ? cfg.cellSizeMm : DEFAULTS.cellSizeMm,
      warpDensity: typeof cfg.warpDensity === "number" ? cfg.warpDensity : DEFAULTS.warpDensity,
      weftDensity: typeof cfg.weftDensity === "number" ? cfg.weftDensity : DEFAULTS.weftDensity,
      defaultLossFactor: typeof cfg.defaultLossFactor === "number" ? cfg.defaultLossFactor : DEFAULTS.defaultLossFactor,
      defaultSafetyMargin: typeof cfg.defaultSafetyMargin === "number" ? cfg.defaultSafetyMargin : DEFAULTS.defaultSafetyMargin
    };
  }

  function ensureThreadLossConfig(thread, schemeConfig) {
    if (!thread) {
      return {
        lossFactor: schemeConfig.defaultLossFactor,
        safetyMargin: schemeConfig.defaultSafetyMargin
      };
    }
    const cfg = thread.lossConfig || {};
    return {
      lossFactor: typeof cfg.lossFactor === "number" ? cfg.lossFactor : schemeConfig.defaultLossFactor,
      safetyMargin: typeof cfg.safetyMargin === "number" ? cfg.safetyMargin : schemeConfig.defaultSafetyMargin
    };
  }

  function computeWarpLengthCm(cols, warpDensity, cellSizeMm) {
    if (warpDensity && warpDensity > 0) {
      return cols / warpDensity;
    }
    return cols * (cellSizeMm || 2.0) / 10;
  }

  function computeWeftLengthCm(rows, weftDensity, cellSizeMm) {
    if (weftDensity && weftDensity > 0) {
      return rows / weftDensity;
    }
    return rows * (cellSizeMm || 2.0) / 10;
  }

  function buildThreadLossMap(threads, schemeConfig) {
    const map = {};
    (threads || []).forEach(t => {
      map[t.id] = ensureThreadLossConfig(t, schemeConfig);
    });
    return map;
  }

  function computePerThreadEstimate(options) {
    const {
      cells,
      cols,
      rows,
      threads,
      steps,
      summary
    } = options;

    const schemeConfig = ensureSchemeEstimateConfig(options.scheme || {});
    const threadLossMap = buildThreadLossMap(threads, schemeConfig);

    let allSteps = steps;
    let allSummary = summary;
    if (!allSteps || !allSummary) {
      allSteps = ProcessCalc.computeAllSteps(cells, cols, rows);
      allSummary = ProcessCalc.computeSummary(allSteps);
    }

    const warpLenCm = computeWarpLengthCm(cols, schemeConfig.warpDensity, schemeConfig.cellSizeMm);
    const weftLenCm = computeWeftLengthCm(rows, schemeConfig.weftDensity, schemeConfig.cellSizeMm);

    const colorStats = ThreadModel.computeColorStats(cells, threads);
    const sortedThreads = ThreadModel.sortByOrder(threads);

    const estimates = sortedThreads.map(thread => {
      const stat = colorStats.find(s => s.id === thread.id) || { count: 0 };
      const usage = allSummary.colorUsage[thread.id] || { totalLength: 0, segmentCount: 0 };
      const lossCfg = threadLossMap[thread.id] || ensureThreadLossConfig(thread, schemeConfig);

      const warpCellCount = cols > 0 ? Math.ceil(stat.count / rows) : 0;
      const weftCellCount = usage.totalLength;

      const warpBaseCm = warpCellCount * warpLenCm;
      const weftBaseCm = weftCellCount * weftLenCm;
      const baseTotalCm = warpBaseCm + weftBaseCm;

      const withLossCm = baseTotalCm * lossCfg.lossFactor;
      const safetyFactor = 1 + (lossCfg.safetyMargin / 100);
      const withSafetyCm = withLossCm * safetyFactor;

      return {
        id: thread.id,
        name: thread.name,
        color: thread.color,
        note: thread.note || "",
        cellCount: stat.count,
        segmentCount: usage.segmentCount,
        warpCellCount,
        weftCellCount,
        warpBaseCm: +warpBaseCm.toFixed(2),
        weftBaseCm: +weftBaseCm.toFixed(2),
        baseTotalCm: +baseTotalCm.toFixed(2),
        lossFactor: lossCfg.lossFactor,
        safetyMargin: lossCfg.safetyMargin,
        withLossCm: +withLossCm.toFixed(2),
        withSafetyCm: +withSafetyCm.toFixed(2),
        recommendedCm: +withSafetyCm.toFixed(2),
        recommendedMeters: +(withSafetyCm / 100).toFixed(2)
      };
    }).filter(e => e.cellCount > 0);

    const totals = estimates.reduce((acc, e) => {
      acc.cellCount += e.cellCount;
      acc.baseTotalCm += e.baseTotalCm;
      acc.withLossCm += e.withLossCm;
      acc.withSafetyCm += e.withSafetyCm;
      return acc;
    }, { cellCount: 0, baseTotalCm: 0, withLossCm: 0, withSafetyCm: 0 });

    return {
      schemeConfig,
      warpLengthCm: +warpLenCm.toFixed(2),
      weftLengthCm: +weftLenCm.toFixed(2),
      estimates,
      totals: {
        cellCount: totals.cellCount,
        baseTotalCm: +totals.baseTotalCm.toFixed(2),
        withLossCm: +totals.withLossCm.toFixed(2),
        withSafetyCm: +totals.withSafetyCm.toFixed(2),
        baseTotalMeters: +(totals.baseTotalCm / 100).toFixed(2),
        withLossMeters: +(totals.withLossCm / 100).toFixed(2),
        withSafetyMeters: +(totals.withSafetyCm / 100).toFixed(2),
        recommendedMeters: +(totals.withSafetyCm / 100).toFixed(2)
      }
    };
  }

  function formatLength(cm) {
    if (cm == null || isNaN(cm)) return "-";
    if (cm >= 100) {
      const m = cm / 100;
      return m.toFixed(2) + " m";
    }
    return cm.toFixed(1) + " cm";
  }

  return {
    DEFAULTS,
    getDefaults,
    ensureSchemeEstimateConfig,
    ensureThreadLossConfig,
    computeWarpLengthCm,
    computeWeftLengthCm,
    computePerThreadEstimate,
    formatLength
  };
})();
