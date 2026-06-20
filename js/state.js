const EventBus = (function() {
  var _listeners = {};

  function on(event, fn) {
    if (typeof fn !== "function") return;
    if (!_listeners[event]) _listeners[event] = [];
    if (_listeners[event].indexOf(fn) === -1) _listeners[event].push(fn);
  }

  function off(event, fn) {
    if (!_listeners[event]) return;
    var idx = _listeners[event].indexOf(fn);
    if (idx !== -1) _listeners[event].splice(idx, 1);
  }

  function emit(event) {
    var args = Array.prototype.slice.call(arguments, 1);
    var fns = _listeners[event];
    if (!fns || !fns.length) return;
    fns.forEach(function(fn) {
      try { fn.apply(null, args); } catch (e) {}
    });
  }

  return { on: on, off: off, emit: emit };
})();

const AppState = (function() {
  var dragging = false;

  function getActive() {
    return SchemeStore.getActive();
  }

  function getActiveId() {
    return SchemeStore.getActiveId();
  }

  return {
    get dragging() { return dragging; },
    set dragging(v) { dragging = v; },

    get cols() { return getActive().cols; },
    set cols(v) { SchemeStore.update(getActiveId(), { cols: v }); },

    get rows() { return getActive().rows; },
    set rows(v) { SchemeStore.update(getActiveId(), { rows: v }); },

    get cells() { return getActive().cells; },
    set cells(v) { SchemeStore.update(getActiveId(), { cells: v }); },

    get active() { return getActive().activeColor; },
    set active(v) { SchemeStore.update(getActiveId(), { activeColor: v }); },

    get block() { return getActive().activeBlock; },
    set block(v) { SchemeStore.update(getActiveId(), { activeBlock: v }); },

    get undo() { return getActive().undo; },
    set undo(v) { SchemeStore.update(getActiveId(), { undo: v }); },

    get redo() { return getActive().redo; },
    set redo(v) { SchemeStore.update(getActiveId(), { redo: v }); },

    resetHistory: function() {
      SchemeStore.update(getActiveId(), { undo: [], redo: [] });
    }
  };
})();
