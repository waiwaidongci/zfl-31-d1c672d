const { expect } = require('chai');

describe('ThreadModel', function () {
  it('createThread 默认值正确', function () {
    const t = ThreadModel.createThread();
    expect(t).to.have.property('id').that.is.a('string');
    expect(t.name).to.equal('未命名色线');
    expect(t.color).to.equal('#cccccc');
    expect(t.order).to.equal(0);
    expect(t.lossConfig).to.deep.equal({ lossFactor: 1.15, safetyMargin: 10 });
  });

  it('createThread 接受自定义参数', function () {
    const t = ThreadModel.createThread({
      id: 't_custom',
      name: '测试',
      color: '#ff0000',
      order: 5,
      lossFactor: 2.0,
      safetyMargin: 20
    });
    expect(t.id).to.equal('t_custom');
    expect(t.name).to.equal('测试');
    expect(t.color).to.equal('#ff0000');
    expect(t.order).to.equal(5);
  });

  it('createDefaultThreads 返回 8 条默认色线', function () {
    const threads = ThreadModel.createDefaultThreads();
    expect(threads).to.have.lengthOf(8);
    expect(threads[0].id).to.equal('default_0');
    expect(threads[0].note).to.equal('底色/空白');
    expect(threads[0].color).to.equal(ThreadModel.DEFAULT_COLORS[0]);
  });

  it('getThreadById / getColorById / getThreadIndexById 工作正常', function () {
    const threads = ThreadModel.createDefaultThreads();
    const t = threads[3];
    expect(ThreadModel.getThreadById(threads, t.id)).to.equal(t);
    expect(ThreadModel.getColorById(threads, t.id)).to.equal(t.color);
    expect(ThreadModel.getThreadIndexById(threads, t.id)).to.equal(3);
    expect(ThreadModel.getThreadById(threads, 'nonexistent')).to.be.null;
  });

  it('sortByOrder 按 order 升序排序', function () {
    const threads = [
      { order: 3, id: 'a' },
      { order: 1, id: 'b' },
      { order: 2, id: 'c' }
    ];
    const sorted = ThreadModel.sortByOrder(threads);
    expect(sorted.map(t => t.id)).to.deep.equal(['b', 'c', 'a']);
    expect(threads.map(t => t.id)).to.deep.equal(['a', 'b', 'c'], '不应改变原数组');
  });

  it('reorderThreads 正确重排', function () {
    const threads = ThreadModel.createDefaultThreads().slice(0, 4);
    const reordered = ThreadModel.reorderThreads(threads, 0, 3);
    expect(reordered[3].id).to.equal('default_0');
    expect(reordered[0].id).to.equal('default_1');
    reordered.forEach((t, i) => expect(t.order).to.equal(i));
  });

  it('validateThread 全面校验', function () {
    expect(ThreadModel.validateThread(null)).to.have.length.greaterThan(0);
    expect(ThreadModel.validateThread({})).to.have.length.greaterThan(0);
    expect(ThreadModel.validateThread({ id: 123, name: '', color: 'bad', order: 'x' }))
      .to.have.length.greaterThan(0);

    const valid = ThreadModel.createThread({ id: 'ok', name: '好', color: '#123456', order: 0 });
    expect(ThreadModel.validateThread(valid)).to.be.empty;
  });

  it('computeColorStats 统计正确', function () {
    const threads = ThreadModel.createDefaultThreads().slice(0, 3);
    const cells = [
      threads[0].id, threads[1].id, threads[0].id,
      threads[2].id, threads[1].id, threads[0].id
    ];
    const stats = ThreadModel.computeColorStats(cells, threads);
    expect(stats).to.have.lengthOf(3);
    expect(stats.find(s => s.id === threads[0].id).count).to.equal(3);
    expect(stats.find(s => s.id === threads[1].id).count).to.equal(2);
    expect(stats.find(s => s.id === threads[2].id).count).to.equal(1);
  });

  it('migrateIndexToId 将数字索引转为 ID 字符串', function () {
    const threads = ThreadModel.createDefaultThreads();
    const oldCells = [0, 1, 2, 0, 1];
    const migrated = ThreadModel.migrateIndexToId(oldCells, threads);
    expect(migrated).to.deep.equal([
      threads[0].id, threads[1].id, threads[2].id,
      threads[0].id, threads[1].id
    ]);
    expect(ThreadModel.migrateIndexToId([threads[0].id, 999], threads))
      .to.deep.equal([threads[0].id, threads[0].id]);
  });

  it('replaceThreadInCells 批量替换 ID', function () {
    const cells = ['a', 'b', 'a', 'c', 'a'];
    const replaced = ThreadModel.replaceThreadInCells(cells, 'a', 'x');
    expect(replaced).to.deep.equal(['x', 'b', 'x', 'c', 'x']);
    expect(cells).to.deep.equal(['a', 'b', 'a', 'c', 'a'], '不应原地修改');
  });

  it('isThreadUsed 检测使用情况', function () {
    expect(ThreadModel.isThreadUsed(['a', 'b', 'c'], 'b')).to.be.true;
    expect(ThreadModel.isThreadUsed(['a', 'b', 'c'], 'd')).to.be.false;
  });
});

