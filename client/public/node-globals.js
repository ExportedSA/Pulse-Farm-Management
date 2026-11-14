// Node.js globals that some bundled libraries expect in the browser. Loaded as its own file,
// not inline in index.html, because the live security policy (helmet CSP) blocks inline scripts.
window.global = window;
window.process = window.process || {
  env: {},
  nextTick: function (fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    queueMicrotask(function () { fn.apply(null, args); });
  },
};
window.Buffer = window.Buffer || { isBuffer: function () { return false; } };
