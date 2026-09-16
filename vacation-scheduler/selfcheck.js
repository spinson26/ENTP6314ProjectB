// ===========================================================================
// SELF-CHECKS — built-in correctness tests.
//
// This does the job a test tool would normally do, but runs inside the app
// itself so nothing has to be installed. Each check builds a small deliberate
// schedule and confirms the rules engine reacts the way it should.
// ===========================================================================

function cloneEmployees(employees) {
  return employees.map(function (e) {
    var copy = {};
    for (var key in e) { copy[key] = e[key]; }
    copy.assignedWeeks = e.assignedWeeks.map(function (a) {
      return { week: a.week, method: a.method };
    });
    return copy;
  });
}

function countType(violations, type) {
  return violations.filter(function (v) { return v.type === type; }).length;
}

// A deliberately legal schedule: the 4 seniors take summer weeks 23-31
// (exactly filling the coverage cap of 4), and the other 14 share the
// remaining weeks evenly. Everyone lands on exactly their 9-week minimum.
function buildCleanFixture(rules, weeks) {
  var employees = buildEmployees(rules);
  var seniorSummer = [23, 24, 25, 26, 27, 28, 29, 30, 31];

  var available = [];
  weeks.forEach(function (w) {
    if (seniorSummer.indexOf(w.weekNumber) === -1) available.push(w.weekNumber);
  });

  var nonSeniorIndex = 0;
  employees.forEach(function (employee) {
    if (employee.isSeniorTier) {
      employee.assignedWeeks = seniorSummer.map(function (week) {
        return { week: week, method: "manual" };
      });
    } else {
      var mine = [];
      for (var k = 0; k < rules.minWeeksPerEmployee; k++) {
        var slot = (nonSeniorIndex * rules.minWeeksPerEmployee + k) % available.length;
        mine.push({ week: available[slot], method: "manual" });
      }
      employee.assignedWeeks = mine;
      nonSeniorIndex++;
    }
  });

  return employees;
}

// Everyone gets 9 weeks in a simple rotation around the year. Legal on every
// count except that two of the seniors end up with no summer at all.
function buildRotationFixture(rules, weeks) {
  var employees = buildEmployees(rules);

  employees.forEach(function (employee, i) {
    var mine = [];
    for (var k = 0; k < rules.minWeeksPerEmployee; k++) {
      var week = ((i * rules.minWeeksPerEmployee + k) % weeks.length) + 1;
      mine.push({ week: week, method: "manual" });
    }
    employee.assignedWeeks = mine;
  });

  return employees;
}