describe('RiskConfig', function () {
  beforeEach(function () { RiskConfig.reset(); });

  it('默认值正确', function () {
    const cfg = RiskConfig.getAll();
    expect(cfg.highRiskThreshold).to.equal(0.62);
    expect(cfg.mediumRiskThreshold).to.equal(0.35);
    expect(cfg.countShortSegments).to.be.false;
    expect(cfg.shortSegmentMaxLength).to.equal(2);
  });

  it('set 批量设置 + getters 工作', function () {
    RiskConfig.set({
      countShortSegments: true,
      shortSegmentMaxLength: 3
    });
    expect(RiskConfig.getCountShortSegments()).to.be.true;
    expect(RiskConfig.getShortSegmentMaxLength()).to.equal(3);
  });

  it('setHighRiskThreshold 校验边界', function () {
    expect(RiskConfig.setHighRiskThreshold(0.9)).to.be.true;
    expect(RiskConfig.setHighRiskThreshold(0.1)).to.be.false;
    expect(RiskConfig.setHighRiskThreshold(2)).to.be.false;
  });

  it('setMediumRiskThreshold 校验边界', function () {
    expect(RiskConfig.setMediumRiskThreshold(0.2)).to.be.true;
    expect(RiskConfig.setMediumRiskThreshold(0.8)).to.be.false;
  });
});

describe('ProcessCalc', function () {
  beforeEach(function () { RiskConfig.reset(); });

  it('整纬同色：riskLevel=none, switchCount=0', function () {
    const cols = 10;
    const cells = Array(cols).fill('A');
    const r = ProcessCalc.computeRowSteps(cells, cols, 0);
    expect(r.switchCount).to.equal(0);
    expect(r.shortSegmentCount).to.equal(0);
    expect(r.riskLevel).to.equal('none');
    expect(r.segments).to.deep.equal([{ threadId: 'A', length: 10 }]);
    expect(r.row).to.equal(1);
  });

  it('ABAB 交替换色：high 风险', function () {
    const cols = 8;
    const cells = ['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B'];
    const r = ProcessCalc.computeRowSteps(cells, cols, 0);
    expect(r.segments.length).to.equal(8);
    expect(r.switchCount).to.equal(7);
    expect(r.riskLevel).to.equal('high');
  });

  it('低密度换色：low 风险', function () {
    const cols = 10;
    const cells = ['A', 'A', 'A', 'B', 'B', 'B', 'A', 'A', 'A', 'A'];
    const r = ProcessCalc.computeRowSteps(cells, cols, 0);
    expect(r.segments.length).to.equal(3);
    expect(r.switchCount).to.equal(2);
    expect(r.riskLevel).to.equal('low');
  });

  it('countShortSegments 启用：短色段计数', function () {
    RiskConfig.set({ countShortSegments: true, shortSegmentMaxLength: 2 });
    const cols = 12;
    const cells = ['A', 'B', 'A', 'A', 'A', 'A', 'A', 'B', 'B', 'A', 'A', 'A'];
    const r = ProcessCalc.computeRowSteps(cells, cols, 0);
    expect(r.shortSegmentCount).to.equal(3);
    expect(r.effectiveSwitchCount).to.equal(r.switchCount + 3);
  });

  it('countShortSegments 未启用：始终为 0', function () {
    RiskConfig.set({ countShortSegments: false });
    const cols = 6;
    const cells = ['A', 'B', 'A', 'B', 'A', 'B'];
    const r = ProcessCalc.computeRowSteps(cells, cols, 0);
    expect(r.shortSegmentCount).to.equal(0);
    expect(r.effectiveSwitchCount).to.equal(r.switchCount);
  });

  it('row 字段 = rowIndex + 1', function () {
    const cols = 4;
    const cells = ['A', 'A', 'B', 'B'];
    expect(ProcessCalc.computeRowSteps(cells, cols, 0).row).to.equal(1);
    expect(ProcessCalc.computeRowSteps(cells, cols, 5).row).to.equal(6);
  });

  it('computeAllSteps 遍历所有行', function () {
    const cols = 4, rows = 3;
    const cells = Array(cols * rows).fill('A');
    const steps = ProcessCalc.computeAllSteps(cells, cols, rows);
    expect(steps).to.have.lengthOf(3);
    steps.forEach((s, i) => expect(s.row).to.equal(i + 1));
  });

  it('computeSummary 汇总正确', function () {
    const cols = 4;
    const cells = ['A', 'B', 'A', 'B'];
    const steps = [ProcessCalc.computeRowSteps(cells, cols, 0)];
    const summary = ProcessCalc.computeSummary(steps);
    expect(summary.totalSwitches).to.equal(3);
    expect(summary.colorUsage).to.have.property('A');
    expect(summary.colorUsage).to.have.property('B');
    expect(summary.colorUsage.A.totalLength).to.equal(2);
    expect(summary.colorUsage.B.totalLength).to.equal(2);
  });
});

