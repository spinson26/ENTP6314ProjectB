// ===========================================================================
// RULES — every number the scheduler uses lives here.
// This is the file to edit when a rule changes. Nothing is hardcoded elsewhere.
// ===========================================================================

var RULES = {
  // ---- The year being scheduled -------------------------------------------
  year: 2026,
  weeksInYear: 52,

  // ---- How many vacation weeks people get ---------------------------------
  minWeeksPerEmployee: 9,

  // The 4 most senior employees may take up to 17 weeks.
  seniorTierSize: 4,
  seniorTierMaxWeeks: 17,

  // The other 14 have a 9-week floor and NO hard ceiling.
  // null means "no maximum" — they are never flagged for having too many weeks.
  nonSeniorMaxWeeks: null,

  // But the auto-allocator still needs a target, or it would give the most
  // senior person everything and starve the rest. It gives the 14 exactly
  // their floor; anything beyond that comes through extra-week requests.
  autoAllocateNonSeniorTarget: 9,

  // ---- Staffing coverage --------------------------------------------------
  // No more than this many people may be on vacation in the same week.
  // Capacity check: 4 x 52 = 208 employee-weeks available.
  //                 18 x 9 = 162 needed at the floor (46 to spare).
  //                 If all 4 seniors take 17: 194 needed (only 14 to spare).
  maxConcurrentOnVacation: 4,

  // ---- Summer -------------------------------------------------------------
  // 11 consecutive weeks, starting with the first week that begins in June.
  summerWeekCount: 11,
  summerStartMonth: 5, // 0 = January, so 5 = June

  // ---- Lottery weeks (not bid on by seniority) ----------------------------
  // Thanksgiving, Christmas and the last week of the year are worked out from
  // the calendar automatically. Spring break has no fixed rule, so it is set
  // here by week number.
  //
  // !! PLACEHOLDER — not yet decided. See TODO.md, open question #1.
  // Week 11 of 2026 is Mar 15-21. Change this one number to move spring break.
  springBreakWeek: 11,

  // ---- Summer priority for the senior tier --------------------------------
  // 0  = seniors simply pick first, in seniority order (no fixed guarantee).
  // 4  = each senior is guaranteed at least 4 summer weeks before the other
  //      14 get any summer allocation. Any number works the same way.
  //
  // !! PLACEHOLDER — not yet decided. See TODO.md, open question #2.
  seniorSummerGuarantee: 0
};
