// ===========================================================================
// EMPLOYEES — the 18 people being scheduled.
// Edit names here. seniorityRank 1 is the most senior.
// The first 4 ranks are the senior tier (set by RULES.seniorTierSize).
// ===========================================================================

var EMPLOYEE_NAMES = [
  "Dana Whitfield",
  "Marcus Ellery",
  "Priya Raghunathan",
  "Tomas Berenger",
  "Alice Nakamura",
  "Jordan Feld",
  "Cheryl Mbeki",
  "Owen Kowalski",
  "Rosa Delgado",
  "Nate Abrahams",
  "Simone Petrov",
  "Derrick Haines",
  "Leila Osman",
  "Grant Yoshida",
  "Bianca Ferraro",
  "Kwame Osei",
  "Hannah Lindqvist",
  "Victor Salgado"
];

// Builds the 18 employee records from the names above, applying the tier rules.
function buildEmployees(rules) {
  return EMPLOYEE_NAMES.map(function (name, index) {
    var rank = index + 1;
    var isSenior = rank <= rules.seniorTierSize;

    return {
      id: "emp" + rank,
      name: name,
      seniorityRank: rank,
      isSeniorTier: isSenior,
      minWeeks: rules.minWeeksPerEmployee,
      // null means no hard ceiling for the non-senior 14.
      maxWeeks: isSenior ? rules.seniorTierMaxWeeks : rules.nonSeniorMaxWeeks,
      // Seniors who want their full allotment rather than just the minimum.
      wantsMaxWeeks: isSenior,
      assignedWeeks: []
    };
  });
}