describe('SelectionState', function () {
  beforeEach(function () { SelectionState.reset(); });

  it('默认模式为 paint，无选区无剪贴板', function () {
    expect(SelectionState.getMode()).to.equal('paint');
    expect(SelectionState.hasSelection()).to.be.false;
    expect(SelectionState.hasClipboard()).to.be.false;
  });

  it('setMode/toggleMode 切换模式', function () {
    SelectionState.setMode('select');
    expect(SelectionState.getMode()).to.equal('select');
    SelectionState.toggleMode();
    expect(SelectionState.getMode()).to.equal('paint');
    SelectionState.setMode('invalid');
    expect(SelectionState.getMode()).to.equal('paint');
  });

  it('paint 模式下自动清除选区', function () {
    SelectionState.setMode('select');
    SelectionState.setSelection(1, 1, 3, 3, 10, 10);
    expect(SelectionState.hasSelection()).to.be.true;
    SelectionState.setMode('paint');
    expect(SelectionState.hasSelection()).to.be.false;
  });

  it('setSelection 自动归一化坐标 + clamp', function () {
    SelectionState.setMode('select');
    SelectionState.setSelection(3, 3, 1, 1, 10, 10);
    const sel = SelectionState.getSelection();
    expect(sel.startX).to.equal(1);
    expect(sel.startY).to.equal(1);
    expect(sel.endX).to.equal(3);
    expect(sel.endY).to.equal(3);
  });

  it('setSelection 超出边界 clamp', function () {
    SelectionState.setMode('select');
    SelectionState.setSelection(-5, -5, 100, 100, 6, 4);
    const sel = SelectionState.getSelection();
    expect(sel.startX).to.equal(0);
    expect(sel.startY).to.equal(0);
    expect(sel.endX).to.equal(5);
    expect(sel.endY).to.equal(3);
  });

  it('getSelectionSize/getSelectedCellIndices 正确', function () {
    SelectionState.setMode('select');
    SelectionState.setSelection(1, 1, 2, 2, 5, 5);
    expect(SelectionState.getSelectionSize()).to.deep.equal({ width: 2, height: 2 });
    const indices = SelectionState.getSelectedCellIndices(5, 5);
    expect(indices).to.have.lengthOf(4);
    expect(indices).to.include.members([6, 7, 11, 12]);
  });

  it('isCellSelected 单格判定', function () {
    SelectionState.setMode('select');
    SelectionState.setSelection(1, 1, 2, 2, 10, 10);
    expect(SelectionState.isCellSelected(12, 10)).to.be.true;
    expect(SelectionState.isCellSelected(0, 10)).to.be.false;
  });

  it('copy/paste 剪贴板操作', function () {
    SelectionState.setMode('select');
    SelectionState.setSelection(0, 0, 1, 1, 3, 3);
    const cells = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
    const cb = SelectionState.copy(cells, 3);
    expect(cb.width).to.equal(2);
    expect(cb.height).to.equal(2);
    expect(cb.data).to.deep.equal([['a', 'b'], ['d', 'e']]);
    expect(SelectionState.hasClipboard()).to.be.true;
    expect(SelectionState.getClipboard()).to.deep.equal(cb);

    SelectionState.clearClipboard();
    expect(SelectionState.hasClipboard()).to.be.false;
  });
});

