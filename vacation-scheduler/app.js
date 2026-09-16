// ===========================================================================
// APP — the screen, and everything you click.
//
// Everything on screen is drawn from `state`. Any change updates state, then
// calls render(), so what you see always matches the underlying schedule.
// ===========================================================================

var state = {
  rules: RULES,
  weeks: buildCalendar(RULES.year, RULES),
  employees: buildEmployees(RULES),
  requests: [],
  lastAllocation: null,
  selectedEmployeeId: "emp1"
};

// Whether this browser will let us remember anything between visits.
var canSave = storageWorks();

// Pick up where we left off, if there is anything to pick up.
(function restore() {
  var saved = loadSavedSchedule();
  if (!saved) return;
  var restored = applySavedSchedule(saved, state.rules);
  state.employees = restored.employees;
  state.requests = restored.requests;
})();

// ---------------------------------------------------------------------------
// Working with the schedule
// ---------------------------------------------------------------------------

function findEmployee(employeeId) {
  return state.employees.filter(function (e) { return e.id === employeeId; })[0];
}

function toggleWeek(employeeId, weekNumber) {
  var employee = findEmployee(employeeId);
  if (!employee) return;

  var existing = employee.assignedWeeks.filter(function (a) {
    return a.week === weekNumber;
  })[0];

  if (existing) {
    employee.assignedWeeks = employee.assignedWeeks.filter(function (a) {
      return a.week !== weekNumber;
    });
  } else {
    employee.assignedWeeks.push({ week: weekNumber, method: "manual" });
  }

  render();
}

function currentViolations() {
  return validateSchedule(state.employees, state.weeks, state.rules, state.requests);
}

// ---------------------------------------------------------------------------
// Drawing the grid
// ---------------------------------------------------------------------------

function render() {
  var violations = currentViolations();
  renderGrid(violations);
  renderViolations(violations);
  renderSubtitle(violations);
  renderEmployeeTab();
  renderRequestsTab();
  renderDashboard(violations);
  persist();
}

// Saved after every change, so a refresh or a closed tab loses nothing.
function persist() {
  var status = document.getElementById("save-status");
  if (!status) return;

  if (!canSave) {
    status.textContent = "This browser is not allowing saving — use Export backup to keep your work.";
    status.className = "save-status save-off";
    return;
  }

  if (saveSchedule(state)) {
    status.textContent = "Saved in this browser.";
    status.className = "save-status save-on";
  } else {
    canSave = false;
    status.textContent = "Saving failed — use Export backup to keep your work.";
    status.className = "save-status save-off";
  }
}

function weekByNumber(weekNumber) {
  return state.weeks.filter(function (w) { return w.weekNumber === weekNumber; })[0];
}

function describeWeek(week) {
  var kind = week.isExcludedFromSeniority ? "Lottery" : (week.isSummer ? "Summer" : "Normal");
  return "Week " + week.weekNumber + " — " + week.label + " (" + kind + ")";
}

var METHOD_LABELS = {
  "seniority": "seniority bid",
  "lottery": "lottery",
  "manual": "placed by admin",
  "extra-request": "approved extra week"
};

function renderSubtitle(violations) {
  var errors = errorsOnly(violations).length;
  var assigned = state.employees.reduce(function (sum, e) {
    return sum + e.assignedWeeks.length;
  }, 0);

  document.getElementById("header-subtitle").textContent =
    state.employees.length + " employees · " + state.weeks.length + " weeks · " +
    assigned + " weeks assigned · " +
    (errors === 0 ? "no rule problems" : errors + " rule problem" + (errors === 1 ? "" : "s"));
}

