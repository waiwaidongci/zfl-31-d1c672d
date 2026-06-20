const ProcessView = (function() {

  var currentView = "canvas";
  var containerEl = null;
  var processEl = null;
  var gridEl = null;
  var toggleBtn = null;
  var exportBtn = null;

  function init(options) {
    containerEl = options.container || null;
    gridEl = options.gridEl || document.querySelector("#grid");
    processEl = document.createElement("div");
    processEl.className = "process-view";
    processEl.style.display = "none";

    toggleBtn = document.querySelector("#viewToggleBtn");
    exportBtn = document.querySelector("#exportProcessBtn");

    if (toggleBtn) {
      toggleBtn.addEventListener("click", toggleView);
    }
    if (exportBtn) {
      exportBtn.addEventListener("click", exportProcessJSON);
    }
  }

  function toggleView() {
    if (currentView === "canvas") {
      switchToProcess();
    } else {
      switchToCanvas();
    }
  }

  function switchToProcess() {
    currentView = "process";
    if (toggleBtn) {
      toggleBtn.textContent = "返回画布视图";
    }
    if (exportBtn) {
      exportBtn.style.display = "";
    }

    var scheme = SchemeStore.getActive();
    if (!scheme) return;

    var steps = ProcessCalc.computeAllSteps(scheme.cells, scheme.cols, scheme.rows);
    var summary = ProcessCalc.computeSummary(steps);

    renderProcessView(steps, summary, scheme);

    if (gridEl) {
      gridEl.style.display = "none";
    }
    var parentSection = gridEl ? gridEl.closest("section") : null;
    if (parentSection) {
      if (!parentSection.contains(processEl)) {
        parentSection.appendChild(processEl);
      }
      processEl.style.display = "";
    }
  }

  function switchToCanvas() {
    currentView = "canvas";
    if (toggleBtn) {
      toggleBtn.textContent = "织造工序视图";
    }
    if (exportBtn) {
      exportBtn.style.display = "none";
    }
    if (gridEl) {
      gridEl.style.display = "";
    }
    processEl.style.display = "none";
  }

  function refresh() {
    if (currentView !== "process") return;
    var scheme = SchemeStore.getActive();
    if (!scheme) return;
    var steps = ProcessCalc.computeAllSteps(scheme.cells, scheme.cols, scheme.rows);
    var summary = ProcessCalc.computeSummary(steps);
    renderProcessView(steps, summary, scheme);
  }

  function renderProcessView(steps, summary, scheme) {
    var html = "";
    var threads = ThreadStore.getAll();

    html += '<div class="process-header">';
    html += '<h3>织造工序步骤</h3>';
    html += '<div class="process-summary-badges">';
    html += '<span class="process-badge">' + scheme.rows + ' 纬</span>';
    html += '<span class="process-badge">' + summary.totalSwitches + ' 次换色</span>';
    if (summary.highRiskRows.length > 0) {
      html += '<span class="process-badge badge-danger">' + summary.highRiskRows.length + ' 行高风险</span>';
    }
    if (summary.mediumRiskRows.length > 0) {
      html += '<span class="process-badge badge-warning">' + summary.mediumRiskRows.length + ' 行中风险</span>';
    }
    html += '</div>';
    html += '</div>';

    html += '<div class="process-steps">';
    for (var i = 0; i < steps.length; i++) {
      html += renderStep(steps[i]);
    }
    html += '</div>';

    html += renderProcessYarnEstimate(scheme, threads, steps, summary);

    processEl.innerHTML = html;
  }

  function renderProcessYarnEstimate(scheme, threads, steps, summary) {
    if (typeof YarnEstimate === "undefined") return "";

    var estimate = YarnEstimate.computePerThreadEstimate({
      cells: scheme.cells,
      cols: scheme.cols,
      rows: scheme.rows,
      threads: threads,
      scheme: scheme,
      steps: steps,
      summary: summary
    });

    var html = '<div class="process-yarn-estimate">';
    html += '<h4>色线用量估算</h4>';
    html += '<div class="process-summary-badges" style="margin-bottom: 10px;">';
    html += '<span class="process-badge">单格 ' + estimate.schemeConfig.cellSizeMm + ' mm</span>';
    html += '<span class="process-badge">经向 ' + YarnEstimate.formatLength(estimate.warpLengthCm) + '</span>';
    html += '<span class="process-badge">纬向 ' + YarnEstimate.formatLength(estimate.weftLengthCm) + '</span>';
    html += '<span class="process-badge badge-danger">建议备料 ' + estimate.totals.recommendedMeters + ' m</span>';
    html += '</div>';

    if (estimate.estimates.length > 0) {
      html += '<div class="yarn-estimate-list">';
      estimate.estimates.forEach(function(e) {
        html += '<div class="yarn-estimate-item-row">' +
          '<div class="yarn-estimate-item-head">' +
            '<span class="yarn-estimate-color-swatch" style="background:' + e.color + '"></span>' +
            '<span class="yarn-estimate-item-name">' + escapeHtml(e.name) + '</span>' +
            '<span class="yarn-estimate-item-count">' + e.cellCount + ' 格</span>' +
          '</div>' +
          '<div class="yarn-estimate-item-details">' +
            '<div class="yarn-estimate-detail"><span class="detail-label">基础用量</span><span class="detail-value">' + YarnEstimate.formatLength(e.baseTotalCm) + '</span></div>' +
            '<div class="yarn-estimate-detail"><span class="detail-label">损耗×' + e.lossFactor.toFixed(2) + '</span><span class="detail-value">' + YarnEstimate.formatLength(e.withLossCm) + '</span></div>' +
            '<div class="yarn-estimate-detail"><span class="detail-label">安全余量 ' + e.safetyMargin + '%</span><span class="detail-value">' + YarnEstimate.formatLength(e.withSafetyCm) + '</span></div>' +
            '<div class="yarn-estimate-detail recommended"><span class="detail-label">建议备料</span><span class="detail-value">' + YarnEstimate.formatLength(e.recommendedCm) + '</span></div>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  function renderStep(step) {
    var riskClass = "risk-" + step.riskLevel;
    var html = "";

    html += '<div class="process-step ' + riskClass + '">';
    html += '<div class="step-head">';
    html += '<span class="step-row">第 ' + step.row + ' 纬</span>';
    html += '<span class="step-switches">换色 ' + step.switchCount + ' 次</span>';
    html += '<span class="step-risk ' + riskClass + '">' + riskLabel(step.riskLevel) + '</span>';
    html += '</div>';

    html += '<div class="step-segments">';
    for (var j = 0; j < step.segments.length; j++) {
      var seg = step.segments[j];
      var thread = ThreadStore.getById(seg.threadId);
      var color = thread ? thread.color : "#ccc";
      var name = thread ? thread.name : "未知色线";
      html += '<div class="step-segment">';
      html += '<span class="segment-color" style="background:' + color + '"></span>';
      html += '<span class="segment-info">' + escapeHtml(name) + ' · 连续 ' + seg.length + ' 格</span>';
      html += '</div>';
    }
    html += '</div>';

    html += '<div class="step-risk-note ' + riskClass + '">' + escapeHtml(step.riskNote) + '</div>';
    html += '</div>';

    return html;
  }

  function riskLabel(level) {
    if (level === "high") return "高风险";
    if (level === "medium") return "中风险";
    if (level === "low") return "低风险";
    return "无风险";
  }

  function exportProcessJSON() {
    var scheme = SchemeStore.getActive();
    if (!scheme) return;

    var threads = ThreadStore.getAll();
    var data = ProcessCalc.buildExportData(scheme, threads);
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (scheme.name || "brocade-process") + "-process.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function isProcessView() {
    return currentView === "process";
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    init: init,
    toggleView: toggleView,
    switchToProcess: switchToProcess,
    switchToCanvas: switchToCanvas,
    isProcessView: isProcessView,
    refresh: refresh,
    exportProcessJSON: exportProcessJSON
  };
})();