describe('BatchTransform', function () {
  it('fillSelection 填充选中区域', function () {
    const cols = 4, rows = 3;
    const cells = ['a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a'];
    const sel = { startX: 1, startY: 0, endX: 2, endY: 1 };
    const r = BatchTransform.fillSelection(cells, cols, rows, sel, 'X');
    expect(r).to.deep.equal([
      'a', 'X', 'X', 'a',
      'a', 'X', 'X', 'a',
      'a', 'a', 'a', 'a'
    ]);
    expect(cells.every(c => c === 'a')).to.be.true;
  });

  it('clearSelection 使用默认色填充', function () {
    const cols = 3, rows = 2;
    const cells = ['X', 'X', 'X', 'X', 'X', 'X'];
    const sel = { startX: 0, startY: 0, endX: 2, endY: 0 };
    const r = BatchTransform.clearSelection(cells, cols, rows, sel, 'bg');
    expect(r).to.deep.equal(['bg', 'bg', 'bg', 'X', 'X', 'X']);
  });

  it('flipHorizontal 水平翻转', function () {
    const cols = 4, rows = 2;
    const cells = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const sel = { startX: 0, startY: 0, endX: 3, endY: 0 };
    const r = BatchTransform.flipHorizontal(cells, cols, rows, sel);
    expect(r).to.deep.equal(['d', 'c', 'b', 'a', 'e', 'f', 'g', 'h']);
  });

  it('flipVertical 垂直翻转', function () {
    const cols = 2, rows = 3;
    const cells = ['a', 'b', 'c', 'd', 'e', 'f'];
    const sel = { startX: 0, startY: 0, endX: 1, endY: 2 };
    const r = BatchTransform.flipVertical(cells, cols, rows, sel);
    expect(r).to.deep.equal(['e', 'f', 'c', 'd', 'a', 'b']);
  });

  it('copySelection 复制区域', function () {
    const cols = 4, rows = 3;
    const cells = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
    const sel = { startX: 1, startY: 1, endX: 2, endY: 2 };
    const clip = BatchTransform.copySelection(cells, cols, sel);
    expect(clip.width).to.equal(2);
    expect(clip.height).to.equal(2);
    expect(clip.data).to.deep.equal([['f', 'g'], ['j', 'k']]);
  });

  it('pasteClipboard 粘贴并裁剪边界', function () {
    const cols = 3, rows = 3;
    const cells = Array(9).fill('.');
    const clipboard = {
      width: 2, height: 2,
      data: [['X', 'Y'], ['Z', 'W']]
    };
    const r = BatchTransform.pasteClipboard(cells, cols, rows, 2, 2, clipboard);
    expect(r.pasteW).to.equal(1);
    expect(r.pasteH).to.equal(1);
    expect(r.cells).to.deep.equal([
      '.', '.', '.',
      '.', '.', '.',
      '.', '.', 'X'
    ]);
  });
});

