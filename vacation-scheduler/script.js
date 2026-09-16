// All the vacations are kept in this array, and saved to the browser's
// localStorage so they're still there next time this page is opened.
var STORAGE_KEY = "vacations";

var form = document.getElementById("vacation-form");
var nameInput = document.getElementById("name");
var startInput = document.getElementById("start");
var endInput = document.getElementById("end");
var notesInput = document.getElementById("notes");
var errorMessage = document.getElementById("error-message");
var listEl = document.getElementById("vacation-list");
var emptyMessage = document.getElementById("empty-message");

function loadVacations() {
  var raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveVacations(vacations) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vacations));
}

function formatDate(dateStr) {
  // dateStr is "YYYY-MM-DD"; build the date in local time so it doesn't
  // shift a day backward/forward depending on time zone.
  var parts = dateStr.split("-");
  var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function render() {
  var vacations = loadVacations();

  vacations.sort(function (a, b) {
    return a.start.localeCompare(b.start);
  });

  listEl.innerHTML = "";
  emptyMessage.style.display = vacations.length === 0 ? "block" : "none";

  vacations.forEach(function (vacation) {
    var card = document.createElement("div");
    card.className = "vacation-card";

    var info = document.createElement("div");
    info.className = "vacation-info";

    var title = document.createElement("h3");
    title.textContent = vacation.name;

    var dates = document.createElement("p");
    dates.className = "vacation-dates";
    dates.textContent = formatDate(vacation.start) + " – " + formatDate(vacation.end);

    info.appendChild(title);
    info.appendChild(dates);

    if (vacation.notes) {
      var notes = document.createElement("p");
      notes.className = "vacation-notes";
      notes.textContent = vacation.notes;
      info.appendChild(notes);
    }

    var deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", function () {
      deleteVacation(vacation.id);
    });

    card.appendChild(info);
    card.appendChild(deleteBtn);
    listEl.appendChild(card);
  });
}

function deleteVacation(id) {
  var vacations = loadVacations().filter(function (v) {
    return v.id !== id;
  });
  saveVacations(vacations);
  render();
}

form.addEventListener("submit", function (e) {
  e.preventDefault();
  errorMessage.textContent = "";

  var name = nameInput.value.trim();
  var start = startInput.value;
  var end = endInput.value;
  var notes = notesInput.value.trim();

  if (!name || !start || !end) {
    errorMessage.textContent = "Please fill in the trip name, start date, and end date.";
    return;
  }

  if (end < start) {
    errorMessage.textContent = "End date can't be before the start date.";
    return;
  }

  var vacations = loadVacations();
  vacations.push({
    id: Date.now().toString(),
    name: name,
    start: start,
    end: end,
    notes: notes
  });
  saveVacations(vacations);

  form.reset();
  render();
  nameInput.focus();
});

render();
