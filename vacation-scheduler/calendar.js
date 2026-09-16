// ===========================================================================
// CALENDAR — turns a year into 52 weeks and flags the special ones.
//
// Week 1 is the week containing the first Sunday of January, and every week
// runs Sunday through Saturday. 52 weeks is 364 days, so a day or two at the
// very start of January falls outside the model — that is the normal
// trade-off of treating a year as exactly 52 weeks.
// ===========================================================================

var MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Returns a new date N days after the given one. Uses local time only, so
// dates never drift by a day because of time zones.
function addDays(date, days) {
  var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date) {
  return MONTH_NAMES[date.getMonth()] + " " + date.getDate();
}

function formatDateLong(date) {
  return MONTH_NAMES[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear();
}

function firstSundayOfJanuary(year) {
  var d = new Date(year, 0, 1);
  while (d.getDay() !== 0) {
    d = addDays(d, 1);
  }
  return d;
}

// e.g. the 4th Thursday of November: nthWeekdayOfMonth(2026, 10, 4, 4)
function nthWeekdayOfMonth(year, monthIndex, weekday, n) {
  var d = new Date(year, monthIndex, 1);
  var count = 0;
  while (d.getMonth() === monthIndex) {
    if (d.getDay() === weekday) {
      count++;
      if (count === n) return d;
    }
    d = addDays(d, 1);
  }
  return null;
}

// Which week (1-52) contains this date? Returns null if it falls outside.
function weekNumberContaining(weeks, date) {
  for (var i = 0; i < weeks.length; i++) {
    if (date >= weeks[i].startDate && date <= weeks[i].endDate) {
      return weeks[i].weekNumber;
    }
  }
  return null;
}

function buildCalendar(year, rules) {
  var week1Start = firstSundayOfJanuary(year);
  var weeks = [];

  for (var i = 0; i < rules.weeksInYear; i++) {
    var start = addDays(week1Start, i * 7);
    var end = addDays(start, 6);
    weeks.push({
      weekNumber: i + 1,
      startDate: start,
      endDate: end,
      label: formatDate(start) + " – " + formatDate(end),
      holidays: [],
      isExcludedFromSeniority: false,
      isSummer: false
    });
  }

  // ---- Mark the lottery weeks --------------------------------------------
  function markHoliday(weekNumber, holidayName) {
    if (weekNumber === null) return;
    var week = weeks[weekNumber - 1];
    if (!week) return;
    week.holidays.push(holidayName);
    week.isExcludedFromSeniority = true;
  }

  var thanksgiving = nthWeekdayOfMonth(year, 10, 4, 4); // 4th Thursday of Nov
  markHoliday(weekNumberContaining(weeks, thanksgiving), "Thanksgiving");

  markHoliday(weekNumberContaining(weeks, new Date(year, 11, 25)), "Christmas");

  markHoliday(weeks.length, "Last week of year");

  markHoliday(rules.springBreakWeek, "Spring break");

  // ---- Mark the summer weeks ---------------------------------------------
  // The 11 consecutive weeks starting with the first week that begins in June.
  var summerStartIndex = -1;
  for (var s = 0; s < weeks.length; s++) {
    if (weeks[s].startDate.getMonth() >= rules.summerStartMonth) {
      summerStartIndex = s;
      break;
    }
  }
  if (summerStartIndex !== -1) {
    for (var t = 0; t < rules.summerWeekCount; t++) {
      var summerWeek = weeks[summerStartIndex + t];
      if (summerWeek) summerWeek.isSummer = true;
    }
  }

  return weeks;
}

// The distinct week numbers that are assigned by lottery rather than seniority.
// Normally 4 weeks — but in some years Christmas genuinely falls inside the
// last week of the year, which collapses two of them into one. The app reports
// that rather than pretending there are always 4.
function lotteryWeekNumbers(weeks) {
  return weeks
    .filter(function (w) { return w.isExcludedFromSeniority; })
    .map(function (w) { return w.weekNumber; });
}

function summerWeekNumbers(weeks) {
  return weeks
    .filter(function (w) { return w.isSummer; })
    .map(function (w) { return w.weekNumber; });
}
