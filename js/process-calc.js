const ProcessCalc = (function() {

  var RISK_RATIO = 0.62;

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
        segments.push({ colorIndex: currentColor, length: currentLength });
        currentColor = c;
        currentLength = 1;
      }
    }
    segments.push({ colorIndex: currentColor, length: currentLength });

    var switches = 0;
    for (var i = 1; i < segments.length; i++) {
      if (segments[i].colorIndex !== segments[i - 1].colorIndex) {
        switches++;
      }
    }

    var riskLevel = "none";
    var riskNote = "";
    if (switches === 0) {
      riskLevel = "none";
      riskNote = "整纬同色，无需换色";
    } else if (switches > cols * RISK_RATIO) {
      riskLevel = "high";
      riskNote = "换色过密，断线风险高";
    } else if (switches > cols * 0.35) {
      riskLevel = "medium";
      riskNote = "换色较频繁，注意张力";
    } else {
      riskLevel = "low";
      riskNote = "换色适度，风险较低";
    }

    return {
      row: rowIndex + 1,
      segments: segments,
      switchCount: switches,
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
    var highRiskRows = [];
    var mediumRiskRows = [];
    var colorUsage = {};

    for (var i = 0; i < steps.length; i++) {
      var step = steps[i];
      totalSwitches += step.switchCount;
      if (step.riskLevel === "high") {
        highRiskRows.push(step.row);
      } else if (step.riskLevel === "medium") {
        mediumRiskRows.push(step.row);
      }
      for (var j = 0; j < step.segments.length; j++) {
        var seg = step.segments[j];
        if (!colorUsage[seg.colorIndex]) {
          colorUsage[seg.colorIndex] = { totalLength: 0, segmentCount: 0 };
        }
        colorUsage[seg.colorIndex].totalLength += seg.length;
        colorUsage[seg.colorIndex].segmentCount++;
      }
    }

    return {
      totalSwitches: totalSwitches,
      highRiskRows: highRiskRows,
      mediumRiskRows: mediumRiskRows,
      colorUsage: colorUsage
    };
  }

  function buildExportData(scheme, colorPalette) {
    var cells = scheme.cells;
    var cols = scheme.cols;
    var rows = scheme.rows;
    var steps = computeAllSteps(cells, cols, rows);
    var summary = computeSummary(steps);

    var colorSummary = [];
    var keys = Object.keys(summary.colorUsage);
    for (var k = 0; k < keys.length; k++) {
      var ci = Number(keys[k]);
      colorSummary.push({
        colorIndex: ci,
        color: colorPalette[ci] || "#000000",
        totalLength: summary.colorUsage[ci].totalLength,
        segmentCount: summary.colorUsage[ci].segmentCount
      });
    }
    colorSummary.sort(function(a, b) { return a.colorIndex - b.colorIndex; });

    return {
      name: scheme.name,
      cols: cols,
      rows: rows,
      steps: steps.map(function(s) {
        return {
          row: s.row,
          segments: s.segments,
          switchCount: s.switchCount,
          riskLevel: s.riskLevel,
          riskNote: s.riskNote
        };
      }),
      summary: {
        totalSwitches: summary.totalSwitches,
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
