const ProcessCalc = (function() {

  function countShortSegmentRuns(segments, maxShortLength) {
    var count = 0;
    var inShortRun = false;
    for (var i = 0; i < segments.length; i++) {
      if (segments[i].length <= maxShortLength) {
        if (!inShortRun) {
          inShortRun = true;
        }
        count++;
      } else {
        inShortRun = false;
      }
    }
    return count;
  }

  function computeRowSteps(cells, cols, rowIndex) {
    var start = rowIndex * cols;
    var segments = [];
    var currentColor = cells[start];
    var currentLength = 1;

    for (var x = 1; x < cols; x++) {
      var c = cells[start + x];
      if (c === currentColor) {
        currentLength++;
      } else {
        segments.push({ threadId: currentColor, length: currentLength });
        currentColor = c;
        currentLength = 1;
      }
    }
    segments.push({ threadId: currentColor, length: currentLength });

    var switches = 0;
    for (var i = 1; i < segments.length; i++) {
      if (segments[i].threadId !== segments[i - 1].threadId) {
        switches++;
      }
    }

    var riskConfig = typeof RiskConfig !== 'undefined'
      ? RiskConfig.getAll()
      : { highRiskThreshold: 0.62, mediumRiskThreshold: 0.35, countShortSegments: false, shortSegmentMaxLength: 2 };

    var effectiveSwitches = switches;
    var shortSegmentCount = 0;

    if (riskConfig.countShortSegments) {
      shortSegmentCount = countShortSegmentRuns(segments, riskConfig.shortSegmentMaxLength);
      effectiveSwitches += shortSegmentCount;
    }

    var riskLevel = "none";
    var riskNote = "";
    if (switches === 0) {
      riskLevel = "none";
      riskNote = "整纬同色，无需换色";
    } else if (effectiveSwitches > cols * riskConfig.highRiskThreshold) {
      riskLevel = "high";
      riskNote = shortSegmentCount > 0
        ? "换色过密（含" + shortSegmentCount + "个短色段），断线风险高"
        : "换色过密，断线风险高";
    } else if (effectiveSwitches > cols * riskConfig.mediumRiskThreshold) {
      riskLevel = "medium";
      riskNote = shortSegmentCount > 0
        ? "换色较频繁（含" + shortSegmentCount + "个短色段），注意张力"
        : "换色较频繁，注意张力";
    } else {
      riskLevel = "low";
      riskNote = shortSegmentCount > 0
        ? "换色适度（含" + shortSegmentCount + "个短色段），风险较低"
        : "换色适度，风险较低";
    }

    return {
      row: rowIndex + 1,
      segments: segments,
      switchCount: switches,
      shortSegmentCount: shortSegmentCount,
      effectiveSwitchCount: effectiveSwitches,
      riskLevel: riskLevel,
      riskNote: riskNote
    };
  }

  function computeAllSteps(cells, cols, rows) {
    var steps = [];
    for (var y = 0; y < rows; y++) {
      steps.push(computeRowSteps(cells, cols, y));
    }
    return steps;
  }

  function computeSummary(steps) {
    var totalSwitches = 0;
    var totalEffectiveSwitches = 0;
    var totalShortSegments = 0;
    var highRiskRows = [];
    var mediumRiskRows = [];
    var colorUsage = {};

    for (var i = 0; i < steps.length; i++) {
      var step = steps[i];
      totalSwitches += step.switchCount;
      totalEffectiveSwitches += step.effectiveSwitchCount;
      totalShortSegments += step.shortSegmentCount;
      if (step.riskLevel === "high") {
        highRiskRows.push(step.row);
      } else if (step.riskLevel === "medium") {
        mediumRiskRows.push(step.row);
      }
      for (var j = 0; j < step.segments.length; j++) {
        var seg = step.segments[j];
        if (!colorUsage[seg.threadId]) {
          colorUsage[seg.threadId] = { totalLength: 0, segmentCount: 0 };
        }
        colorUsage[seg.threadId].totalLength += seg.length;
        colorUsage[seg.threadId].segmentCount++;
      }
    }

    return {
      totalSwitches: totalSwitches,
      totalEffectiveSwitches: totalEffectiveSwitches,
      totalShortSegments: totalShortSegments,
      highRiskRows: highRiskRows,
      mediumRiskRows: mediumRiskRows,
      colorUsage: colorUsage
    };
  }

  function buildExportData(scheme, threads) {
    var cells = scheme.cells;
    var cols = scheme.cols;
    var rows = scheme.rows;
    var steps = computeAllSteps(cells, cols, rows);
    var summary = computeSummary(steps);

    var threadMap = {};
    if (threads && Array.isArray(threads)) {
      threads.forEach(function(t) { threadMap[t.id] = t; });
    }

    var colorSummary = [];
    var keys = Object.keys(summary.colorUsage);
    for (var k = 0; k < keys.length; k++) {
      var tid = keys[k];
      var threadInfo = threadMap[tid] || {};
      colorSummary.push({
        threadId: tid,
        name: threadInfo.name || "未知色线",
        color: threadInfo.color || "#000000",
        note: threadInfo.note || "",
        totalLength: summary.colorUsage[tid].totalLength,
        segmentCount: summary.colorUsage[tid].segmentCount
      });
    }

    var riskConfig = typeof RiskConfig !== 'undefined' ? RiskConfig.getAll() : null;

    return {
      name: scheme.name,
      cols: cols,
      rows: rows,
      riskConfig: riskConfig,
      steps: steps.map(function(s) {
        return {
          row: s.row,
          segments: s.segments,
          switchCount: s.switchCount,
          shortSegmentCount: s.shortSegmentCount,
          effectiveSwitchCount: s.effectiveSwitchCount,
          riskLevel: s.riskLevel,
          riskNote: s.riskNote
        };
      }),
      threads: threads || [],
      summary: {
        totalSwitches: summary.totalSwitches,
        totalEffectiveSwitches: summary.totalEffectiveSwitches,
        totalShortSegments: summary.totalShortSegments,
        highRiskRows: summary.highRiskRows,
        mediumRiskRows: summary.mediumRiskRows,
        colorSummary: colorSummary
      }
    };
  }

  return {
    computeRowSteps: computeRowSteps,
    computeAllSteps: computeAllSteps,
    computeSummary: computeSummary,
    buildExportData: buildExportData
  };
})();