describe('ImportValidator', function () {
  function makeThreads() {
    return [
      { id: 't0', name: '底色', color: '#000000', order: 0 },
      { id: 't1', name: '红', color: '#ff0000', order: 1 }
    ];
  }

  it('缺少必填字段报 error', function () {
    const r = ImportValidator.validate({ cols: null, rows: null, cells: null });
    expect(r.valid).to.be.false;
    expect(r.errors).to.have.length.greaterThan(0);
  });

  it('cols/rows 非正整数报 error', function () {
    const r1 = ImportValidator.validate({ cols: -1, rows: 2, cells: [] });
    expect(r1.errors.some(e => e.code === 'invalid_cols')).to.be.true;
    const r2 = ImportValidator.validate({ cols: 2, rows: 2.5, cells: [] });
    expect(r2.errors.some(e => e.code === 'invalid_rows')).to.be.true;
  });

  it('dimension_mismatch 网格长度不匹配', function () {
    const r = ImportValidator.validate({ cols: 2, rows: 2, cells: ['a', 'b'] });
    expect(r.errors.some(e => e.code === 'dimension_mismatch')).to.be.true;
  });

  it('mixed_cell_formats 新旧格式混用', function () {
    const threads = makeThreads();
    const r = ImportValidator.validate({
      cols: 2, rows: 2, cells: [0, 't1', 't0', 1]
    }, { threads });
    expect(r.errors.some(e => e.code === 'mixed_cell_formats')).to.be.true;
  });

  it('有效数据返回 valid=true', function () {
    const threads = makeThreads();
    const r = ImportValidator.validate({
      name: '测试',
      cols: 2, rows: 2,
      cells: ['t0', 't1', 't0', 't1'],
      threads
    }, { threads });
    expect(r.valid).to.be.true;
    expect(r.canImport).to.be.true;
    expect(r.canOverwrite).to.be.true;
  });

  it('detectThreadConflicts 检测冲突', function () {
    const fileThreads = [{ id: 't0', name: '底色', color: '#ffffff' }];
    const currentThreads = [{ id: 't0', name: '底色', color: '#000000' }];
    const conflicts = ImportValidator.detectThreadConflicts(fileThreads, currentThreads);
    expect(conflicts).to.have.lengthOf(1);
    expect(conflicts[0].types).to.include('id');
  });

  it('threads 数据警告：缺失/重复 ID', function () {
    const r = ImportValidator.validate({
      cols: 1, rows: 1, cells: ['t0'],
      threads: [{ id: 'a' }, { id: 'a' }]
    });
    expect(r.warnings.some(w => w.code === 'duplicate_thread_id')).to.be.true;
  });
});

describe('ImportParser', function () {
  it('parseObject 提取字段并默认值', function () {
    const raw = {
      name: '  方案1  ',
      cols: 3, rows: 2,
      cells: ['a', 'b'],
      threads: [{ id: 't1', lossConfig: {} }],
      estimateConfig: { cellSizeMm: 3.0, warpDensity: 4 },
      invalid_field: true
    };
    const p = ImportParser.parseObject(raw, 'file.json');
    expect(p.name).to.equal('方案1');
    expect(p.cols).to.equal(3);
    expect(p.rows).to.equal(2);
    expect(p.cells).to.deep.equal(['a', 'b']);
    expect(p.threads).to.have.lengthOf(1);
    expect(p.threads[0].lossConfig.lossFactor).to.equal(1.15);
    expect(p.estimateConfig.cellSizeMm).to.equal(3.0);
    expect(p.estimateConfig.defaultLossFactor).to.equal(1.15);
    expect(p.raw).to.deep.equal(raw);
  });

  it('parseObject 缺省字段转 null，非法对象抛错', function () {
    expect(ImportParser.parseObject({}).cells).to.be.null;
    expect(() => ImportParser.parseObject(null)).to.throw(ImportParser.ImportError);
    expect(() => ImportParser.parseObject([])).to.throw(ImportParser.ImportError);
  });

  it('parseObject 从文件名提取名称', function () {
    const p = ImportParser.parseObject({}, '我的方案.json');
    expect(p.name).to.equal('我的方案');
  });
});