function renderGrid(violations) {
  // Which cells, weeks and employees are implicated in a problem.
  var badCells = {};
  var badWeeks = {};
  var badEmployees = {};

  violations.forEach(function (v) {
    if (v.severity !== "error") return;
    if (v.employeeId && v.weekNumber) badCells[v.employeeId + ":" + v.weekNumber] = true;
    else if (v.weekNumber) badWeeks[v.weekNumber] = true;
    else if (v.employeeId) badEmployees[v.employeeId] = true;
  });

  var occupancy = weekOccupancy(state.employees, state.weeks);

  // ---- header row ----
  var html = "<thead><tr><th class='sticky-col'>Employee</th>";
  state.weeks.forEach(function (w) {
    var cls = "week-head";
    if (w.isExcludedFromSeniority) cls += " head-lottery";
    else if (w.isSummer) cls += " head-summer";
    if (badWeeks[w.weekNumber]) cls += " head-error";
    html += "<th class='" + cls + "' title='" + w.label +
            (w.holidays.length ? " — " + w.holidays.join(", ") : "") + "'>" +
            w.weekNumber + "</th>";
  });
  html += "<th class='sticky-right'>Total</th></tr>";

  // ---- occupancy row ----
  html += "<tr><th class='sticky-col subtle'>People out</th>";
  state.weeks.forEach(function (w) {
    var count = occupancy[w.weekNumber].length;
    var over = count > state.rules.maxConcurrentOnVacation;
    html += "<td class='count-cell" + (over ? " count-over" : "") + "'>" + count + "</td>";
  });
  html += "<td class='sticky-right subtle'>/" + state.rules.maxConcurrentOnVacation + "</td></tr></thead><tbody>";

  // ---- one row per employee ----
  state.employees.forEach(function (employee) {
    var assignedLookup = {};
    employee.assignedWeeks.forEach(function (a) { assignedLookup[a.week] = a.method; });

    var rowClass = employee.isSeniorTier ? "row-senior" : "";
    html += "<tr class='" + rowClass + "'>";
    html += "<th class='sticky-col' title='Seniority rank " + employee.seniorityRank +
            (employee.isSeniorTier ? " — senior tier" : "") + "'>" +
            employee.seniorityRank + ". " + employee.name + "</th>";

    state.weeks.forEach(function (w) {
      var method = assignedLookup[w.weekNumber];
      var cls = "cell";

      if (method) {
        if (w.isExcludedFromSeniority) cls += " cell-lottery";
        else if (w.isSummer) cls += " cell-summer";
        else cls += " cell-on";
      } else {
        if (w.isExcludedFromSeniority) cls += " cell-lottery-empty";
        else if (w.isSummer) cls += " cell-summer-empty";
      }

      if (badCells[employee.id + ":" + w.weekNumber]) cls += " cell-error";

      html += "<td class='" + cls + "' data-emp='" + employee.id +
              "' data-week='" + w.weekNumber + "'></td>";
    });

    // ---- total for this employee ----
    var total = employee.assignedWeeks.length;
    var ceiling = effectiveMaxWeeks(employee, state.requests);
    var totalCls = "sticky-right total-cell";
    if (total < employee.minWeeks) totalCls += " total-under";
    else if (ceiling !== null && total > ceiling) totalCls += " total-over";
    else totalCls += " total-ok";

    html += "<td class='" + totalCls + "'>" + total + " / " +
            (ceiling === null ? employee.minWeeks + "+" : ceiling) + "</td></tr>";
  });

  html += "</tbody>";
  document.getElementById("grid").innerHTML = html;
}

function renderViolations(violations) {
  var errors = errorsOnly(violations);
  var warnings = warningsOnly(violations);
  var box = document.getElementById("violations");

  var html = "<h2>Rule check</h2>";

  if (errors.length === 0 && warnings.length === 0) {
    html += "<p class='all-clear'>Everything checks out. No rules are being broken.</p>";
  }

  if (errors.length > 0) {
    html += "<p class='violation-heading error-heading'>" + errors.length +
            " problem" + (errors.length === 1 ? "" : "s") + "</p><ul class='violation-list'>";
    errors.forEach(function (v) {
      html += "<li class='violation-error'>" + v.message + "</li>";
    });
    html += "</ul>";
  }

  if (warnings.length > 0) {
    html += "<p class='violation-heading warning-heading'>" + warnings.length +
            " warning" + (warnings.length === 1 ? "" : "s") + "</p><ul class='violation-list'>";
    warnings.forEach(function (v) {
      html += "<li class='violation-warning'>" + v.message + "</li>";
    });
    html += "</ul>";
  }

  box.innerHTML = html;
}

