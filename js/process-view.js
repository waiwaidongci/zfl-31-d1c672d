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

    processEl.innerHTML = html;
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