describe('CompareCalc', function () {
  it('compareDimensions 尺寸对比', function () {
    const a = { cols: 10, rows: 8 };
    const b = { cols: 12, rows: 8 };
    const r = CompareCalc.compareDimensions(a, b);
    expect(r.sameSize).to.be.false;
    expect(r.colsDiff).to.equal(2);
    expect(r.rowsDiff).to.equal(0);
  });

  it('compareFilledCells 填充格统计', function () {
    const a = { cols: 4, rows: 2, cells: ['bg', 'bg', 'x', 'bg', 'bg', 'bg', 'x', 'x'] };
    const b = { cols: 2, rows: 2, cells: ['bg', 'x', 'x', 'x'] };
    const r = CompareCalc.compareFilledCells(a, b, 'bg');
    expect(r.a.count).to.equal(3);
    expect(r.b.count).to.equal(3);
  });

  it('computeCellDifferences 相同尺寸全相同', function () {
    const a = { cols: 2, rows: 2, cells: ['a', 'b', 'c', 'd'] };
    const b = { cols: 2, rows: 2, cells: ['a', 'b', 'c', 'd'] };
    const r = CompareCalc.computeCellDifferences(a, b);
    expect(r.sameSize).to.be.true;
    expect(r.changedCount).to.equal(0);
    expect(r.message).to.equal('两个方案完全相同');
  });

  it('computeCellDifferences 存在差异', function () {
    const a = { cols: 2, rows: 2, cells: ['a', 'b', 'c', 'd'] };
    const b = { cols: 2, rows: 2, cells: ['a', 'X', 'c', 'Y'] };
    const r = CompareCalc.computeCellDifferences(a, b);
    expect(r.changedCount).to.equal(2);
    expect(r.diffCount).to.equal(2);
  });

  it('computeAlignmentOffset 对齐模式', function () {
    const a = { cols: 10, rows: 8 };
    const b = { cols: 4, rows: 2 };
    expect(CompareCalc.computeAlignmentOffset(a, b, { mode: 'top-left' }))
      .to.deep.equal({ mode: 'top-left', offsetX: 0, offsetY: 0 });
    const center = CompareCalc.computeAlignmentOffset(a, b, { mode: 'center' });
    expect(center.offsetX).to.equal(3);
    expect(center.offsetY).to.equal(3);
    const custom = CompareCalc.computeAlignmentOffset(a, b, { mode: 'custom', offsetX: 5, offsetY: 2 });
    expect(custom.offsetX).to.equal(5);
    expect(custom.offsetY).to.equal(2);
  });
});

