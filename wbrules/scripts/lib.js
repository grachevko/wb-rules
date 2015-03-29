// rule engine runtime
var _WbRules = {
  requireCompleteCells: 0,
  timers: {},

  IncompleteCellCaught: (function () {
    function IncompleteCellCaught(cellName) {
      this.name = "IncompleteCellCaught";
      this.message = "incomplete cell encountered: " + cellName;
    }
    IncompleteCellCaught.prototype = Object.create(Error.prototype);
    return IncompleteCellCaught;
  })(),

  autoload: function (target, acquire, setValue) {
    return new Proxy(target, {
      get: function (o, name) {
        if (!(name in o)) {
          o[name] = acquire(name, o);
        }
        return o[name];
      },
      set: function (o, name, value) {
        throw new Error("setting unsupported proxy value: " + name);
      }
    });
  },

  wrapDevice: function (name) {
    var cells = {};
    function ensureCell (dev, name) {
      return cells.hasOwnProperty(name) ?
        cells[name] :
        cells[name] = _wbCellObject(dev, name);
    }
    return new Proxy(_wbDevObject(name), {
      get: function (dev, name) {
        var cell = ensureCell(dev, name);
        if (_WbRules.requireCompleteCells && !cell.isComplete())
          throw new _WbRules.IncompleteCellCaught(name);
        return cell.value().v;
      },
      set: function (dev, name, value) {
        ensureCell(dev, name).setValue({ v: value });
      }
    });
  },

  defineRule: function (name, def) {
    debug("defineRule: " + name);
    if (typeof name != "string" || typeof def != "object")
      throw new Error("invalid rule definition");
    var d = Object.create(def);
    Object.keys(def).forEach(function (k) {
      var orig = d[k];
      switch(k) {
      case "asSoonAs":
      case "when":
        d[k] = function () {
          _WbRules.requireCompleteCells++;
          try {
            return orig.apply(d, arguments);
          } catch (e) {
            if (e instanceof _WbRules.IncompleteCellCaught) {
              debug("skipping rule due to incomplete cells " + name + ": " + e);
              return false;
            }
            throw e;
          } finally {
            _WbRules.requireCompleteCells--;
          }
        };
        break;
      case "then":
        d[k] = function (options) {
          if (options)
            // TBD: pass options.oldValue too (needs test, do it
            // when implementing onValueChange)
            orig.call(d, options.device, options.cell, options.newValue);
          else
            orig.call(d);
        };
      }
    });
    _wbDefineRule(name, d);
  },

  startTimer: function startTimer(name, ms, periodic) {
    debug("starting timer: " + name);
    _wbStartTimer(name, ms, !!periodic);
  }
};

var dev = _WbRules.autoload({}, _WbRules.wrapDevice);
var timers = _WbRules.autoload(_WbRules.timers, function (name) {
  return {
    get firing() {
      return _wbCheckCurrentTimer(name);
    },
    stop: function () {
      _wbStopTimer(name);
    }
  };
});

defineRule = _WbRules.defineRule;

function startTimer (name, ms) {
  _WbRules.startTimer(name, ms, false);
}

function startTicker (name, ms) {
  _WbRules.startTimer(name, ms, true);
}

function setTimeout(callback, ms) {
  return _wbStartTimer(callback, ms, false);
}

function setInterval(callback, ms) {
  return _wbStartTimer(callback, ms, true);
}

function clearTimeout(id) {
  _wbStopTimer(id);
}

function clearInterval(id) {
  clearTimeout(id);
}

function spawn(cmd, args, options) {
  if (typeof options == "function")
    options = {
      exitCallback: options,
      captureOutput: false,
      captureErrorOutput: false
    };
  else if (!options)
    options = {
      exitCallback: null,
      captureOutput: false,
      captureErrorOutput: false
    };
  else {
    if (!options.hasOwnProperty("captureOutput"))
      options.captureOutput = false;
    if (!options.hasOwnProperty("captureErrorOutput"))
      options.captureErrorOutput = false;
  }

  if (options.input != null)
    options.input = "" + options.input;

  _wbSpawn([cmd].concat(args || []), options.exitCallback ? function (args) {
    try {
      options.exitCallback(
        args.exitStatus,
        options.captureOutput ? args.capturedOutput : null,
        args.capturedErrorOutput
      );
    } catch (e) {
      log("error running command callback for " + cmd + ": " + (e.stack || e));
    }
  } : null, !!options.captureOutput, !!options.captureErrorOutput, options.input);
}

function runShellCommand(cmd, options) {
  spawn("/bin/sh", ["-c", cmd], options);
}

// TBD: perhaps in non-debug mode, shouldn't even call go on debug()
