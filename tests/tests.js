const TestRunner = (function () {

  const results = {
    suites: [],
    total: 0,
    passed: 0,
    failed: 0
  };

  let currentSuite = null;

  function describe(name, fn) {
    currentSuite = { name: name, cases: [] };
    results.suites.push(currentSuite);
    fn();
    currentSuite = null;
  }

  function test(name, fn) {
    results.total++;
    const caseObj = { name: name, passed: false, error: null };
    try {
      fn();
      caseObj.passed = true;
      results.passed++;
    } catch (e) {
      caseObj.error = e.message || String(e);
      results.failed++;
    }
    currentSuite.cases.push(caseObj);
  }

  function assertEqual(actual, expected, msg) {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
      const m = msg || "assertEqual failed";
      throw new Error(m + "\n  expected: " + expectedStr + "\n  actual:   " + actualStr);
    }
  }

  function assertCloseTo(actual, expected, delta, msg) {
    if (Math.abs(actual - expected) > delta) {
      const m = msg || "assertCloseTo failed";
      throw new Error(m + "\n  expected: " + expected + " (±" + delta + ")\n  actual:   " + actual);
    }
  }

  function assertTrue(cond, msg) {
    if (!cond) {
      throw new Error(msg || "assertTrue failed");
    }
  }

  function render() {
    const container = document.getElementById("results");
    let html = "";

    for (const suite of results.suites) {
      html += '<div class="suite">';
      html += '<div class="suite-title">' + suite.name + '</div>';
      for (const c of suite.cases) {
        html += '<div class="case ' + (c.passed ? 'pass' : 'fail') + '">';
        html += '<span class="icon">' + (c.passed ? '✅' : '❌') + '</span>';
        html += c.name;
        if (c.error) {
          html += '<span class="detail">' + escapeHtml(c.error) + '</span>';
        }
        html += '</div>';
      }
      html += '</div>';
    }

    const allPass = results.failed === 0;
    html += '<div class="summary ' + (allPass ? 'all-pass' : 'has-fail') + '">';
    html += '共 ' + results.total + ' 个用例，通过 ' + results.passed + ' 个，失败 ' + results.failed + ' 个';
    if (allPass) html += ' 🎉';
    html += '</div>';

    container.innerHTML = html;

    console.log('===== 测试结果 =====');
    console.log('总计: ' + results.total + ' | 通过: ' + results.passed + ' | 失败: ' + results.failed);
    if (results.failed > 0) {
      for (const suite of results.suites) {
        for (const c of suite.cases) {
          if (!c.passed) {
            console.error('FAIL [' + suite.name + '] ' + c.name);
            console.error('  ' + c.error);
          }
        }
      }
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return { describe, test, assertEqual, assertCloseTo, assertTrue, render };
})();

(function () {
  const { describe, test, assertEqual, assertCloseTo, assertTrue, render } = TestRunner;

  // ==========================================================================
  // ProcessCalc.computeRowSteps 回归测试
  // ==========================================================================
  describe("ProcessCalc.computeRowSteps", function () {

    // 重置风险配置到默认值，避免测试间相互干扰
    function resetRiskConfig() {
      RiskConfig.reset();
    }

    test("整纬同色：riskLevel=none, switchCount=0, shortSegmentCount=0", function () {
      resetRiskConfig();
      const cols = 10;
      const cells = ["A", "A", "A", "A", "A", "A", "A", "A", "A", "A"];
      const result = ProcessCalc.computeRowSteps(cells, cols, 0);

      assertEqual(result.switchCount, 0, "switchCount 应为 0");
      assertEqual(result.shortSegmentCount, 0, "shortSegmentCount 应为 0");
      assertEqual(result.riskLevel, "none", "整纬同色 riskLevel 应为 none");
      assertEqual(result.segments.length, 1, "整纬同色应只有 1 个色段");
      assertEqual(result.segments[0], { threadId: "A", length: 10 });
    });

    test("交替换色 ABAB...：switchCount 精确计数且 riskLevel=high", function () {
      resetRiskConfig();
      const cols = 8;
      const cells = ["A", "B", "A", "B", "A", "B", "A", "B"];
      const result = ProcessCalc.computeRowSteps(cells, cols, 0);

      assertEqual(result.segments.length, 8, "ABAB 8 列应产生 8 个色段");
      assertEqual(result.switchCount, 7, "ABAB 8 列应有 7 次换色");
      assertEqual(result.shortSegmentCount, 0, "默认不启用短色段计数时应为 0");
      assertEqual(result.riskLevel, "high", "默认阈值下 7/8 换色密度应为 high 风险");
    });

    test("低密度换色 AAABBBAA：switchCount 精确计数", function () {
      resetRiskConfig();
      const cols = 10;
      // 段: A(3), B(3), A(4) => 2 次换色
      const cells = ["A", "A", "A", "B", "B", "B", "A", "A", "A", "A"];
      const result = ProcessCalc.computeRowSteps(cells, cols, 0);

      assertEqual(result.segments.length, 3);
      assertEqual(result.switchCount, 2, "AAABBBAAAA 应有 2 次换色");
      assertEqual(result.shortSegmentCount, 0);
      assertEqual(result.riskLevel, "low", "低密度换色应为 low 风险 (2/10=20% < 35%)");
    });

    test("启用短色段风险时：短色段计数正确", function () {
      resetRiskConfig();
      // 启用短色段计数，短色段最大长度=2
      RiskConfig.set({ countShortSegments: true, shortSegmentMaxLength: 2 });

      // 段: A(1), B(1), A(5), B(2), A(3)
      // 短色段（长度<=2）: A(1), B(1), B(2) => 3 个，且前两个连续，后一个独立
      // 连续短色段 runs: [A1, B1] 是一个 run，[B2] 是一个 run => 共 2 个 run
      // 但 countShortSegmentRuns 实际只计数每个短色段本身，不是 runs
      // 重读代码：countShortSegmentRuns 对每个 length<=maxShortLength 的 segment 计数，inShortRun 只用于避免重复？不对——仔细读：
      // 实际上 countShortSegmentRuns 是按连续短色段"运行"计数的——每进入一个短色段 run 只 count++ 一次？不对，重新读：
      // for each segment:
      //   if length<=max:
      //     if !inShortRun: inShortRun=true
      //     count++
      //   else: inShortRun=false
      // 所以这是 count *segments* 但有 inShortRun 状态？不对——inShortRun 只在进入时设为 true，count 每次都加。
      // 等一下：A1(短) -> inShortRun=false -> 设置 true，count++ (count=1)
      // B1(短) -> inShortRun=true -> count++ (count=2)
      // A5(长) -> inShortRun=false
      // B2(短) -> inShortRun=false -> 设置 true，count++ (count=3)
      // A3(长) -> inShortRun=false
      // 所以 count=3，即所有短色段的数量

      const cols = 12;
      const cells = [
        "A",           // 1
        "B",           // 1
        "A", "A", "A", "A", "A", // 5
        "B", "B",      // 2
        "A", "A", "A"  // 3
      ];

      const result = ProcessCalc.computeRowSteps(cells, cols, 0);

      assertEqual(result.segments.length, 5, "色段数量应为 5");
      assertEqual(result.switchCount, 4, "换色次数应为 4");
      assertEqual(result.shortSegmentCount, 3, "短色段（长度<=2）计数应为 3");
    });

    test("启用短色段风险时：effectiveSwitchCount = switchCount + shortSegmentCount", function () {
      resetRiskConfig();
      RiskConfig.set({ countShortSegments: true, shortSegmentMaxLength: 2 });

      // 段: A(1), B(1), C(5), D(2) —— switchCount=3，短色段=3（A1, B1, D2）
      const cols = 9;
      const cells = ["A", "B", "C", "C", "C", "C", "C", "D", "D"];
      const result = ProcessCalc.computeRowSteps(cells, cols, 0);

      assertEqual(result.switchCount, 3);
      assertEqual(result.shortSegmentCount, 3);
      assertEqual(result.effectiveSwitchCount, 6, "effectiveSwitchCount = 3 + 3 = 6");
    });

    test("启用短色段风险：短色段推动 riskLevel 从 low 升级到 medium", function () {
      resetRiskConfig();
      // 默认阈值: medium=0.35, high=0.62
      // 构造 cols=10，纯 switchCount=2 (20% < 35%) -> low
      // 加上 shortSegmentCount=3 => effective=5 (50% > 35%, <62%) -> medium
      RiskConfig.set({ countShortSegments: true, shortSegmentMaxLength: 2 });

      // 段: A(1), B(1), C(6), D(1), A(1)
      // 段长度: 1,1,6,1,1 —— 短色段(<=2): 4个；switchCount=4
      // cols=1+1+6+1+1=10
      // effectiveSwitchCount=4+4=8 => 8/10=80% > 62% => high，这太高了
      // 调整一下:
      // 段: A(1), B(7), C(1), D(1) —— cols=1+7+1+1=10
      // switchCount=3, shortSegmentCount=3 (A1, C1, D1)
      // effective=6 => 6/10=60%，在 0.35~0.62 之间 -> medium

      const cols = 10;
      const cells = [
        "A",                          // 1 (短)
        "B", "B", "B", "B", "B", "B", "B", // 7
        "C",                          // 1 (短)
        "D"                           // 1 (短)
      ];

      const result = ProcessCalc.computeRowSteps(cells, cols, 0);

      assertEqual(result.switchCount, 3);
      assertEqual(result.shortSegmentCount, 3);
      assertEqual(result.effectiveSwitchCount, 6);
      assertEqual(result.riskLevel, "medium",
        "effective=6, cols=10, 60% ∈ (35%, 62%) => medium");
    });

    test("不启用短色段风险：shortSegmentCount 始终为 0", function () {
      resetRiskConfig();
      RiskConfig.set({ countShortSegments: false });

      // 全是单格短色段
      const cols = 6;
      const cells = ["A", "B", "A", "B", "A", "B"];
      const result = ProcessCalc.computeRowSteps(cells, cols, 0);

      assertEqual(result.shortSegmentCount, 0, "未启用短色段计数时，shortSegmentCount 必须为 0");
      assertEqual(result.effectiveSwitchCount, result.switchCount,
        "未启用时 effectiveSwitchCount 等于 switchCount");
    });

    test("row 字段 = rowIndex + 1", function () {
      resetRiskConfig();
      const cols = 4;
      const cells = ["A", "A", "B", "B"];

      const r0 = ProcessCalc.computeRowSteps(cells, cols, 0);
      const r5 = ProcessCalc.computeRowSteps(cells, cols, 5);

      assertEqual(r0.row, 1);
      assertEqual(r5.row, 6);
    });
  });

  // ==========================================================================
  // YarnEstimate.computePerThreadEstimate 回归测试
  // ==========================================================================
  describe("YarnEstimate.computePerThreadEstimate", function () {

    function makeThreads() {
      return [
        ThreadModel.createThread({
          id: "t_red", name: "红", color: "#ff0000", order: 0
        }),
        ThreadModel.createThread({
          id: "t_blue", name: "蓝", color: "#0000ff", order: 1
        }),
        ThreadModel.createThread({
          id: "t_green", name: "绿", color: "#00ff00", order: 2
        })
      ];
    }

    function makeThreadsWithoutLossConfig() {
      return [
        { id: "t_red", name: "红", color: "#ff0000", order: 0, note: "" },
        { id: "t_blue", name: "蓝", color: "#0000ff", order: 1, note: "" },
        { id: "t_green", name: "绿", color: "#00ff00", order: 2, note: "" }
      ];
    }

    // 构造简单的 cells 网格
    function makeSimpleGrid() {
      // cols=4, rows=3
      // 红 红 蓝 蓝
      // 红 红 蓝 蓝
      // 绿 绿 绿 绿
      return {
        cols: 4,
        rows: 3,
        cells: [
          "t_red", "t_red", "t_blue", "t_blue",
          "t_red", "t_red", "t_blue", "t_blue",
          "t_green", "t_green", "t_green", "t_green"
        ]
      };
    }

    test("方案默认损耗：使用默认 lossFactor=1.15 和 safetyMargin=10%", function () {
      const threads = makeThreads();
      const grid = makeSimpleGrid();
      const scheme = {
        cols: grid.cols,
        rows: grid.rows,
        estimateConfig: null
      };

      const result = YarnEstimate.computePerThreadEstimate({
        cells: grid.cells,
        cols: grid.cols,
        rows: grid.rows,
        threads: threads,
        scheme: scheme
      });

      assertEqual(result.schemeConfig.defaultLossFactor, 1.15, "默认 lossFactor");
      assertEqual(result.schemeConfig.defaultSafetyMargin, 10, "默认 safetyMargin");

      // 红色: cellCount=4 (row0:2, row1:2)
      const redEst = result.estimates.find(e => e.id === "t_red");
      assertTrue(redEst != null, "红色估算应存在");
      assertEqual(redEst.lossFactor, 1.15, "红色应使用默认 lossFactor");
      assertEqual(redEst.safetyMargin, 10, "红色应使用默认 safetyMargin");
      assertEqual(redEst.cellCount, 4, "红色共 4 格");

      // 推荐用量公式: baseTotalCm * lossFactor * (1 + safetyMargin/100)
      // warpLenCm = cols / warpDensity = 4 / 5 = 0.8
      // weftLenCm = rows / weftDensity = 3 / 5 = 0.6
      // warpCellCount = ceil(4 / 3) = 2, weftCellCount = 4 (usage.totalLength)
      // warpBaseCm = 2 * 0.8 = 1.6, weftBaseCm = 4 * 0.6 = 2.4
      // baseTotalCm = 1.6 + 2.4 = 4.0
      // withLossCm = 4.0 * 1.15 = 4.6
      // withSafetyCm = 4.6 * 1.10 = 5.06
      assertEqual(redEst.warpLengthCm || result.warpLengthCm, 0.8, "warpLenCm = 4/5 = 0.8");
      assertEqual(result.weftLengthCm, 0.6, "weftLenCm = 3/5 = 0.6");
      assertEqual(redEst.warpCellCount, 2, "红色 warpCellCount = ceil(4/3) = 2");
      assertEqual(redEst.weftCellCount, 4, "红色 weftCellCount = 纬向总长度");
      assertCloseTo(redEst.baseTotalCm, 4.0, 0.01, "红色 baseTotalCm = 1.6 + 2.4 = 4.0");
      assertCloseTo(redEst.withLossCm, 4.6, 0.01, "红色 withLossCm = 4.0 * 1.15 = 4.6");
      assertCloseTo(redEst.recommendedCm, 5.06, 0.01, "红色 recommendedCm = 4.6 * 1.10 = 5.06");
    });

    test("方案自定义默认损耗：覆盖全局默认值", function () {
      const threads = makeThreadsWithoutLossConfig();
      const grid = makeSimpleGrid();
      const scheme = {
        cols: grid.cols,
        rows: grid.rows,
        estimateConfig: {
          defaultLossFactor: 1.5,
          defaultSafetyMargin: 20,
          cellSizeMm: 2.0,
          warpDensity: 5.0,
          weftDensity: 5.0
        }
      };

      const result = YarnEstimate.computePerThreadEstimate({
        cells: grid.cells,
        cols: grid.cols,
        rows: grid.rows,
        threads: threads,
        scheme: scheme
      });

      assertEqual(result.schemeConfig.defaultLossFactor, 1.5);
      assertEqual(result.schemeConfig.defaultSafetyMargin, 20);

      const redEst = result.estimates.find(e => e.id === "t_red");
      assertEqual(redEst.lossFactor, 1.5, "红色应继承方案默认 lossFactor=1.5");
      assertEqual(redEst.safetyMargin, 20, "红色应继承方案默认 safetyMargin=20");

      // baseTotalCm = 4.0 不变
      // withLossCm = 4.0 * 1.5 = 6.0
      // withSafetyCm = 6.0 * 1.20 = 7.2
      assertCloseTo(redEst.baseTotalCm, 4.0, 0.01);
      assertCloseTo(redEst.withLossCm, 6.0, 0.01);
      assertCloseTo(redEst.recommendedCm, 7.2, 0.01);
    });

    test("单条色线 lossConfig 覆盖：覆盖方案默认", function () {
      const threads = makeThreads();
      // 单独给红色设置高损耗
      threads[0].lossConfig = { lossFactor: 2.0, safetyMargin: 50 };

      const grid = makeSimpleGrid();
      const scheme = {
        cols: grid.cols,
        rows: grid.rows,
        estimateConfig: {
          defaultLossFactor: 1.15,
          defaultSafetyMargin: 10,
          cellSizeMm: 2.0,
          warpDensity: 5.0,
          weftDensity: 5.0
        }
      };

      const result = YarnEstimate.computePerThreadEstimate({
        cells: grid.cells,
        cols: grid.cols,
        rows: grid.rows,
        threads: threads,
        scheme: scheme
      });

      const redEst = result.estimates.find(e => e.id === "t_red");
      assertEqual(redEst.lossFactor, 2.0, "红色应使用自身 lossConfig 的 lossFactor=2.0");
      assertEqual(redEst.safetyMargin, 50, "红色应使用自身 lossConfig 的 safetyMargin=50");

      // baseTotalCm = 4.0
      // withLossCm = 4.0 * 2.0 = 8.0
      // withSafetyCm = 8.0 * 1.50 = 12.0
      assertCloseTo(redEst.baseTotalCm, 4.0, 0.01);
      assertCloseTo(redEst.withLossCm, 8.0, 0.01);
      assertCloseTo(redEst.recommendedCm, 12.0, 0.01);

      // 蓝色未配置，应使用方案默认
      const blueEst = result.estimates.find(e => e.id === "t_blue");
      assertEqual(blueEst.lossFactor, 1.15, "蓝色应使用方案默认 lossFactor=1.15");
      assertEqual(blueEst.safetyMargin, 10, "蓝色应使用方案默认 safetyMargin=10");
    });

    test("色线部分覆盖 lossConfig：仅设置 lossFactor，safetyMargin 回退到方案默认", function () {
      const threads = makeThreads();
      // 红色只设 lossFactor，不设 safetyMargin
      threads[0].lossConfig = { lossFactor: 1.8 };

      const grid = makeSimpleGrid();
      const scheme = {
        cols: grid.cols,
        rows: grid.rows,
        estimateConfig: {
          defaultLossFactor: 1.15,
          defaultSafetyMargin: 10,
          cellSizeMm: 2.0,
          warpDensity: 5.0,
          weftDensity: 5.0
        }
      };

      const result = YarnEstimate.computePerThreadEstimate({
        cells: grid.cells,
        cols: grid.cols,
        rows: grid.rows,
        threads: threads,
        scheme: scheme
      });

      const redEst = result.estimates.find(e => e.id === "t_red");
      assertEqual(redEst.lossFactor, 1.8, "红色 lossFactor 来自自身配置");
      assertEqual(redEst.safetyMargin, 10, "红色 safetyMargin 缺失，应回退到方案默认 10");
    });

    test("未使用的色线不出现在 estimates 结果中", function () {
      const threads = makeThreads();
      // 在 grid 中只用红和蓝，不用绿
      const cols = 2, rows = 2;
      const cells = [
        "t_red", "t_blue",
        "t_red", "t_blue"
      ];
      const scheme = { cols, rows, estimateConfig: null };

      const result = YarnEstimate.computePerThreadEstimate({
        cells: cells, cols: cols, rows: rows,
        threads: threads, scheme: scheme
      });

      const ids = result.estimates.map(e => e.id);
      assertTrue(ids.indexOf("t_red") !== -1, "红色应在结果中");
      assertTrue(ids.indexOf("t_blue") !== -1, "蓝色应在结果中");
      assertTrue(ids.indexOf("t_green") === -1, "绿色未使用，不应在结果中");
      assertEqual(ids.length, 2, "应只有 2 条色线有估算");
    });

    test("totals 汇总正确：所有色线数值相加", function () {
      const threads = makeThreadsWithoutLossConfig();
      const grid = makeSimpleGrid();
      const scheme = {
        cols: grid.cols, rows: grid.rows,
        estimateConfig: {
          defaultLossFactor: 1.0,
          defaultSafetyMargin: 0,
          cellSizeMm: 2.0,
          warpDensity: 5.0,
          weftDensity: 5.0
        }
      };

      const result = YarnEstimate.computePerThreadEstimate({
        cells: grid.cells, cols: grid.cols, rows: grid.rows,
        threads: threads, scheme: scheme
      });

      // 无损模式下验证累加
      // 红: cellCount=4, baseTotalCm=4.0
      // 蓝: cellCount=4, warpCellCount=ceil(4/3)=2, weftCellCount=4
      //     warpBaseCm=2*0.8=1.6, weftBaseCm=4*0.6=2.4, baseTotalCm=4.0
      // 绿: cellCount=4, warpCellCount=ceil(4/3)=2, weftCellCount=4
      //     baseTotalCm=2*0.8 + 4*0.6 = 1.6 + 2.4 = 4.0
      // 总计: cellCount=12, baseTotalCm=12.0
      let sumBase = 0, sumCells = 0;
      result.estimates.forEach(e => {
        sumBase += e.baseTotalCm;
        sumCells += e.cellCount;
      });

      assertEqual(sumCells, 12, "总 cellCount = 4*3 = 12");
      assertCloseTo(sumBase, 12.0, 0.01, "总 baseTotalCm = 4.0*3 = 12.0");
      assertEqual(result.totals.cellCount, 12);
      assertCloseTo(result.totals.baseTotalCm, 12.0, 0.01);
      assertCloseTo(result.totals.withLossCm, 12.0, 0.01, "lossFactor=1.0 时 withLoss = base");
      assertCloseTo(result.totals.withSafetyCm, 12.0, 0.01, "margin=0 时 withSafety = withLoss");
      assertCloseTo(result.totals.recommendedMeters, 0.12, 0.001, "12cm = 0.12m");
    });
  });

  // ==========================================================================
  render();
})();