describe('YarnEstimate (纯函数部分)', function () {
  it('getDefaults 返回默认值副本', function () {
    const d = YarnEstimate.getDefaults();
    expect(d).to.deep.equal({
      cellSizeMm: 2.0, warpDensity: 5.0, weftDensity: 5.0,
      defaultLossFactor: 1.15, defaultSafetyMargin: 10
    });
    d.cellSizeMm = 999;
    expect(YarnEstimate.getDefaults().cellSizeMm).to.equal(2.0);
  });

  it('ensureSchemeEstimateConfig 补全缺省字段', function () {
    const r = YarnEstimate.ensureSchemeEstimateConfig({ estimateConfig: { cellSizeMm: 5.0 } });
    expect(r.cellSizeMm).to.equal(5.0);
    expect(r.warpDensity).to.equal(5.0);
    expect(r.defaultLossFactor).to.equal(1.15);
  });

  it('ensureThreadLossConfig 覆盖优先顺序', function () {
    const schemeCfg = { defaultLossFactor: 1.3, defaultSafetyMargin: 5 };
    const thread = { lossConfig: { lossFactor: 2.0 } };
    const r = YarnEstimate.ensureThreadLossConfig(thread, schemeCfg);
    expect(r.lossFactor).to.equal(2.0);
    expect(r.safetyMargin).to.equal(5);
  });

  it('computeWarpLengthCm / computeWeftLengthCm 按密度优先', function () {
    expect(YarnEstimate.computeWarpLengthCm(10, 5, 2)).to.equal(2);
    expect(YarnEstimate.computeWarpLengthCm(10, 0, 2)).to.equal(2);
    expect(YarnEstimate.computeWeftLengthCm(6, 3, 4)).to.equal(2);
  });

  it('formatLength 单位格式化', function () {
    expect(YarnEstimate.formatLength(150)).to.equal('1.50 m');
    expect(YarnEstimate.formatLength(50.123)).to.equal('50.1 cm');
    expect(YarnEstimate.formatLength(null)).to.equal('-');
  });

  it('computePerThreadEstimate 完整估算：无损模式验证累加', function () {
    const threads = [
      { id: 't_red', name: '红', color: '#ff0000', order: 0 },
      { id: 't_blue', name: '蓝', color: '#0000ff', order: 1 },
      { id: 't_green', name: '绿', color: '#00ff00', order: 2 }
    ];
    const cols = 4, rows = 3;
    const cells = [
      't_red', 't_red', 't_blue', 't_blue',
      't_red', 't_red', 't_blue', 't_blue',
      't_green', 't_green', 't_green', 't_green'
    ];
    const scheme = {
      cols, rows, estimateConfig: {
        defaultLossFactor: 1.0, defaultSafetyMargin: 0,
        cellSizeMm: 2.0, warpDensity: 5.0, weftDensity: 5.0
      }
    };

    const result = YarnEstimate.computePerThreadEstimate({
      cells, cols, rows, threads, scheme
    });

    expect(result.totals.cellCount).to.equal(12);
    let sumBase = 0;
    result.estimates.forEach(e => { sumBase += e.baseTotalCm; });
    expect(sumBase).to.be.closeTo(12.0, 0.01);
    expect(result.totals.baseTotalCm).to.be.closeTo(12.0, 0.01);
    expect(result.totals.withLossCm).to.be.closeTo(12.0, 0.01);
    expect(result.totals.withSafetyCm).to.be.closeTo(12.0, 0.01);
    expect(result.totals.recommendedMeters).to.be.closeTo(0.12, 0.001);

    const green = result.estimates.find(e => e.id === 't_green');
    expect(green).to.not.be.undefined;
    expect(green.cellCount).to.equal(4);
  });

  it('computePerThreadEstimate 未使用色线不出现在结果中', function () {
    const threads = [
      { id: 't_red', name: '红', color: '#ff0000', order: 0 },
      { id: 't_blue', name: '蓝', color: '#0000ff', order: 1 },
      { id: 't_green', name: '绿', color: '#00ff00', order: 2 }
    ];
    const cols = 2, rows = 2;
    const cells = ['t_red', 't_blue', 't_red', 't_blue'];
    const scheme = { cols, rows, estimateConfig: null };

    const result = YarnEstimate.computePerThreadEstimate({
      cells, cols, rows, threads, scheme
    });
    const ids = result.estimates.map(e => e.id);
    expect(ids).to.include('t_red');
    expect(ids).to.include('t_blue');
    expect(ids).to.not.include('t_green');
  });
});

describe('BlockStore (纯函数部分)', function () {
  it('createEmptyPattern 全 false', function () {
    const p = BlockStore.createEmptyPattern(3, 2);
    expect(p).to.have.lengthOf(6);
    expect(p.every(v => v === false)).to.be.true;
  });

  it('rotatePattern90 顺时针 90°', function () {
    const pattern = [
      true, false,
      false, true
    ];
    const r = BlockStore.rotatePattern90(pattern, 2, 2);
    expect(r.cols).to.equal(2);
    expect(r.rows).to.equal(2);
    expect(r.pattern).to.deep.equal([
      false, true,
      true, false
    ]);
  });

  it('flipPatternHorizontal 水平翻转', function () {
    const pattern = [true, false, true, false, true, false];
    const r = BlockStore.flipPatternHorizontal(pattern, 3, 2);
    expect(r.pattern).to.deep.equal([true, false, true, false, true, false]);

    const p2 = [true, true, false, false, true, true];
    const r2 = BlockStore.flipPatternHorizontal(p2, 3, 2);
    expect(r2.pattern).to.deep.equal([false, true, true, true, true, false]);
  });

  it('flipPatternVertical 垂直翻转', function () {
    const pattern = [
      true, true,
      false, false,
      true, true
    ];
    const r = BlockStore.flipPatternVertical(pattern, 2, 3);
    expect(r.pattern).to.deep.equal([
      true, true,
      false, false,
      true, true
    ]);

    const p2 = [
      true, true,
      true, true,
      false, false
    ];
    const r2 = BlockStore.flipPatternVertical(p2, 2, 3);
    expect(r2.pattern).to.deep.equal([
      false, false,
      true, true,
      true, true
    ]);
  });
});
