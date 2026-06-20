const RiskSettingsUI = (function() {

  let _toggleBtn = null;
  let _panel = null;
  let _highRiskThresholdInput = null;
  let _highRiskThresholdValue = null;
  let _mediumRiskThresholdInput = null;
  let _mediumRiskThresholdValue = null;
  let _countShortSegmentsInput = null;
  let _shortSegmentMaxLengthItem = null;
  let _shortSegmentMaxLengthInput = null;
  let _shortSegmentMaxLengthValue = null;
  let _resetBtn = null;
  let _isInitialized = false;

  function init(options) {
    if (_isInitialized) return;

    _toggleBtn = document.querySelector("#riskSettingsToggle");
    _panel = document.querySelector("#riskSettingsPanel");
    _highRiskThresholdInput = document.querySelector("#highRiskThreshold");
    _highRiskThresholdValue = document.querySelector("#highRiskThresholdValue");
    _mediumRiskThresholdInput = document.querySelector("#mediumRiskThreshold");
    _mediumRiskThresholdValue = document.querySelector("#mediumRiskThresholdValue");
    _countShortSegmentsInput = document.querySelector("#countShortSegments");
    _shortSegmentMaxLengthItem = document.querySelector("#shortSegmentMaxLengthItem");
    _shortSegmentMaxLengthInput = document.querySelector("#shortSegmentMaxLength");
    _shortSegmentMaxLengthValue = document.querySelector("#shortSegmentMaxLengthValue");
    _resetBtn = document.querySelector("#resetRiskSettings");

    if (!_toggleBtn || !_panel) {
      return;
    }

    if (typeof RiskConfig !== 'undefined') {
      RiskConfig.load();
    }

    _syncUI();
    _bindEvents();
    _isInitialized = true;
  }

  function _syncUI() {
    if (typeof RiskConfig === 'undefined') return;

    const config = RiskConfig.getAll();

    if (_highRiskThresholdInput) {
      _highRiskThresholdInput.value = config.highRiskThreshold;
      _highRiskThresholdInput.max = Math.max(0.95, config.highRiskThreshold);
    }
    if (_highRiskThresholdValue) {
      _highRiskThresholdValue.textContent = Math.round(config.highRiskThreshold * 100) + '%';
    }

    if (_mediumRiskThresholdInput) {
      _mediumRiskThresholdInput.value = config.mediumRiskThreshold;
      _mediumRiskThresholdInput.min = Math.min(0.1, config.mediumRiskThreshold);
    }
    if (_mediumRiskThresholdValue) {
      _mediumRiskThresholdValue.textContent = Math.round(config.mediumRiskThreshold * 100) + '%';
    }

    if (_countShortSegmentsInput) {
      _countShortSegmentsInput.checked = config.countShortSegments;
    }

    if (_shortSegmentMaxLengthItem) {
      _shortSegmentMaxLengthItem.style.display = config.countShortSegments ? '' : 'none';
    }

    if (_shortSegmentMaxLengthInput) {
      _shortSegmentMaxLengthInput.value = config.shortSegmentMaxLength;
    }
    if (_shortSegmentMaxLengthValue) {
      _shortSegmentMaxLengthValue.textContent = config.shortSegmentMaxLength + ' 格';
    }
  }

  function _bindEvents() {
    if (_toggleBtn) {
      _toggleBtn.addEventListener("click", _togglePanel);
    }

    if (_highRiskThresholdInput) {
      _highRiskThresholdInput.addEventListener("input", _handleHighRiskThresholdChange);
    }

    if (_mediumRiskThresholdInput) {
      _mediumRiskThresholdInput.addEventListener("input", _handleMediumRiskThresholdChange);
    }

    if (_countShortSegmentsInput) {
      _countShortSegmentsInput.addEventListener("change", _handleCountShortSegmentsChange);
    }

    if (_shortSegmentMaxLengthInput) {
      _shortSegmentMaxLengthInput.addEventListener("input", _handleShortSegmentMaxLengthChange);
    }

    if (_resetBtn) {
      _resetBtn.addEventListener("click", _handleReset);
    }

    if (typeof RiskConfig !== 'undefined') {
      RiskConfig.subscribe(_onConfigChanged);
    }
  }

  function _togglePanel() {
    if (!_panel) return;
    const isHidden = _panel.style.display === 'none';
    _panel.style.display = isHidden ? '' : 'none';
    if (isHidden) {
      _syncUI();
    }
  }

  function _handleHighRiskThresholdChange(e) {
    if (typeof RiskConfig === 'undefined') return;
    const value = parseFloat(e.target.value);
    if (RiskConfig.setHighRiskThreshold(value)) {
      if (_highRiskThresholdValue) {
        _highRiskThresholdValue.textContent = Math.round(value * 100) + '%';
      }
      if (_mediumRiskThresholdInput && value <= parseFloat(_mediumRiskThresholdInput.value)) {
        const newMedium = Math.max(0.1, value - 0.05);
        RiskConfig.setMediumRiskThreshold(newMedium);
        _mediumRiskThresholdInput.value = newMedium;
        if (_mediumRiskThresholdValue) {
          _mediumRiskThresholdValue.textContent = Math.round(newMedium * 100) + '%';
        }
      }
      _triggerRefresh();
    }
  }

  function _handleMediumRiskThresholdChange(e) {
    if (typeof RiskConfig === 'undefined') return;
    const value = parseFloat(e.target.value);
    if (RiskConfig.setMediumRiskThreshold(value)) {
      if (_mediumRiskThresholdValue) {
        _mediumRiskThresholdValue.textContent = Math.round(value * 100) + '%';
      }
      if (_highRiskThresholdInput && value >= parseFloat(_highRiskThresholdInput.value)) {
        const newHigh = Math.min(0.95, value + 0.05);
        RiskConfig.setHighRiskThreshold(newHigh);
        _highRiskThresholdInput.value = newHigh;
        if (_highRiskThresholdValue) {
          _highRiskThresholdValue.textContent = Math.round(newHigh * 100) + '%';
        }
      }
      _triggerRefresh();
    }
  }

  function _handleCountShortSegmentsChange(e) {
    if (typeof RiskConfig === 'undefined') return;
    const checked = e.target.checked;
    RiskConfig.setCountShortSegments(checked);
    if (_shortSegmentMaxLengthItem) {
      _shortSegmentMaxLengthItem.style.display = checked ? '' : 'none';
    }
    _triggerRefresh();
  }

  function _handleShortSegmentMaxLengthChange(e) {
    if (typeof RiskConfig === 'undefined') return;
    const value = parseInt(e.target.value);
    if (RiskConfig.setShortSegmentMaxLength(value)) {
      if (_shortSegmentMaxLengthValue) {
        _shortSegmentMaxLengthValue.textContent = value + ' 格';
      }
      _triggerRefresh();
    }
  }

  function _handleReset() {
    if (typeof RiskConfig === 'undefined') return;
    RiskConfig.reset();
    _syncUI();
    _triggerRefresh();
  }

  function _onConfigChanged(config) {
    if (_highRiskThresholdValue) {
      _highRiskThresholdValue.textContent = Math.round(config.highRiskThreshold * 100) + '%';
    }
    if (_mediumRiskThresholdValue) {
      _mediumRiskThresholdValue.textContent = Math.round(config.mediumRiskThreshold * 100) + '%';
    }
    if (_shortSegmentMaxLengthValue) {
      _shortSegmentMaxLengthValue.textContent = config.shortSegmentMaxLength + ' 格';
    }
    if (_shortSegmentMaxLengthItem) {
      _shortSegmentMaxLengthItem.style.display = config.countShortSegments ? '' : 'none';
    }
  }

  function _triggerRefresh() {
    if (typeof GridRender !== 'undefined') {
      GridRender.render();
    }
    if (typeof ProcessView !== 'undefined' && ProcessView.isProcessView()) {
      ProcessView.refresh();
    }
    if (typeof CompareView !== 'undefined') {
      CompareView.refresh();
    }
    EventBus.emit("risk:settingsChanged");
  }

  function refresh() {
    _syncUI();
    _triggerRefresh();
  }

  return {
    init: init,
    refresh: refresh
  };
})();