// ---------------------------------------------------------------------------
// The employee tab
// ---------------------------------------------------------------------------

function renderEmployeeTab() {
  var picker = document.getElementById("employee-picker");
  var employee = findEmployee(state.selectedEmployeeId) || state.employees[0];
  state.selectedEmployeeId = employee.id;

  picker.innerHTML = state.employees.map(function (e) {
    return "<option value='" + e.id + "'" +
           (e.id === employee.id ? " selected" : "") + ">" +
           e.seniorityRank + ". " + e.name +
           (e.isSeniorTier ? " (senior tier)" : "") + "</option>";
  }).join("");

  // ---- summary ----
  var total = employee.assignedWeeks.length;
  var ceiling = effectiveMaxWeeks(employee, state.requests);
  var summerCount = summerWeekCountFor(employee, state.weeks);
  var statusClass = total < employee.minWeeks ? "total-under"
                  : (ceiling !== null && total > ceiling ? "total-over" : "total-ok");

  document.getElementById("employee-summary").innerHTML =
    "<table class='summary-table'>" +
    "<tr><th>Weeks assigned</th><td class='" + statusClass + "'>" + total +
      " of " + (ceiling === null ? employee.minWeeks + " minimum, no maximum" : ceiling + " maximum") +
      "</td></tr>" +
    "<tr><th>Minimum required</th><td>" + employee.minWeeks + "</td></tr>" +
    "<tr><th>Summer weeks</th><td>" + summerCount + "</td></tr>" +
    "<tr><th>Seniority rank</th><td>" + employee.seniorityRank + " of " +
      state.employees.length + (employee.isSeniorTier ? " — senior tier" : "") + "</td></tr>" +
    "</table>";

  // ---- their weeks ----
  var sorted = employee.assignedWeeks.slice().sort(function (a, b) { return a.week - b.week; });

  if (sorted.length === 0) {
    document.getElementById("employee-weeks").innerHTML =
      "<p class='hint'>No weeks assigned yet.</p>";
  } else {
    document.getElementById("employee-weeks").innerHTML =
      "<table class='week-table'><thead><tr><th>Week</th><th>Dates</th>" +
      "<th>Type</th><th>How</th></tr></thead><tbody>" +
      sorted.map(function (a) {
        var week = weekByNumber(a.week);
        var kind = week.isExcludedFromSeniority ? "Lottery" : (week.isSummer ? "Summer" : "Normal");
        var rowCls = week.isExcludedFromSeniority ? "row-lottery"
                   : (week.isSummer ? "row-summer" : "");
        return "<tr class='" + rowCls + "'><td>" + a.week + "</td><td>" +
               week.label + "</td><td>" + kind + "</td><td>" +
               (METHOD_LABELS[a.method] || a.method) + "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  // ---- which weeks can be requested ----
  var occupancy = weekOccupancy(state.employees, state.weeks);
  var openWeeks = state.weeks.filter(function (w) {
    return occupancy[w.weekNumber].length < state.rules.maxConcurrentOnVacation &&
           !hasWeek(employee, w.weekNumber) &&
           !state.requests.some(function (r) {
             return r.employeeId === employee.id &&
                    r.weekNumber === w.weekNumber &&
                    r.status === "pending";
           });
  });

  var weekSelect = document.getElementById("request-week");
  if (openWeeks.length === 0) {
    weekSelect.innerHTML = "<option value=''>No weeks available</option>";
    weekSelect.disabled = true;
    document.getElementById("btn-request").disabled = true;
  } else {
    weekSelect.innerHTML = openWeeks.map(function (w) {
      return "<option value='" + w.weekNumber + "'>" + describeWeek(w) +
             " — " + occupancy[w.weekNumber].length + "/" +
             state.rules.maxConcurrentOnVacation + " taken</option>";
    }).join("");
    weekSelect.disabled = false;
    document.getElementById("btn-request").disabled = false;
  }

  // ---- their request history ----
  var mine = state.requests.filter(function (r) { return r.employeeId === employee.id; });
  document.getElementById("employee-requests").innerHTML =
    mine.length === 0
      ? "<p class='hint'>No requests submitted.</p>"
      : "<table class='week-table'><thead><tr><th>Week</th><th>Note</th>" +
        "<th>Status</th></tr></thead><tbody>" +
        mine.map(function (r) {
          return "<tr><td>" + r.weekNumber + "</td><td>" +
                 (r.note || "—") + "</td><td><span class='pill pill-" + r.status + "'>" +
                 r.status + "</span></td></tr>";
        }).join("") + "</tbody></table>";
}

// ---------------------------------------------------------------------------
// The requests tab (admin)
// ---------------------------------------------------------------------------

function renderRequestsTab() {
  var occupancy = weekOccupancy(state.employees, state.weeks);
  var pending = state.requests.filter(function (r) { return r.status === "pending"; });
  var decided = state.requests.filter(function (r) { return r.status !== "pending"; });

  document.getElementById("pending-requests").innerHTML =
    pending.length === 0
      ? "<p class='hint'>Nothing waiting for a decision.</p>"
      : "<table class='week-table'><thead><tr><th>Employee</th><th>Week</th>" +
        "<th>Room that week</th><th>Note</th><th></th></tr></thead><tbody>" +
        pending.map(function (r) {
          var employee = findEmployee(r.employeeId);
          var week = weekByNumber(r.weekNumber);
          var taken = occupancy[r.weekNumber].length;
          var full = taken >= state.rules.maxConcurrentOnVacation;

          return "<tr><td>" + employee.name + "</td>" +
            "<td>" + describeWeek(week) + "</td>" +
            "<td class='" + (full ? "total-over" : "total-ok") + "'>" +
              taken + "/" + state.rules.maxConcurrentOnVacation +
              (full ? " — full" : "") + "</td>" +
            "<td>" + (r.note || "—") + "</td>" +
            "<td class='action-cell'>" +
              "<button class='btn btn-small btn-approve' data-request='" + r.id + "'>Approve</button> " +
              "<button class='btn btn-small' data-deny='" + r.id + "'>Deny</button>" +
            "</td></tr>";
        }).join("") + "</tbody></table>";

  document.getElementById("decided-requests").innerHTML =
    decided.length === 0
      ? "<p class='hint'>Nothing decided yet.</p>"
      : "<table class='week-table'><thead><tr><th>Employee</th><th>Week</th>" +
        "<th>Note</th><th>Status</th></tr></thead><tbody>" +
        decided.map(function (r) {
          var employee = findEmployee(r.employeeId);
          return "<tr><td>" + employee.name + "</td><td>" + r.weekNumber + "</td>" +
                 "<td>" + (r.note || "—") + "</td>" +
                 "<td><span class='pill pill-" + r.status + "'>" + r.status + "</span></td></tr>";
        }).join("") + "</tbody></table>";
}

function approveRequest(requestId) {
  var request = state.requests.filter(function (r) { return r.id === requestId; })[0];
  if (!request || request.status !== "pending") return;

  var employee = findEmployee(request.employeeId);
  var occupancy = weekOccupancy(state.employees, state.weeks);
  var taken = occupancy[request.weekNumber].length;

  // The admin can override a full week, but not without being told.
  if (taken >= state.rules.maxConcurrentOnVacation) {
    var proceed = confirm(
      "Week " + request.weekNumber + " already has " + taken +
      " people on vacation, which is the cap. Approving this will break the " +
      "coverage rule and show up as a problem on the schedule.\n\nApprove anyway?");
    if (!proceed) return;
  }

  request.status = "approved";
  if (!hasWeek(employee, request.weekNumber)) {
    employee.assignedWeeks.push({ week: request.weekNumber, method: "extra-request" });
  }
  render();
}

// An approved extra week is a promise already made, so regenerating the
// schedule must not silently take it back. Any problem this causes shows up
// in the rule check like anything else.
function reapplyApprovedRequests() {
  state.requests.forEach(function (request) {
    if (request.status !== "approved") return;
    var employee = findEmployee(request.employeeId);
    if (employee && !hasWeek(employee, request.weekNumber)) {
      employee.assignedWeeks.push({ week: request.weekNumber, method: "extra-request" });
    }
  });
}

function denyRequest(requestId) {
  var request = state.requests.filter(function (r) { return r.id === requestId; })[0];
  if (!request || request.status !== "pending") return;
  request.status = "denied";
  render();
}

// ---------------------------------------------------------------------------
// The dashboard
// ---------------------------------------------------------------------------

function renderDashboard(violations) {
  var occupancy = weekOccupancy(state.employees, state.weeks);
  var cap = state.rules.maxConcurrentOnVacation;
  var errors = errorsOnly(violations);
  var warnings = warningsOnly(violations);

  var counts = state.weeks.map(function (w) { return occupancy[w.weekNumber].length; });
  var busiest = Math.max.apply(null, counts);
  var totalAssigned = state.employees.reduce(function (s, e) {
    return s + e.assignedWeeks.length;
  }, 0);
  var pending = state.requests.filter(function (r) { return r.status === "pending"; }).length;

  // ---- headline numbers ----
  function tile(label, value, note, cls) {
    return "<div class='stat-tile'><div class='stat-value " + (cls || "") + "'>" + value +
           "</div><div class='stat-label'>" + label + "</div>" +
           "<div class='stat-note'>" + note + "</div></div>";
  }

  document.getElementById("stat-row").innerHTML =
    tile("Weeks assigned", totalAssigned,
         "of " + (cap * state.weeks.length) + " possible") +
    tile("Busiest week", busiest + " / " + cap,
         busiest > cap ? "over the cap" : "within the cap",
         busiest > cap ? "stat-bad" : "stat-good") +
    tile("Requests waiting", pending,
         pending === 0 ? "nothing to decide" : "need a decision") +
    tile("Rule problems", errors.length,
         warnings.length + " warning" + (warnings.length === 1 ? "" : "s"),
         errors.length === 0 ? "stat-good" : "stat-bad");

  // ---- the chart ----
  // Scale leaves one person of headroom above the cap so the cap line sits
  // inside the plot rather than on its ceiling.
  var scale = Math.max(cap + 1, busiest);

  var bars = state.weeks.map(function (week) {
    var count = occupancy[week.weekNumber].length;
    var over = count > cap;
    var height = (count / scale) * 100;

    var barClass = "bar";
    if (over) barClass += " bar-over";
    else if (week.isExcludedFromSeniority) barClass += " bar-lottery";
    else if (week.isSummer) barClass += " bar-summer";
    else barClass += " bar-normal";

    var kind = week.isExcludedFromSeniority
      ? "Lottery — " + week.holidays.join(", ")
      : (week.isSummer ? "Summer" : "Normal");

    var tip = "Week " + week.weekNumber + " (" + week.label + ")\n" +
              kind + "\n" + count + " of " + cap + " people out" +
              (over ? " — OVER THE CAP" : "");

    // Only over-cap bars get a number, so the chart stays readable.
    var label = over ? "<span class='bar-value'>" + count + "</span>" : "";
    var tick = (week.weekNumber % 5 === 0 || week.weekNumber === 1)
      ? week.weekNumber : "";

    return "<div class='chart-col' title=\"" + tip + "\">" +
           "<div class='bar-track'>" + label +
           "<div class='" + barClass + "' style='height:" + height + "%'></div></div>" +
           "<div class='chart-tick'>" + tick + "</div></div>";
  }).join("");

  document.getElementById("coverage-chart").innerHTML =
    "<div class='chart'>" +
      "<div class='chart-plot'>" +
        "<div class='cap-line' style='bottom:" + ((cap / scale) * 100) + "%'>" +
          "<span class='cap-label'>cap " + cap + "</span></div>" +
        "<div class='chart-bars'>" + bars + "</div>" +
      "</div>" +
      "<p class='chart-caption'>Each bar is one week of " + state.rules.year +
      ". Hover a bar for its dates.</p>" +
    "</div>";

  // ---- violations ----
  var box = document.getElementById("dashboard-violations");
  if (errors.length === 0 && warnings.length === 0) {
    box.innerHTML = "<p class='all-clear'>No rules are being broken.</p>";
  } else {
    box.innerHTML = "<ul class='violation-list'>" +
      errors.map(function (v) {
        return "<li class='violation-error'>" + v.message + "</li>";
      }).join("") +
      warnings.map(function (v) {
        return "<li class='violation-warning'>" + v.message + "</li>";
      }).join("") + "</ul>";
  }

  // ---- per-employee table ----
  var rows = state.employees.map(function (employee) {
    var total = employee.assignedWeeks.length;
    var ceiling = effectiveMaxWeeks(employee, state.requests);
    var lotteryCount = employee.assignedWeeks.filter(function (a) {
      var week = weekByNumber(a.week);
      return week && week.isExcludedFromSeniority;
    }).length;

    var status = "Within the rules";
    var statusClass = "total-ok";
    if (total < employee.minWeeks) {
      status = "Short by " + (employee.minWeeks - total);
      statusClass = "total-under";
    } else if (ceiling !== null && total > ceiling) {
      status = "Over by " + (total - ceiling);
      statusClass = "total-over";
    }

    return "<tr" + (employee.isSeniorTier ? " class='row-senior'" : "") + ">" +
      "<td>" + employee.seniorityRank + "</td>" +
      "<td>" + employee.name + "</td>" +
      "<td>" + (employee.isSeniorTier ? "Senior" : "Staff") + "</td>" +
      "<td>" + total + "</td>" +
      "<td>" + employee.minWeeks + "</td>" +
      "<td>" + (ceiling === null ? "—" : ceiling) + "</td>" +
      "<td>" + summerWeekCountFor(employee, state.weeks) + "</td>" +
      "<td>" + lotteryCount + "</td>" +
      "<td class='" + statusClass + "'>" + status + "</td></tr>";
  }).join("");

  document.getElementById("dashboard-table").innerHTML =
    "<table class='week-table'><thead><tr><th>Rank</th><th>Employee</th><th>Tier</th>" +
    "<th>Weeks</th><th>Min</th><th>Max</th><th>Summer</th><th>Lottery</th>" +
    "<th>Status</th></tr></thead><tbody>" + rows + "</tbody></table>";
}

// ---------------------------------------------------------------------------
// The self-checks tab
// ---------------------------------------------------------------------------

function renderChecksTab() {
  var rules = state.rules;
  var weeks = state.weeks;
  var seniorCount = state.employees.filter(function (e) { return e.isSeniorTier; }).length;
  var capacity = rules.maxConcurrentOnVacation * rules.weeksInYear;
  var floorDemand = state.employees.length * rules.minWeeksPerEmployee;
  var maxDemand = (seniorCount * rules.seniorTierMaxWeeks) +
                  ((state.employees.length - seniorCount) * rules.minWeeksPerEmployee);

  function row(label, value) {
    return "<tr><th>" + label + "</th><td>" + value + "</td></tr>";
  }

  document.getElementById("rules-summary").innerHTML =
    '<table class="summary-table">' +
    row("Year", rules.year) +
    row("Employees", state.employees.length + " (" + seniorCount + " senior tier)") +
    row("Minimum weeks each", rules.minWeeksPerEmployee) +
    row("Senior tier maximum", rules.seniorTierMaxWeeks + " weeks") +
    row("Everyone else maximum", "no hard ceiling") +
    row("Coverage cap", "max " + rules.maxConcurrentOnVacation + " people out per week") +
    row("Total capacity", capacity + " employee-weeks") +
    row("Needed at the minimum", floorDemand + " (" + (capacity - floorDemand) + " to spare)") +
    row("Needed if seniors take " + rules.seniorTierMaxWeeks,
        maxDemand + " (" + (capacity - maxDemand) + " to spare)") +
    "</table>";

  var results = runSelfChecks();
  var failed = results.filter(function (r) { return !r.passed; }).length;

  document.getElementById("self-checks").innerHTML =
    '<p class="check-summary ' + (failed === 0 ? "all-pass" : "some-fail") + '">' +
    (failed === 0 ? "All " + results.length + " checks pass."
                  : failed + " of " + results.length + " checks FAILED.") +
    "</p><ul class='check-list'>" +
    results.map(function (r) {
      return '<li class="' + (r.passed ? "check-pass" : "check-fail") + '">' +
             (r.passed ? "PASS" : "FAIL") + " — " + r.label +
             ' <span class="check-detail">(' + r.detail + ")</span></li>";
    }).join("") + "</ul>";

  var occupancy = weekOccupancy(state.employees, weeks);
  var tableHtml = "<thead><tr><th>Week</th><th>Dates</th><th>Type</th>" +
                  "<th>Notes</th><th>People out</th></tr></thead><tbody>";

  weeks.forEach(function (w) {
    var type = "Normal";
    var rowCls = "";
    if (w.isExcludedFromSeniority) { type = "Lottery"; rowCls = "row-lottery"; }
    else if (w.isSummer) { type = "Summer"; rowCls = "row-summer"; }

    tableHtml += "<tr class='" + rowCls + "'>" +
      "<td>" + w.weekNumber + "</td>" +
      "<td>" + formatDateLong(w.startDate) + " – " + formatDateLong(w.endDate) + "</td>" +
      "<td>" + type + "</td>" +
      "<td>" + w.holidays.join(", ") + "</td>" +
      "<td>" + occupancy[w.weekNumber].length + " / " +
      state.rules.maxConcurrentOnVacation + "</td></tr>";
  });

  document.getElementById("week-table").innerHTML = tableHtml + "</tbody>";
}

// ---------------------------------------------------------------------------
// Buttons and tabs
// ---------------------------------------------------------------------------

function setNote(text) {
  document.getElementById("toolbar-note").textContent = text || "";
}

document.getElementById("grid").addEventListener("click", function (event) {
  var cell = event.target.closest("td[data-emp]");
  if (!cell) return;
  toggleWeek(cell.getAttribute("data-emp"), Number(cell.getAttribute("data-week")));
  setNote("");
});

document.getElementById("btn-allocate").addEventListener("click", function () {
  var assigned = state.employees.reduce(function (s, e) {
    return s + e.assignedWeeks.length;
  }, 0);

  if (assigned > 0 &&
      !confirm("This replaces the whole schedule with a freshly generated one. " +
               "Any hand-edits will be lost. Continue?")) {
    return;
  }

  var result = autoAllocate(state.rules, state.weeks);
  state.employees = result.employees;
  state.lastAllocation = result;
  reapplyApprovedRequests();

  if (result.unresolved.length > 0) {
    setNote(result.unresolved.length + " employee(s) could not be fully placed — see the panel.");
  } else {
    setNote("Schedule generated. Everyone reached their minimum.");
  }

  render();
});

document.getElementById("btn-clear").addEventListener("click", function () {
  if (!confirm("Clear every assigned week and start from an empty schedule?")) return;
  state.employees.forEach(function (e) { e.assignedWeeks = []; });
  setNote("Schedule cleared.");
  render();
});

// ---------------------------------------------------------------------------
// Backing up and restoring
// ---------------------------------------------------------------------------

function fileStamp() {
  var now = new Date();
  function pad(n) { return n < 10 ? "0" + n : String(n); }
  return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
}

document.getElementById("btn-export-json").addEventListener("click", function () {
  var ok = downloadFile(
    "vacation-schedule-" + state.rules.year + "-" + fileStamp() + ".json",
    JSON.stringify(serializeSchedule(state), null, 2),
    "application/json");
  setNote(ok ? "Backup file downloaded." : "Could not create the file in this browser.");
});

document.getElementById("btn-export-csv").addEventListener("click", function () {
  var ok = downloadFile(
    "vacation-schedule-" + state.rules.year + "-" + fileStamp() + ".csv",
    scheduleToCsv(state),
    "text/csv");
  setNote(ok ? "Spreadsheet downloaded." : "Could not create the file in this browser.");
});

document.getElementById("btn-import-json").addEventListener("click", function () {
  document.getElementById("import-file").click();
});

document.getElementById("import-file").addEventListener("change", function (event) {
  var file = event.target.files && event.target.files[0];
  if (!file) return;

  var reader = new FileReader();

  reader.onload = function () {
    var data;
    try {
      data = JSON.parse(reader.result);
    } catch (e) {
      setNote("That file is not a valid backup — it could not be read as JSON.");
      return;
    }

    if (!data || !data.employees) {
      setNote("That file does not look like a schedule backup.");
      return;
    }

    if (!confirm("Importing replaces the schedule currently on screen. Continue?")) return;

    var restored = applySavedSchedule(data, state.rules);
    state.employees = restored.employees;
    state.requests = restored.requests;

    setNote("Schedule imported." +
            (restored.skipped > 0 ? " " + restored.skipped + " entries were ignored as invalid." : ""));
    render();
  };

  reader.onerror = function () { setNote("That file could not be read."); };
  reader.readAsText(file);

  // Let the same file be picked again later.
  event.target.value = "";
});

document.getElementById("btn-reset").addEventListener("click", function () {
  if (!confirm("This wipes the schedule AND every request, and forgets the saved copy " +
               "in this browser. This cannot be undone.\n\nReset everything?")) return;

  clearSavedSchedule();
  state.employees = buildEmployees(state.rules);
  state.requests = [];
  state.selectedEmployeeId = "emp1";
  setNote("Everything reset to a blank schedule.");
  render();
});

document.getElementById("employee-picker").addEventListener("change", function (event) {
  state.selectedEmployeeId = event.target.value;
  document.getElementById("request-note-msg").textContent = "";
  renderEmployeeTab();
});

document.getElementById("btn-request").addEventListener("click", function () {
  var weekNumber = Number(document.getElementById("request-week").value);
  if (!weekNumber) return;

  var noteField = document.getElementById("request-note");
  var employee = findEmployee(state.selectedEmployeeId);

  state.requests.push({
    id: "req-" + Date.now() + "-" + state.requests.length,
    employeeId: employee.id,
    weekNumber: weekNumber,
    note: noteField.value.trim(),
    status: "pending"
  });

  noteField.value = "";
  document.getElementById("request-note-msg").textContent =
    "Request submitted for week " + weekNumber + ". It now needs an admin decision.";

  render();
});

document.getElementById("pending-requests").addEventListener("click", function (event) {
  var approve = event.target.closest("[data-request]");
  if (approve) { approveRequest(approve.getAttribute("data-request")); return; }

  var deny = event.target.closest("[data-deny]");
  if (deny) { denyRequest(deny.getAttribute("data-deny")); }
});

document.getElementById("tabs").addEventListener("click", function (event) {
  var button = event.target.closest(".tab-button");
  if (!button) return;

  var target = button.getAttribute("data-tab");

  Array.prototype.forEach.call(document.querySelectorAll(".tab-button"), function (b) {
    b.classList.toggle("active", b === button);
  });
  Array.prototype.forEach.call(document.querySelectorAll(".tab-panel"), function (panel) {
    panel.classList.toggle("hidden", panel.id !== "tab-" + target);
  });

  // The self-checks are slow enough to be worth running only when looked at.
  if (target === "checks") renderChecksTab();
});

// ---------------------------------------------------------------------------
render();
