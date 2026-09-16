// ===========================================================================
// VALIDATE — the single source of truth for "is this schedule legal?"
//
// Both the auto-allocator and the hand-editing screen call into this same
// file, so there is only ever one definition of each rule.
//
// An assigned week looks like: { week: 23, method: "seniority" }
// where method is one of:
//   "seniority"     — won through normal seniority bidding
//   "lottery"       — one of the 4 rotation weeks
//   "manual"        — placed by hand by an admin
//   "extra-request" — granted through an approved extra-week request
// ===========================================================================

function hasWeek(employee, weekNumber) {
  return employee.assignedWeeks.some(function (a) { return a.week === weekNumber; });
}

// weekNumber -> array of employee ids on vacation that week.
// Used by the coverage rule, the allocator, and the dashboard chart.
function weekOccupancy(employees, weeks) {
  var occupancy = {};
  weeks.forEach(function (w) { occupancy[w.weekNumber] = []; });

  employees.forEach(function (employee) {
    employee.assignedWeeks.forEach(function (assignment) {
      if (occupancy[assignment.week]) {
        occupancy[assignment.week].push(employee.id);
      }
    });
  });

  return occupancy;
}

function approvedExtraCount(employeeId, requests) {
  if (!requests) return 0;
  return requests.filter(function (r) {
    return r.employeeId === employeeId && r.status === "approved";
  }).length;
}

// An employee's real ceiling: their tier maximum, raised by any approved
// extra-week requests. Returns null when there is no ceiling at all.
function effectiveMaxWeeks(employee, requests) {
  if (employee.maxWeeks === null || employee.maxWeeks === undefined) return null;
  return employee.maxWeeks + approvedExtraCount(employee.id, requests);
}

function summerWeekCountFor(employee, weeks) {
  var isSummer = {};
  weeks.forEach(function (w) { if (w.isSummer) isSummer[w.weekNumber] = true; });

  return employee.assignedWeeks.filter(function (a) {
    return isSummer[a.week];
  }).length;
}

// ---------------------------------------------------------------------------
// The main check. Returns a list of violations, each one:
//   { type, severity, message, employeeId, weekNumber }
// severity is "error" (breaks a rule) or "warning" (worth a look).
// ---------------------------------------------------------------------------
function validateSchedule(employees, weeks, rules, requests) {
  var violations = [];

  function report(type, severity, message, employeeId, weekNumber) {
    violations.push({
      type: type,
      severity: severity,
      message: message,
      employeeId: employeeId || null,
      weekNumber: weekNumber === undefined ? null : weekNumber
    });
  }

  // ---- 1. Nobody below their minimum -------------------------------------
  employees.forEach(function (employee) {
    var total = employee.assignedWeeks.length;
    if (total < employee.minWeeks) {
      report("under-minimum", "error",
        employee.name + " has " + total + " weeks, below the minimum of " +
        employee.minWeeks + ".", employee.id);
    }
  });

  // ---- 2. Nobody above their maximum -------------------------------------
  // The 14 non-senior employees have no ceiling, so they are never flagged.
  employees.forEach(function (employee) {
    var ceiling = effectiveMaxWeeks(employee, requests);
    if (ceiling === null) return;

    var total = employee.assignedWeeks.length;
    if (total > ceiling) {
      var granted = approvedExtraCount(employee.id, requests);
      var explain = granted > 0
        ? " (" + employee.maxWeeks + " allowed plus " + granted + " approved extra)"
        : "";
      report("over-maximum", "error",
        employee.name + " has " + total + " weeks, above their maximum of " +
        ceiling + explain + ".", employee.id);
    }
  });

  // ---- 3. Never more than the coverage cap out in one week ---------------
  var occupancy = weekOccupancy(employees, weeks);
  weeks.forEach(function (week) {
    var onVacation = occupancy[week.weekNumber].length;
    if (onVacation > rules.maxConcurrentOnVacation) {
      report("coverage", "error",
        "Week " + week.weekNumber + " (" + week.label + ") has " + onVacation +
        " people on vacation, over the cap of " + rules.maxConcurrentOnVacation + ".",
        null, week.weekNumber);
    }
  });

  // ---- 4. Lottery weeks must not be won through seniority ----------------
  var isLottery = {};
  weeks.forEach(function (w) {
    if (w.isExcludedFromSeniority) isLottery[w.weekNumber] = w;
  });

  employees.forEach(function (employee) {
    employee.assignedWeeks.forEach(function (assignment) {
      var week = isLottery[assignment.week];
      if (week && assignment.method === "seniority") {
        report("excluded-week", "error",
          employee.name + " was given week " + assignment.week + " (" +
          week.holidays.join(", ") + ") through seniority, but it must be " +
          "assigned by lottery.", employee.id, assignment.week);
      }
    });
  });

  // ---- 5. Seniors should not end up with less summer than everyone else --
  // A warning, not a hard rule — the senior tier is meant to have summer
  // priority, so this catches an allocation that quietly inverted it.
  var seniors = employees.filter(function (e) { return e.isSeniorTier; });
  var others = employees.filter(function (e) { return !e.isSeniorTier; });

  if (seniors.length > 0 && others.length > 0) {
    var otherSummerTotal = others.reduce(function (sum, e) {
      return sum + summerWeekCountFor(e, weeks);
    }, 0);
    var otherAverage = otherSummerTotal / others.length;

    seniors.forEach(function (senior) {
      var mine = summerWeekCountFor(senior, weeks);
      if (mine < otherAverage) {
        report("summer-imbalance", "warning",
          senior.name + " (senior tier) has " + mine + " summer weeks, fewer " +
          "than the " + otherAverage.toFixed(1) + " average for non-senior staff.",
          senior.id);
      }
    });
  }

  return violations;
}

function errorsOnly(violations) {
  return violations.filter(function (v) { return v.severity === "error"; });
}

function warningsOnly(violations) {
  return violations.filter(function (v) { return v.severity === "warning"; });
}
