/*
  Re-runs a datasource-backed select when the setting it depends on changes,
  so a channel list follows the bus without a manual refresh. The manual
  refresh button stays available.

  Usage: <script src="auto-refresh.js" data-deps='{"bus":["channel"]}'></script>
  data-deps maps a source setting to the settings whose lists reload.
*/
(function () {
  var script = document.currentScript;
  var deps;
  try { deps = JSON.parse(script.getAttribute("data-deps") || "{}"); } catch (e) { deps = {}; }

  function host(setting) {
    return document.querySelector('[setting="' + setting + '"]');
  }

  function current(setting) {
    var h = host(setting);
    if (!h) return undefined;
    var v = h.value;
    if (v === undefined || v === null || v === "") {
      var inner = h.querySelector("select,input");
      v = inner ? inner.value : undefined;
    }
    return v === undefined || v === null ? undefined : String(v);
  }

  var last = {};
  var timers = {};

  function reload(source) {
    clearTimeout(timers[source]);
    // The component persists the new value first; the plugin reads it when
    // answering the datasource request, so the reload waits a moment.
    timers[source] = setTimeout(function () {
      (deps[source] || []).forEach(function (target) {
        var h = host(target);
        if (h && typeof h.refresh === "function") h.refresh();
      });
    }, 200);
  }

  function tick() {
    Object.keys(deps).forEach(function (source) {
      var v = current(source);
      if (v === undefined) return;
      if (!(source in last)) { last[source] = v; return; }
      if (v !== last[source]) { last[source] = v; reload(source); }
    });
  }

  document.addEventListener("change", tick, true);
  setInterval(tick, 250);
})();
