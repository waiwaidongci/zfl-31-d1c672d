const VersionTimelineUI = (function() {

  var _container = null;
  var _currentSchemeId = null;
  var _selectedVersionId = null;

  function init(options) {
    _container = options.container || null;
    if (!_container) return;

    EventBus.on("version:created", function() { refresh(); });
    EventBus.on("version:deleted", function() { refresh(); });
    EventBus.on("version:restored", function() { refresh(); });
    EventBus.on("scheme:saved", function() { refresh(); });
    EventBus.on("playback:changed", _handlePlaybackChange);
    EventBus.on("playback:speedChanged", _handleSpeedChanged);
    EventBus.on("playback:directionChanged", _handleDirectionChanged);
  }

  function refresh() {
    if (!_container) return;

    var activeId = SchemeStore.getActiveId();
    if (activeId !== _currentSchemeId) {
      _currentSchemeId = activeId;
      _selectedVersionId = null;
      VersionHistory.stopPlayback();
    }

    var versions = VersionHistory.getVersions(activeId);
    var playbackState = VersionHistory.getPlaybackState();

    var html = '';

    if (versions.length > 0) {
      html += _renderPlaybackControls(versions, playbackState);
    }

    if (versions.length === 0) {
      html += '<div class="vt-empty">保存方案时自动记录版本快照</div>';
    } else {
      html += '<div class="vt-timeline">';

      versions.forEach(function(v, idx) {
        var isActive = v.id === _selectedVersionId;
        var isPlaying = playbackState.isPlaying && playbackState.currentIndex === idx;
        var label = v.label || _formatTime(v.timestamp);
        var riskClass = v.riskRows && v.riskRows.length > 0 ? 'has-risk' : '';
        var riskText = v.riskRows && v.riskRows.length > 0
          ? v.riskRows.length + '行风险'
          : '无风险';

        html += '<div class="vt-node ' + (isActive ? 'active' : '') + ' ' + (isPlaying ? 'playing' : '') + ' ' + riskClass + '" data-vid="' + v.id + '" data-idx="' + idx + '">';
        html += '  <div class="vt-node-line"></div>';
        html += '  <div class="vt-node-dot"></div>';
        html += '  <div class="vt-node-card">';
        html += '    <div class="vt-card-header">';
        html += '      <span class="vt-label">' + _escHtml(label) + '</span>';
        html += '      <span class="vt-index">#' + (idx + 1) + '</span>';
        html += '    </div>';

        if (v.thumbnailData) {
          html += _renderThumbnail(v.thumbnailData);
        }

        html += '    <div class="vt-card-stats">';
        html += '      <span class="vt-size">' + v.cols + '×' + v.rows + '</span>';
        html += '      <span class="vt-risk-badge ' + riskClass + '">' + riskText + '</span>';
        html += '    </div>';

        if (v.colorStats && v.colorStats.length > 0) {
          html += '    <div class="vt-card-colors">';
          v.colorStats.forEach(function(cs) {
            if (cs.count > 0) {
              html += '<div class="vt-color-chip" style="background:' + cs.color + '" title="' + _escHtml(cs.name) + ': ' + cs.count + '格"></div>';
            }
          });
          html += '    </div>';
        }

        html += '    <div class="vt-card-actions">';
        html += '      <button class="vt-btn vt-btn-restore" data-vid="' + v.id + '" data-action="restore">恢复为新方案</button>';
        html += '      <button class="vt-btn vt-btn-label" data-vid="' + v.id + '" data-action="label">标记</button>';
        html += '      <button class="vt-btn vt-btn-delete" data-vid="' + v.id + '" data-action="delete">删除</button>';
        html += '    </div>';

        html += '  </div>';
        html += '</div>';
      });

      html += '</div>';
    }

    if (_selectedVersionId) {
      html += _renderDetailPanel(activeId, _selectedVersionId);
    }

    _container.innerHTML = html;
    _bindEvents(activeId);
  }

  function _renderPlaybackControls(versions, playbackState) {
    var total = versions.length;
    var currentIdx = playbackState.currentIndex;
    var isPlaying = playbackState.isPlaying;
    var speed = playbackState.speed;
    var direction = playbackState.direction;

    var html = '<div class="vt-playback">';
    html += '  <div class="vt-playback-header">';
    html += '    <span class="vt-playback-title">⏱ 时间线回放</span>';
    html += '    <span class="vt-playback-count">' + (currentIdx >= 0 ? currentIdx + 1 : 0) + ' / ' + total + '</span>';
    html += '  </div>';

    html += '  <div class="vt-playback-progress">';
    html += '    <input type="range" min="0" max="' + (total - 1) + '" value="' + (currentIdx >= 0 ? currentIdx : 0) + '" class="vt-progress-slider" data-action="seek">';
    html += '  </div>';

    html += '  <div class="vt-playback-buttons">';
    html += '    <button class="vt-pb-btn" data-action="prev" title="上一版本">⏮</button>';
    if (isPlaying) {
      html += '    <button class="vt-pb-btn vt-pb-play" data-action="pause" title="暂停">⏸</button>';
    } else {
      html += '    <button class="vt-pb-btn vt-pb-play" data-action="play" title="播放">▶</button>';
    }
    html += '    <button class="vt-pb-btn" data-action="next" title="下一版本">⏭</button>';
    html += '    <button class="vt-pb-btn" data-action="stop" title="停止">⏹</button>';
    html += '  </div>';

    html += '  <div class="vt-playback-settings">';
    html += '    <div class="vt-speed-control">';
    html += '      <label class="vt-speed-label">速度</label>';
    html += '      <button class="vt-speed-btn" data-speed="2000" data-action="speed">0.5x</button>';
    html += '      <button class="vt-speed-btn' + (speed === 1000 ? ' active' : '') + '" data-speed="1000" data-action="speed">1x</button>';
    html += '      <button class="vt-speed-btn' + (speed === 500 ? ' active' : '') + '" data-speed="500" data-action="speed">2x</button>';
    html += '      <button class="vt-speed-btn' + (speed === 250 ? ' active' : '') + '" data-speed="250" data-action="speed">4x</button>';
    html += '    </div>';
    html += '    <div class="vt-direction-control">';
    html += '      <button class="vt-dir-btn' + (direction === 'forward' ? ' active' : '') + '" data-action="dir-forward" title="正序">⏩</button>';
    html += '      <button class="vt-dir-btn' + (direction === 'backward' ? ' active' : '') + '" data-action="dir-backward" title="倒序">⏪</button>';
    html += '    </div>';
    html += '  </div>';

    var playingVersion = currentIdx >= 0 ? versions[currentIdx] : null;
    if (playingVersion && playingVersion.thumbnailData) {
      html += '  <div class="vt-playback-preview">';
      html += '    <div class="vt-playback-preview-title">' + _escHtml(playingVersion.label || _formatTime(playingVersion.timestamp)) + '</div>';
      html += _renderLargeThumbnail(playingVersion.thumbnailData);
      html += '    <div class="vt-playback-preview-meta">';
      html += '      <span>' + playingVersion.cols + '×' + playingVersion.rows + '</span>';
      html += '      <span class="vt-risk-badge ' + (playingVersion.riskRows && playingVersion.riskRows.length > 0 ? 'has-risk' : '') + '">';
      html += (playingVersion.riskRows && playingVersion.riskRows.length > 0 ? playingVersion.riskRows.length + '行风险' : '无风险');
      html += '      </span>';
      html += '    </div>';
      html += '  </div>';
    }

    html += '</div>';
    return html;
  }

  function _renderThumbnail(thumbData) {
    if (!thumbData || !thumbData.colors) return '';
    var html = '<div class="vt-thumbnail" style="grid-template-columns:repeat(' + thumbData.cols + ',1fr)">';
    thumbData.colors.forEach(function(color) {
      html += '<div class="vt-thumb-cell" style="background:' + color + '"></div>';
    });
    html += '</div>';
    return html;
  }

  function _renderLargeThumbnail(thumbData) {
    if (!thumbData || !thumbData.colors) return '';
    var html = '<div class="vt-playback-thumb" style="grid-template-columns:repeat(' + thumbData.cols + ',1fr)">';
    thumbData.colors.forEach(function(color) {
      html += '<div class="vt-pb-thumb-cell" style="background:' + color + '"></div>';
    });
    html += '</div>';
    return html;
  }

  function _renderDetailPanel(schemeId, versionId) {
    var version = VersionHistory.getVersion(schemeId, versionId);
    if (!version) return '';

    var html = '<div class="vt-detail">';
    html += '  <div class="vt-detail-header">';
    html += '    <h3>版本详情</h3>';
    html += '    <button class="vt-detail-close" data-action="close-detail" data-vid="' + version.id + '">✕</button>';
    html += '  </div>';

    html += '  <div class="vt-detail-time">' + _formatDateTime(version.timestamp) + '</div>';

    if (version.thumbnailData) {
      html += _renderThumbnail(version.thumbnailData);
    }

    html += '  <div class="vt-detail-section"><h4>用色统计</h4>';
    if (version.colorStats) {
      version.colorStats.forEach(function(cs) {
        html += '<div class="vt-detail-stat">';
        html += '  <span style="display:inline-block;width:14px;height:14px;background:' + cs.color + ';border-radius:2px;vertical-align:middle"></span> ';
        html += '  <span>' + _escHtml(cs.name) + '</span>';
        html += '  <b>' + cs.count + '</b>';
        html += '</div>';
      });
    }
    html += '  </div>';

    html += '  <div class="vt-detail-section"><h4>断线风险</h4>';
    if (version.riskRows && version.riskRows.length > 0) {
      html += '<p class="warning">第' + version.riskRows.join("、") + '行换色过密，可能断线。</p>';
    } else {
      html += '<p>暂无明显断线风险。</p>';
    }
    html += '  </div>';

    html += '  <div class="vt-detail-actions">';
    html += '    <button class="vt-btn vt-btn-restore" data-vid="' + version.id + '" data-action="restore">恢复为新方案</button>';
    html += '  </div>';

    html += '</div>';
    return html;
  }

  function _bindEvents(schemeId) {
    if (!_container) return;

    _container.querySelectorAll("[data-vid]").forEach(function(el) {
      el.addEventListener("click", function(e) {
        var btn = e.target.closest("[data-action]");
        var vid = el.dataset.vid || (btn ? btn.dataset.vid : null);

        if (btn) {
          e.stopPropagation();
          var action = btn.dataset.action;
          if (action === "close-detail") {
            _selectedVersionId = null;
            refresh();
            return;
          }
          if (!vid) return;
          if (action === "restore") {
            _handleRestore(schemeId, vid);
          } else if (action === "label") {
            _handleLabel(schemeId, vid);
          } else if (action === "delete") {
            _handleDelete(schemeId, vid);
          }
        } else {
          if (!vid) return;
          _selectedVersionId = vid;
          var idx = Number(el.dataset.idx);
          if (!isNaN(idx)) {
            VersionHistory.goToVersion(schemeId, idx);
          }
          refresh();
        }
      });
    });

    var playBtn = _container.querySelector('[data-action="play"]');
    if (playBtn) {
      playBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        var state = VersionHistory.getPlaybackState();
        if (state.currentIndex >= 0) {
          VersionHistory.resumePlayback();
        } else {
          VersionHistory.startPlayback(schemeId, 0);
        }
      });
    }

    var pauseBtn = _container.querySelector('[data-action="pause"]');
    if (pauseBtn) {
      pauseBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        VersionHistory.pausePlayback();
      });
    }

    var stopBtn = _container.querySelector('[data-action="stop"]');
    if (stopBtn) {
      stopBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        VersionHistory.stopPlayback();
        refresh();
      });
    }

    var prevBtn = _container.querySelector('[data-action="prev"]');
    if (prevBtn) {
      prevBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        VersionHistory.prevVersion(schemeId);
      });
    }

    var nextBtn = _container.querySelector('[data-action="next"]');
    if (nextBtn) {
      nextBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        VersionHistory.nextVersion(schemeId);
      });
    }

    var slider = _container.querySelector('[data-action="seek"]');
    if (slider) {
      slider.addEventListener("input", function(e) {
        e.stopPropagation();
        var idx = Number(e.target.value);
        VersionHistory.goToVersion(schemeId, idx);
      });
    }

    var speedBtns = _container.querySelectorAll('[data-action="speed"]');
    speedBtns.forEach(function(btn) {
      btn.addEventListener("click", function(e) {
        e.stopPropagation();
        var speed = Number(btn.dataset.speed);
        VersionHistory.setPlaybackSpeed(speed);
      });
    });

    var dirForwardBtn = _container.querySelector('[data-action="dir-forward"]');
    if (dirForwardBtn) {
      dirForwardBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        VersionHistory.setPlaybackDirection('forward');
      });
    }

    var dirBackwardBtn = _container.querySelector('[data-action="dir-backward"]');
    if (dirBackwardBtn) {
      dirBackwardBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        VersionHistory.setPlaybackDirection('backward');
      });
    }
  }

  function _handlePlaybackChange() {
    refresh();
  }

  function _handleSpeedChanged() {
    refresh();
  }

  function _handleDirectionChanged() {
    refresh();
  }

  function _handleRestore(schemeId, versionId) {
    var newScheme = VersionHistory.restoreAsNewScheme(schemeId, versionId);
    if (newScheme && typeof EventBus !== "undefined") {
      EventBus.emit("scheme:switchRequested", newScheme.id);
    }
  }

  function _handleLabel(schemeId, versionId) {
    var version = VersionHistory.getVersion(schemeId, versionId);
    if (!version) return;
    var currentLabel = version.label || "";
    var newLabel = prompt("为版本添加标记名称：", currentLabel);
    if (newLabel === null) return;
    VersionHistory.updateLabel(schemeId, versionId, newLabel.trim());
    refresh();
  }

  function _handleDelete(schemeId, versionId) {
    if (!confirm("确定删除此版本快照吗？")) return;
    VersionHistory.deleteVersion(schemeId, versionId);
    if (_selectedVersionId === versionId) _selectedVersionId = null;
    refresh();
  }

  function _formatTime(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "/" +
      String(d.getMonth() + 1).padStart(2, "0") + "/" +
      String(d.getDate()).padStart(2, "0") + " " +
      String(d.getHours()).padStart(2, "0") + ":" +
      String(d.getMinutes()).padStart(2, "0");
  }

  function _formatDateTime(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "/" +
      String(d.getMonth() + 1).padStart(2, "0") + "/" +
      String(d.getDate()).padStart(2, "0") + " " +
      String(d.getHours()).padStart(2, "0") + ":" +
      String(d.getMinutes()).padStart(2, "0") + ":" +
      String(d.getSeconds()).padStart(2, "0");
  }

  function _escHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    init: init,
    refresh: refresh
  };
})();
