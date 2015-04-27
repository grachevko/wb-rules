// -*- mode: js2-mode -*-

defineRule("startTimer", {
  asSoonAs: function () {
    return dev.somedev.foo == "t";
  },
  then: function () {
    // make sure it's possible to start more than one timer
    // simultaneously
    startTimer("sometimer", 500);
    startTimer("sometimer1", 500);
  }
});

defineRule("startTicker", {
  asSoonAs: function () {
    return dev.somedev.foo == "p";
  },
  then: function () {
    startTicker("sometimer", 500);
    stopTimer("sometimer1");
  }
});

defineRule("stopTimer", {
  asSoonAs: function () {
    return dev.somedev.foo == "s";
  },
  then: function () {
    timers.sometimer.stop();
    timers.sometimer1.stop();
  }
});

defineRule("timer", {
  when: function () {
    return timers.sometimer.firing;
  },
  then: function () {
    log("timer fired");
  }
});

defineRule("timer1", {
  when: function () {
    return timers.sometimer1.firing;
  },
  then: function () {
    log("timer1 fired");
  }
});

// setTimeout / setInterval based timers

var timer = null, timer1 = null;

defineRule("startTimer1", {
  asSoonAs: function () {
    return dev.somedev.foo == "+t";
  },
  then: function () {
    if (timer)
      clearTimeout(timer);
    if (timer1 != null)
      clearTimeout(timer1);
    timer = setTimeout(function () {
      timer = null;
      log("timer fired");
    }, 500);
    timer1 = setTimeout(function () {
      timer = null;
      log("timer1 fired");
    }, 500);
  }
});

defineRule("startTicker1", {
  asSoonAs: function () {
    return dev.somedev.foo == "+p";
  },
  then: function () {
    if (timer)
      clearTimeout(timer);
    if (timer1) {
      clearTimeout(timer1);
      timer1 = null;
    }
    timer = setInterval(function () {
      log("timer fired");
    }, 500);
  }
});

defineRule("stopTimer1", {
  asSoonAs: function () {
    return dev.somedev.foo == "+s";
  },
  then: function () {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (timer1) {
      clearTimeout(timer1);
      timer1 = null;
    }
  }
});