function runSelfChecks() {
  var rules = RULES;
  var weeks = buildCalendar(rules.year, rules);
  var results = [];

  function assert(label, passed, detail) {
    results.push({ label: label, passed: passed, detail: detail });
  }

  // ---- Calendar --------------------------------------------------------
  var lottery = lotteryWeekNumbers(weeks);
  var summer = summerWeekNumbers(weeks);

  assert("Calendar has exactly 52 weeks",
    weeks.length === 52, weeks.length + " weeks");

  assert("Exactly " + rules.summerWeekCount + " summer weeks",
    summer.length === rules.summerWeekCount,
    "weeks " + summer.join(", "));

  assert("4 distinct lottery weeks",
    lottery.length === 4, "weeks " + lottery.join(", "));

  assert("No week is both summer and lottery",
    weeks.every(function (w) { return !(w.isSummer && w.isExcludedFromSeniority); }),
    "checked all 52 weeks");

  // ---- Employees -------------------------------------------------------
  var roster = buildEmployees(rules);
  assert("18 employees, 4 of them senior tier",
    roster.length === 18 && roster.filter(function (e) { return e.isSeniorTier; }).length === 4,
    roster.length + " employees");

  assert("The 14 non-senior employees have no ceiling",
    roster.filter(function (e) { return !e.isSeniorTier; })
          .every(function (e) { return e.maxWeeks === null; }),
    "maxWeeks is null for all 14");

  // ---- A legal schedule should come back completely clean ---------------
  var clean = buildCleanFixture(rules, weeks);
  var cleanResult = validateSchedule(clean, weeks, rules, []);

  assert("A legal schedule reports zero errors",
    errorsOnly(cleanResult).length === 0,
    errorsOnly(cleanResult).length + " errors");

  assert("A legal schedule reports zero warnings",
    warningsOnly(cleanResult).length === 0,
    warningsOnly(cleanResult).length + " warnings");

  // ---- Each rule must catch its own violation ---------------------------

  // Under the minimum
  var under = cloneEmployees(clean);
  under[5].assignedWeeks = under[5].assignedWeeks.slice(0, 6);
  assert("Catches someone below the 9-week minimum",
    countType(validateSchedule(under, weeks, rules, []), "under-minimum") === 1,
    under[5].name + " given 6 weeks");

  // Over the maximum (senior tier only)
  var over = cloneEmployees(clean);
  var spare = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  spare.forEach(function (week) {
    over[0].assignedWeeks.push({ week: week, method: "manual" });
  });
  assert("Catches a senior above their 17-week maximum",
    countType(validateSchedule(over, weeks, rules, []), "over-maximum") === 1,
    over[0].name + " given " + over[0].assignedWeeks.length + " weeks");

  // A non-senior well past the senior ceiling must NOT be flagged
  var overNonSenior = cloneEmployees(clean);
  weeks.forEach(function (w) {
    if (!hasWeek(overNonSenior[4], w.weekNumber)) {
      overNonSenior[4].assignedWeeks.push({ week: w.weekNumber, method: "manual" });
    }
  });
  assert("Does NOT flag a non-senior for having many weeks",
    overNonSenior[4].assignedWeeks.length > rules.seniorTierMaxWeeks &&
    countType(validateSchedule(overNonSenior, weeks, rules, []), "over-maximum") === 0,
    overNonSenior[4].name + " given " + overNonSenior[4].assignedWeeks.length +
    " weeks (past the senior cap of " + rules.seniorTierMaxWeeks + "), not flagged");

  // An approved extra-week request raises the ceiling
  var withRequest = cloneEmployees(clean);
  for (var e = 0; e < 8; e++) {
    withRequest[0].assignedWeeks.push({ week: e + 1, method: "manual" });
  }
  var atSeventeen = validateSchedule(withRequest, weeks, rules, []);
  withRequest[0].assignedWeeks.push({ week: 9, method: "extra-request" });
  var approved = [{ id: "r1", employeeId: withRequest[0].id, weekNumber: 9, status: "approved" }];
  assert("An approved extra week raises a senior's ceiling",
    countType(atSeventeen, "over-maximum") === 0 &&
    countType(validateSchedule(withRequest, weeks, rules, approved), "over-maximum") === 0,
    "18 weeks allowed with 1 approved request");

  // Coverage cap
  var crowded = cloneEmployees(clean);
  crowded.forEach(function (employee) {
    if (employee.isSeniorTier) {
      employee.assignedWeeks.push({ week: 40, method: "manual" });
    }
  });
  assert("Catches more than " + rules.maxConcurrentOnVacation + " people out in one week",
    countType(validateSchedule(crowded, weeks, rules, []), "coverage") >= 1,
    "week 40 deliberately overfilled");

  // Lottery week won through seniority
  var stolen = cloneEmployees(clean);
  stolen[0].assignedWeeks.push({ week: lottery[0], method: "seniority" });
  assert("Catches a lottery week handed out by seniority",
    countType(validateSchedule(stolen, weeks, rules, []), "excluded-week") === 1,
    "week " + lottery[0] + " taken by seniority");

  // The same week claimed by lottery is fine
  var byLottery = cloneEmployees(clean);
  byLottery[0].assignedWeeks.push({ week: lottery[0], method: "lottery" });
  assert("Allows a lottery week assigned by lottery",
    countType(validateSchedule(byLottery, weeks, rules, []), "excluded-week") === 0,
    "week " + lottery[0] + " assigned correctly");

  // Summer imbalance warning
  var rotation = buildRotationFixture(rules, weeks);
  var rotationResult = validateSchedule(rotation, weeks, rules, []);
  assert("Warns when seniors get less summer than average",
    countType(rotationResult, "summer-imbalance") >= 1,
    countType(rotationResult, "summer-imbalance") + " seniors short on summer");

  assert("That warning is a warning, not a hard error",
    errorsOnly(rotationResult).length === 0,
    "0 errors alongside the warning");

  // ---- The auto-allocator ----------------------------------------------
  var allocation = autoAllocate(rules, weeks);
  var allocationErrors = errorsOnly(allocation.violations);

  assert("Auto-allocation never breaks the coverage cap",
    countType(allocation.violations, "coverage") === 0,
    "0 weeks over " + rules.maxConcurrentOnVacation + " people");

  assert("Auto-allocation gets everyone to their minimum",
    countType(allocation.violations, "under-minimum") === 0 &&
    allocation.unresolved.length === 0,
    allocation.unresolved.length + " employees unresolved");

  assert("Auto-allocation keeps seniors within their maximum",
    countType(allocation.violations, "over-maximum") === 0,
    "no senior over " + rules.seniorTierMaxWeeks + " weeks");

  assert("Every lottery week was assigned by lottery, not seniority",
    countType(allocation.violations, "excluded-week") === 0,
    "weeks " + lottery.join(", ") + " assigned by rotation");

  assert("Auto-allocation produces no errors at all",
    allocationErrors.length === 0,
    allocationErrors.length + " errors");

  assert("Nobody is assigned the same week twice",
    allocation.employees.every(function (e) {
      var seen = {};
      return e.assignedWeeks.every(function (a) {
        if (seen[a.week]) return false;
        seen[a.week] = true;
        return true;
      });
    }),
    "checked all 18 employees");

  var allocSeniors = allocation.employees.filter(function (e) { return e.isSeniorTier; });
  var allocOthers = allocation.employees.filter(function (e) { return !e.isSeniorTier; });

  function avgSummer(list) {
    return list.reduce(function (s, e) {
      return s + summerWeekCountFor(e, weeks);
    }, 0) / list.length;
  }

  assert("The senior tier gets more summer than everyone else",
    avgSummer(allocSeniors) > avgSummer(allocOthers),
    "seniors average " + avgSummer(allocSeniors).toFixed(1) +
    " summer weeks vs " + avgSummer(allocOthers).toFixed(1));

  return results;
}
