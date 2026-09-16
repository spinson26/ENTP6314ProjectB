// ===========================================================================
// ALLOCATE — builds a full year's schedule from scratch.
//
// Four passes, in this order:
//   1. Lottery      — the 4 holiday weeks, by yearly rotation, not seniority
//   2. Summer       — the 11 summer weeks, drafted in seniority order
//   3. Fill to 9    — everyone reaches their minimum before anyone gets extra
//   4. Top up       — seniors climb toward their 17-week maximum
//
// The coverage cap is never broken to make the numbers work. If someone
// cannot be fully placed, they come back in the "unresolved" list so the app
// can say so plainly.
// ===========================================================================

function autoAllocate(rules, weeks) {
  var employees = buildEmployees(rules);

  // How many people are already booked into each week.
  var occupancy = {};
  weeks.forEach(function (w) { occupancy[w.weekNumber] = 0; });

  // What this employee is aiming for. Seniors who want their full allotment
  // aim for the tier maximum; everyone else aims for the floor, and takes
  // anything beyond that through an extra-week request instead.
  function targetFor(employee) {
    if (employee.isSeniorTier && employee.wantsMaxWeeks) {
      return rules.seniorTierMaxWeeks;
    }
    return rules.autoAllocateNonSeniorTarget;
  }

  function canTake(employee, weekNumber) {
    return occupancy[weekNumber] < rules.maxConcurrentOnVacation &&
           !hasWeek(employee, weekNumber);
  }

  function give(employee, weekNumber, method) {
    employee.assignedWeeks.push({ week: weekNumber, method: method });
    occupancy[weekNumber]++;
  }

  // Of the weeks on offer, take the emptiest one. Spreading people out this
  // way is what keeps the coverage cap from blocking the last few employees.
  function bestWeekFrom(employee, candidates) {
    var best = null;
    candidates.forEach(function (weekNumber) {
      if (!canTake(employee, weekNumber)) return;
      if (best === null || occupancy[weekNumber] < occupancy[best]) {
        best = weekNumber;
      }
    });
    return best;
  }

  // Everyone takes a turn in seniority order, over and over, until nobody
  // can take another week. Seniors pick first every round, so they get the
  // best of what is left without being able to take the whole calendar.
  function draft(candidates, limitFor, method) {
    var handedOutSomething = true;
    while (handedOutSomething) {
      handedOutSomething = false;
      for (var i = 0; i < employees.length; i++) {
        var employee = employees[i];
        if (employee.assignedWeeks.length >= limitFor(employee)) continue;

        var weekNumber = bestWeekFrom(employee, candidates);
        if (weekNumber === null) continue;

        give(employee, weekNumber, method);
        handedOutSomething = true;
      }
    }
  }

  // ---- Pass 1: the lottery weeks -----------------------------------------
  // Rotated by year so a different group goes first each year. There are 16
  // lottery slots (4 weeks x the cap of 4) for 18 people, so 2 people miss
  // out each year — and it is a different 2 next year.
  var lotteryWeeks = lotteryWeekNumbers(weeks);
  var offset = rules.year % employees.length;
  var rotation = employees.slice(offset).concat(employees.slice(0, offset));

  var nextInLine = 0;
  lotteryWeeks.forEach(function (weekNumber) {
    for (var seat = 0; seat < rules.maxConcurrentOnVacation; seat++) {
      if (nextInLine >= rotation.length) return;
      var employee = rotation[nextInLine];
      nextInLine++;
      if (canTake(employee, weekNumber)) {
        give(employee, weekNumber, "lottery");
      }
    }
  });

  // ---- Pass 2: summer ----------------------------------------------------
  var summerWeeks = summerWeekNumbers(weeks);

  // An optional head start for the senior tier before the draft opens.
  // Currently 0 — see TODO.md, open question #2.
  if (rules.seniorSummerGuarantee > 0) {
    employees.forEach(function (employee) {
      if (!employee.isSeniorTier) return;
      for (var g = 0; g < rules.seniorSummerGuarantee; g++) {
        if (employee.assignedWeeks.length >= targetFor(employee)) break;
        var weekNumber = bestWeekFrom(employee, summerWeeks);
        if (weekNumber === null) break;
        give(employee, weekNumber, "seniority");
      }
    });
  }

  draft(summerWeeks, targetFor, "seniority");

  // ---- Passes 3 and 4: the rest of the year ------------------------------
  // Lottery weeks are off limits here — they are only ever won by lottery.
  var biddableWeeks = weeks
    .filter(function (w) { return !w.isExcludedFromSeniority; })
    .map(function (w) { return w.weekNumber; });

  // Everyone reaches their minimum first...
  draft(biddableWeeks, function (employee) { return employee.minWeeks; }, "seniority");

  // ...and only then do seniors climb toward their maximum.
  draft(biddableWeeks, targetFor, "seniority");

  // ---- Report honestly ---------------------------------------------------
  var violations = validateSchedule(employees, weeks, rules, []);

  var unresolved = employees
    .filter(function (e) { return e.assignedWeeks.length < e.minWeeks; })
    .map(function (e) {
      return {
        employeeId: e.id,
        name: e.name,
        got: e.assignedWeeks.length,
        needed: e.minWeeks,
        reason: "The coverage cap of " + rules.maxConcurrentOnVacation +
                " left no legal week to give them."
      };
    });

  return {
    employees: employees,
    unresolved: unresolved,
    violations: violations
  };
}

// A plain-language summary of what an allocation produced.
function summarizeAllocation(result, weeks, rules) {
  var employees = result.employees;
  var seniors = employees.filter(function (e) { return e.isSeniorTier; });
  var others = employees.filter(function (e) { return !e.isSeniorTier; });

  function average(list, fn) {
    if (list.length === 0) return 0;
    return list.reduce(function (sum, e) { return sum + fn(e); }, 0) / list.length;
  }

  var occupancy = weekOccupancy(employees, weeks);
  var busiest = 0;
  weeks.forEach(function (w) {
    busiest = Math.max(busiest, occupancy[w.weekNumber].length);
  });

  return {
    totalAssigned: employees.reduce(function (s, e) { return s + e.assignedWeeks.length; }, 0),
    capacity: rules.maxConcurrentOnVacation * weeks.length,
    busiestWeek: busiest,
    seniorAverageWeeks: average(seniors, function (e) { return e.assignedWeeks.length; }),
    otherAverageWeeks: average(others, function (e) { return e.assignedWeeks.length; }),
    seniorAverageSummer: average(seniors, function (e) { return summerWeekCountFor(e, weeks); }),
    otherAverageSummer: average(others, function (e) { return summerWeekCountFor(e, weeks); }),
    errors: errorsOnly(result.violations).length,
    warnings: warningsOnly(result.violations).length,
    unresolved: result.unresolved.length
  };
}
