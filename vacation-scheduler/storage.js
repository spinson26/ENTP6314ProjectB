// ===========================================================================
// STORAGE — remembering the schedule, and moving it in and out of files.
//
// Deliberate choice: only the SCHEDULE is saved (who has which weeks, and the
// extra-week requests). The rules themselves are NOT saved. rules.js is
// always the source of truth, so editing a number in there takes effect
// straight away instead of being quietly overridden by an old saved copy.
//
// Every browser-storage call is wrapped, because storage can be switched off
// or full, and the app must keep working either way.
// ===========================================================================

var STORAGE_KEY = "vacation-scheduler";
var STORAGE_VERSION = 1;

function storageWorks() {
  try {
    var probe = "__probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch (e) {
    return false;
  }
}

function serializeSchedule(state) {
  return {
    version: STORAGE_VERSION,
    year: state.rules.year,
    savedAt: new Date().toISOString(),
    employees: state.employees.map(function (e) {
      return { id: e.id, name: e.name, assignedWeeks: e.assignedWeeks };
    }),
    requests: state.requests
  };
}

function saveSchedule(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeSchedule(state)));
    return true;
  } catch (e) {
    return false;
  }
}

function loadSavedSchedule() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    var data = JSON.parse(raw);
    if (!data || data.version !== STORAGE_VERSION) return null;
    return data;
  } catch (e) {
    return null;
  }
}

function clearSavedSchedule() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Rebuilding a schedule from saved or imported data.
//
// The roster and the rules always come from rules.js and employees.js; only
// the week assignments come from the saved data. Anything nonsensical in the
// file is dropped rather than trusted, since an imported file may have been
// hand-edited.
// ---------------------------------------------------------------------------

var VALID_METHODS = ["seniority", "lottery", "manual", "extra-request"];
var VALID_STATUSES = ["pending", "approved", "denied"];

function applySavedSchedule(data, rules) {
  var employees = buildEmployees(rules);
  var byId = {};
  employees.forEach(function (e) { byId[e.id] = e; });

  var skipped = 0;

  (data && data.employees ? data.employees : []).forEach(function (saved) {
    var employee = byId[saved.id];
    if (!employee) { skipped++; return; }

    var seen = {};
    employee.assignedWeeks = (saved.assignedWeeks || []).filter(function (a) {
      var ok = a && typeof a.week === "number" &&
               a.week >= 1 && a.week <= rules.weeksInYear && !seen[a.week];
      if (!ok) { skipped++; return false; }
      seen[a.week] = true;
      return true;
    }).map(function (a) {
      return {
        week: a.week,
        method: VALID_METHODS.indexOf(a.method) === -1 ? "manual" : a.method
      };
    });
  });

  var requests = (data && data.requests ? data.requests : []).filter(function (r) {
    var ok = r && byId[r.employeeId] &&
             typeof r.weekNumber === "number" &&
             r.weekNumber >= 1 && r.weekNumber <= rules.weeksInYear &&
             VALID_STATUSES.indexOf(r.status) !== -1;
    if (!ok) skipped++;
    return ok;
  }).map(function (r) {
    return {
      id: String(r.id || ("req-" + Math.random())),
      employeeId: r.employeeId,
      weekNumber: r.weekNumber,
      note: typeof r.note === "string" ? r.note : "",
      status: r.status
    };
  });

  return { employees: employees, requests: requests, skipped: skipped };
}

// ---------------------------------------------------------------------------
// Files out
// ---------------------------------------------------------------------------

function downloadFile(filename, text, mimeType) {
  try {
    var blob = new Blob([text], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    return true;
  } catch (e) {
    return false;
  }
}

function csvCell(value) {
  var text = value === null || value === undefined ? "" : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

// One row per employee, one column per week, so it opens sensibly in Excel.
function scheduleToCsv(state) {
  var lines = [];

  var header = ["Rank", "Employee", "Tier", "Weeks", "Minimum", "Maximum"];
  state.weeks.forEach(function (w) {
    var kind = w.isExcludedFromSeniority ? "Lottery" : (w.isSummer ? "Summer" : "");
    header.push("Wk " + w.weekNumber + " (" + w.label + ")" + (kind ? " " + kind : ""));
  });
  lines.push(header.map(csvCell).join(","));

  state.employees.forEach(function (employee) {
    var lookup = {};
    employee.assignedWeeks.forEach(function (a) { lookup[a.week] = a.method; });

    var ceiling = effectiveMaxWeeks(employee, state.requests);
    var row = [
      employee.seniorityRank,
      employee.name,
      employee.isSeniorTier ? "Senior" : "Staff",
      employee.assignedWeeks.length,
      employee.minWeeks,
      ceiling === null ? "no maximum" : ceiling
    ];

    state.weeks.forEach(function (w) {
      row.push(lookup[w.weekNumber] ? "X" : "");
    });

    lines.push(row.map(csvCell).join(","));
  });

  // A final tally row so the coverage cap is visible in the spreadsheet too.
  var occupancy = weekOccupancy(state.employees, state.weeks);
  var tally = ["", "People out", "", "", "", "max " + state.rules.maxConcurrentOnVacation];
  state.weeks.forEach(function (w) {
    tally.push(occupancy[w.weekNumber].length);
  });
  lines.push(tally.map(csvCell).join(","));

  return lines.join("\r\n");
}
