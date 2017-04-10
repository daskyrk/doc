(function() {
  var moduleCache = {};

  var require = function(deps, callback) {
    var params = [];
    var depCount = 0;
    var i, len, modName;

    modName = document.currentScript && document.currentScript.id || 'REQUIRE_MAIN';

    if (deps.length) {
      for (i = 0, len = deps.length; i < len; i++) {
        (function(i) {
          depCount++;
          loadMod(deps[i], function(param) {
            params[i] = param;
            depCount--;
            if (depCount == 0) {
              saveModule(modName, params, callback);
            }
          });
        })(i);
      }
    } else {
      console.log("modName:",modName);
      setTimeout(function() {
        saveModule(modName, null, callback)
      }, 0);
    }

  };

  var _getPathUrl = function(modName) {
    var url = modName;
    if (url.indexOf('.js') == -1) url = url + '.js';
    return url;
  };

  var loadMod = function(modName, callback) {
    var url = _getPathUrl(modName),
      fs, mod;

    if (moduleCache[modName]) {
      mod = moduleCache[modName];
      if (mod.status == 'loaded') {
        setTimeout(callback(this.params), 0);
      } else {
        mod.onload.push(callback);
      }
    } else {

      mod = moduleCache[modName] = {
        modName: modName,
        status: 'loading',
        export: null,
        onload: [callback]
      };

      _script = document.createElement('script');
      _script.id = modName;
      _script.type = 'text/javascript';
      _script.charset = 'utf-8';
      _script.async = true;
      _script.src = url;

      fs = document.getElementsByTagName('script')[0];
      fs.parentNode.insertBefore(_script, fs);

    }
  };

  var saveModule = function(modName, params, callback) {
    var mod, fn;

    if (moduleCache.hasOwnProperty(modName)) {
      mod = moduleCache[modName];
      mod.status = 'loaded';
      mod.export = callback ? callback(params) : null;

      while (fn = mod.onload.shift()) {
        fn(mod.export);
      }
    } else {
      callback && callback.apply(window, params);
    }
  };

  window.require = require;
  window.define = require;

})();
