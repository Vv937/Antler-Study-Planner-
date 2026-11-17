const categoryClasses = {
  "Assessment deadline": "assessment-deadline",
  "Study session": "study-session",
  "Personal event": "personal-event",
  "University event": "university-event"
};
const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const hourLabels = Array.from({ length: 24 }, (_, hour) => hour);

let calendarData = { assessments: [], events: [] };
let currentDate = parseDateKey(new URLSearchParams(location.search).get("date")) || new Date();
let currentView = "month";
let selectedEvent = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function addDays(date, amount) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount, 12);
}

function startOfWeek(date) {
  return addDays(date, -((date.getDay() + 6) % 7));
}

function dateFromEvent(value) {
  return parseDateKey(String(value).slice(0, 10));
}

function localDateTimeValue(value) {
  return String(value || "").slice(0, 16);
}

function dateTimeFromInput(value) {
  const [date, time] = value.split("T");
  return `${date}T${time}:00`;
}

function dateTimeInputFromDate(date) {
  return `${dateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDate(date, options) {
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

function formatEventDateTime(event) {
  const start = dateFromEvent(event.startAt);
  if (!start) return "";
  const startDate = formatDate(start, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (event.isAllDay) {
    const end = dateFromEvent(event.endAt);
    return end && dateKey(end) !== dateKey(start)
      ? `${startDate} – ${formatDate(end, { day: "numeric", month: "long", year: "numeric" })} · All day`
      : `${startDate} · All day`;
  }
  const startTime = String(event.startAt).slice(11, 16);
  const endDate = dateFromEvent(event.endAt);
  const endTime = String(event.endAt).slice(11, 16);
  return endDate && dateKey(endDate) !== dateKey(start)
    ? `${startDate}, ${startTime} – ${formatDate(endDate, { weekday: "long", day: "numeric", month: "long" })}, ${endTime}`
    : `${startDate}, ${startTime}–${endTime}`;
}

function allEvents() {
  return [
    ...calendarData.assessments.map(item => ({
      ...item,
      key: `assessment-${item.id}`,
      kind: "assessment",
      description: "",
      assessmentId: item.id
    })),
    ...calendarData.events.map(item => ({
      ...item,
      key: `event-${item.id}`,
      kind: "custom"
    }))
  ];
}

function eventOccursOnDate(event, date) {
  const dateString = dateKey(date);
  const startDate = String(event.startAt).slice(0, 10);
  const endDate = String(event.endAt).slice(0, 10);
  return dateString >= startDate && dateString <= endDate;
}

function eventsOnDate(date) {
  return allEvents().filter(event => eventOccursOnDate(event, date))
    .sort((left, right) => Number(right.isAllDay) - Number(left.isAllDay)
      || String(left.startAt).localeCompare(String(right.startAt))
      || left.title.localeCompare(right.title));
}

function categoryClass(event) {
  return `category-${categoryClasses[event.category] || "personal-event"}`;
}

function eventButton(event, compact = false) {
  const overdue = event.kind === "assessment" && event.status !== "Completed"
    && String(event.startAt).slice(0, 10) < dateKey(new Date());
  const time = !event.isAllDay ? `${String(event.startAt).slice(11, 16)} ` : "";
  return `<button type="button" class="calendar-event ${categoryClass(event)} ${event.kind === "assessment" ? "is-linked-deadline" : ""} ${overdue ? "is-overdue" : ""} ${compact ? "is-compact" : ""}" data-event-key="${escapeHtml(event.key)}" aria-label="${escapeHtml(`${event.title}${overdue ? ", overdue" : ""}`)}"><span>${escapeHtml(time)}${escapeHtml(event.title)}</span>${overdue ? '<i class="bi bi-exclamation-circle-fill" aria-hidden="true"></i>' : ""}</button>`;
}

function renderMonth() {
  const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 12);
  const gridStart = addDays(first, -((first.getDay() + 6) % 7));
  const todayKey = dateKey(new Date());
  const selectedKey = dateKey(currentDate);
  let html = `<div class="calendar-month-grid" role="grid" aria-label="${escapeHtml(formatDate(currentDate, { month: "long", year: "numeric" }))}">`;
  html += weekDays.map(day => `<div class="calendar-weekday" role="columnheader">${day.slice(0, 3)}</div>`).join("");
  for (let index = 0; index < 42; index++) {
    const date = addDays(gridStart, index);
    const key = dateKey(date);
    const events = eventsOnDate(date);
    const classes = [
      "calendar-day",
      date.getMonth() !== currentDate.getMonth() ? "is-outside-month" : "",
      key === todayKey ? "is-today" : key < todayKey ? "is-past" : "",
      key === selectedKey ? "is-selected" : ""
    ].filter(Boolean).join(" ");
    html += `<section class="${classes}" role="gridcell" aria-label="${escapeHtml(formatDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}">
      <button class="calendar-day-number" type="button" data-add-date="${key}" aria-label="Add event on ${escapeHtml(formatDate(date, { day: "numeric", month: "long", year: "numeric" }))}">${date.getDate()}</button>
      <div class="calendar-day-events">${events.map(event => eventButton(event, true)).join("")}</div>
    </section>`;
  }
  html += "</div>";
  return html;
}

function renderTimeView(dates) {
  const todayKey = dateKey(new Date());
  const minDayWidth = dates.length === 1 ? "240px" : "112px";
  let html = `<div class="calendar-time-scroll"><div class="calendar-time-grid" style="--calendar-days:${dates.length};--calendar-day-width:${minDayWidth}">
    <div class="calendar-time-corner" aria-hidden="true"></div>`;
  html += dates.map(date => {
    const key = dateKey(date);
    const events = eventsOnDate(date).filter(event => event.isAllDay);
    return `<div class="calendar-time-day-heading ${key === todayKey ? "is-today" : key < todayKey ? "is-past" : ""}">
      <button type="button" class="calendar-time-date" data-add-date="${key}" aria-label="Add all-day event on ${escapeHtml(formatDate(date, { day: "numeric", month: "long" }))}">${escapeHtml(formatDate(date, { weekday: "short", day: "numeric" }))}</button>
      <div class="calendar-allday-events">${events.map(event => eventButton(event, true)).join("")}</div>
    </div>`;
  }).join("");
  html += `<div class="calendar-time-labels">${hourLabels.map(hour => `<div>${String(hour).padStart(2, "0")}:00</div>`).join("")}</div>`;
  html += dates.map(date => {
    const key = dateKey(date);
    return `<div class="calendar-day-track ${key === todayKey ? "is-today" : key < todayKey ? "is-past" : ""}">${hourLabels.map(hour => {
      const events = eventsOnDate(date).filter(event => !event.isAllDay && String(event.startAt).slice(11, 13) === String(hour).padStart(2, "0"));
      return `<div class="calendar-hour-cell">
        <button class="calendar-time-slot" type="button" data-add-time="${key}T${String(hour).padStart(2, "0")}:00" aria-label="Add event on ${key} at ${String(hour).padStart(2, "0")}:00"></button>
        <div class="calendar-hour-events">${events.map(event => eventButton(event)).join("")}</div>
      </div>`;
    }).join("")}</div>`;
  }).join("");
  html += "</div></div>";
  return html;
}

function renderAgenda() {
  const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 12);
  const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 12);
  const events = allEvents().filter(event => {
    const eventStart = dateFromEvent(event.startAt);
    const eventEnd = dateFromEvent(event.endAt);
    return eventStart && eventEnd && eventStart <= end && eventEnd >= start;
  }).sort((left, right) => String(left.startAt).localeCompare(String(right.startAt)));
  if (!events.length) return '<div class="calendar-empty"><i class="bi bi-calendar2-check" aria-hidden="true"></i><p>No events this month.</p><span>Add an event or assessment to see it here.</span></div>';
  return `<div class="calendar-agenda">${events.map(event => {
    const eventDate = dateFromEvent(event.startAt);
    const overdue = event.kind === "assessment" && event.status !== "Completed"
      && String(event.startAt).slice(0, 10) < dateKey(new Date());
    return `<article class="calendar-agenda-item ${overdue ? "is-overdue" : ""}">
      <div class="calendar-agenda-date"><strong>${eventDate.getDate()}</strong><span>${escapeHtml(formatDate(eventDate, { month: "short" }))}</span></div>
      <span class="calendar-agenda-indicator ${categoryClass(event)}" aria-hidden="true"></span>
      <div class="calendar-agenda-copy"><button type="button" class="calendar-agenda-title" data-event-key="${escapeHtml(event.key)}">${escapeHtml(event.title)}</button><span>${escapeHtml(event.category)}${event.module ? ` · ${escapeHtml(event.module)}` : ""}${overdue ? " · Overdue" : ""}</span></div>
      <span class="calendar-agenda-time">${escapeHtml(formatEventDateTime(event))}</span>
    </article>`;
  }).join("")}</div>`;
}

function updateHeading() {
  const heading = document.querySelector("#calendarHeading");
  if (currentView === "month" || currentView === "agenda") {
    heading.textContent = formatDate(currentDate, { month: "long", year: "numeric" }) + (currentView === "agenda" ? " · Agenda" : "");
  } else if (currentView === "day") {
    heading.textContent = formatDate(currentDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } else {
    const start = startOfWeek(currentDate);
    const end = addDays(start, 6);
    heading.textContent = `${formatDate(start, { day: "numeric", month: "short" })} – ${formatDate(end, { day: "numeric", month: "short", year: "numeric" })}`;
  }
}

function renderCalendar() {
  updateHeading();
  document.querySelectorAll("[data-calendar-view]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.calendarView === currentView));
  });
  const canvas = document.querySelector("#calendarCanvas");
  if (currentView === "month") canvas.innerHTML = renderMonth();
  else if (currentView === "agenda") canvas.innerHTML = renderAgenda();
  else if (currentView === "day") canvas.innerHTML = renderTimeView([currentDate]);
  else {
    const start = startOfWeek(currentDate);
    canvas.innerHTML = renderTimeView(Array.from({ length: 7 }, (_, index) => addDays(start, index)));
  }
}

async function loadCalendarData() {
  const response = await fetch("/Calendar/Events", { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`Calendar data could not be loaded (HTTP ${response.status}).`);
  const data = await response.json();
  calendarData = {
    assessments: Array.isArray(data.assessments) ? data.assessments : [],
    events: Array.isArray(data.events) ? data.events : []
  };
  populateAssessmentOptions();
  renderCalendar();
}

function populateAssessmentOptions() {
  const select = document.querySelector("#calendarAssessment");
  const selectedId = select.value;
  select.innerHTML = '<option value="">None</option>' + calendarData.assessments
    .map(item => `<option value="${Number(item.id)}">${escapeHtml(item.title)} · ${escapeHtml(item.module)}</option>`).join("");
  select.value = selectedId;
}

function showCalendarError(message) {
  const error = document.querySelector("#calendarError");
  error.textContent = message;
  error.hidden = !message;
}

function eventByKey(key) {
  return allEvents().find(event => event.key === key);
}

function openEventDetails(event) {
  if (!event) return;
  selectedEvent = event;
  const dialog = document.querySelector("#calendarDetailDialog");
  const category = document.querySelector("#calendarDetailCategory");
  const body = document.querySelector("#calendarDetailBody");
  const edit = document.querySelector("#calendarEditEvent");
  const remove = document.querySelector("#calendarDeleteEvent");
  const openAssessment = document.querySelector("#calendarOpenAssessment");
  const editAssessment = document.querySelector("#calendarEditAssessment");
  document.querySelector("#calendarDetailTitle").textContent = event.title;
  category.textContent = event.kind === "assessment" ? "LINKED ASSESSMENT DEADLINE" : event.category.toUpperCase();
  openAssessment.hidden = event.kind !== "assessment";
  editAssessment.hidden = event.kind !== "assessment";
  edit.hidden = event.kind === "assessment";
  remove.hidden = event.kind === "assessment";

  if (event.kind === "assessment") {
    const today = dateKey(new Date());
    const overdue = event.status !== "Completed" && String(event.startAt).slice(0, 10) < today;
    const progress = Math.max(0, Math.min(100, Math.round(event.currentWords / Math.max(1, event.targetWords) * 100)));
    body.innerHTML = `<dl class="calendar-detail-list">
      <div><dt>Module</dt><dd>${escapeHtml(event.module)}</dd></div>
      <div><dt>Deadline</dt><dd>${escapeHtml(formatEventDateTime(event))}${overdue ? ' <strong class="calendar-overdue-label">Overdue</strong>' : ""}</dd></div>
      <div><dt>Target words</dt><dd>${Number(event.targetWords).toLocaleString()}</dd></div>
      <div><dt>Current progress</dt><dd>${Number(event.currentWords).toLocaleString()} / ${Number(event.targetWords).toLocaleString()} words (${progress}%)</dd></div>
      <div><dt>Priority</dt><dd>${escapeHtml(event.priority)}</dd></div>
      <div><dt>Status</dt><dd>${escapeHtml(event.status)}</dd></div>
    </dl>`;
    openAssessment.href = `/Assessments/Workspace/${Number(event.id)}`;
    editAssessment.href = `/?editAssessment=${Number(event.id)}`;
  } else {
    const relatedAssessment = event.assessmentId
      ? calendarData.assessments.find(item => item.id === event.assessmentId)
      : null;
    body.innerHTML = `<dl class="calendar-detail-list">
      <div><dt>When</dt><dd>${escapeHtml(formatEventDateTime(event))}</dd></div>
      <div><dt>Category</dt><dd>${escapeHtml(event.category)}</dd></div>
      ${event.module ? `<div><dt>Module</dt><dd>${escapeHtml(event.module)}</dd></div>` : ""}
      ${relatedAssessment ? `<div><dt>Related assessment</dt><dd><a href="/Assessments/Workspace/${Number(relatedAssessment.id)}">${escapeHtml(relatedAssessment.title)}</a></dd></div>` : ""}
      ${event.description ? `<div class="calendar-detail-description"><dt>Description</dt><dd>${escapeHtml(event.description)}</dd></div>` : ""}
    </dl>`;
  }
  if (!dialog.open) dialog.showModal();
}

function openEventForm({ date = currentDate, event = null, time = null } = {}) {
  const dialog = document.querySelector("#calendarEventDialog");
  const form = document.querySelector("#calendarEventForm");
  const allDay = document.querySelector("#calendarAllDay");
  const startDate = document.querySelector("#calendarStartDate");
  const endDate = document.querySelector("#calendarEndDate");
  const startAt = document.querySelector("#calendarStartAt");
  const endAt = document.querySelector("#calendarEndAt");
  form.reset();
  document.querySelector("#calendarFormError").hidden = true;
  document.querySelector("#calendarEventId").value = event?.id ?? "";
  document.querySelector("#calendarEventTitle").value = event?.title ?? "";
  document.querySelector("#calendarEventDescription").value = event?.description ?? "";
  document.querySelector("#calendarCategory").value = event?.category ?? "Study session";
  document.querySelector("#calendarModule").value = event?.module ?? "";
  document.querySelector("#calendarAssessment").value = event?.assessmentId ?? "";

  if (event?.isAllDay) {
    allDay.checked = true;
    startDate.value = String(event.startAt).slice(0, 10);
    endDate.value = String(event.endAt).slice(0, 10);
  } else {
    allDay.checked = !event && !time;
    if (event) {
      startAt.value = localDateTimeValue(event.startAt);
      endAt.value = localDateTimeValue(event.endAt);
      startDate.value = String(event.startAt).slice(0, 10);
      endDate.value = String(event.endAt).slice(0, 10);
    } else {
      const start = time ? new Date(`${time}:00`) : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 14, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      startDate.value = dateKey(start);
      endDate.value = dateKey(end);
      startAt.value = dateTimeInputFromDate(start);
      endAt.value = dateTimeInputFromDate(end);
    }
  }
  document.querySelector("#calendarEventDialogTitle").textContent = event ? "Edit event" : "Add event";
  document.querySelector("#calendarSaveEvent").textContent = event ? "Save changes" : "Save event";
  updateDateFields();
  if (!dialog.open) dialog.showModal();
  document.querySelector("#calendarEventTitle").focus();
}

function updateDateFields() {
  const isAllDay = document.querySelector("#calendarAllDay").checked;
  const dateFields = document.querySelector(".calendar-date-fields");
  const timeFields = document.querySelector(".calendar-time-fields");
  dateFields.hidden = !isAllDay;
  timeFields.hidden = isAllDay;
  document.querySelector("#calendarStartDate").required = isAllDay;
  document.querySelector("#calendarEndDate").required = isAllDay;
  document.querySelector("#calendarStartAt").required = !isAllDay;
  document.querySelector("#calendarEndAt").required = !isAllDay;
}

function setFormError(message) {
  const error = document.querySelector("#calendarFormError");
  error.textContent = message;
  error.hidden = false;
}

async function saveEvent(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const isAllDay = document.querySelector("#calendarAllDay").checked;
  const startValue = isAllDay ? document.querySelector("#calendarStartDate").value : document.querySelector("#calendarStartAt").value;
  const endValue = isAllDay ? document.querySelector("#calendarEndDate").value : document.querySelector("#calendarEndAt").value;
  if (document.querySelector("#calendarCategory").value === "Assessment deadline"
    && document.querySelector("#calendarAssessment").value) {
    setFormError("Assessment deadlines are synced from assessments. Edit the assessment instead of creating a linked copy.");
    return;
  }
  if (isAllDay ? endValue < startValue : endValue <= startValue) {
    setFormError("The end date and time must be after the start.");
    return;
  }
  const assessmentId = document.querySelector("#calendarAssessment").value;
  const payload = {
    id: document.querySelector("#calendarEventId").value
      ? Number(document.querySelector("#calendarEventId").value)
      : null,
    title: document.querySelector("#calendarEventTitle").value.trim(),
    description: document.querySelector("#calendarEventDescription").value.trim(),
    startAt: isAllDay ? `${startValue}T00:00:00` : dateTimeFromInput(startValue),
    endAt: isAllDay ? `${endValue}T00:00:00` : dateTimeFromInput(endValue),
    isAllDay,
    category: document.querySelector("#calendarCategory").value,
    moduleName: document.querySelector("#calendarModule").value.trim() || null,
    assessmentId: assessmentId ? Number(assessmentId) : null
  };
  const token = form.querySelector('[name="__RequestVerificationToken"]').value;
  const saveButton = document.querySelector("#calendarSaveEvent");
  saveButton.disabled = true;
  try {
    const response = await fetch("/Calendar/Events", {
      method: "POST",
      headers: { "Content-Type": "application/json", "RequestVerificationToken": token, Accept: "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "The event could not be saved.");
    document.querySelector("#calendarEventDialog").close();
    showCalendarError("");
    await loadCalendarData();
  } catch (error) {
    setFormError(error.message || "The event could not be saved. Please try again.");
  } finally {
    saveButton.disabled = false;
  }
}

async function deleteEvent() {
  if (!selectedEvent || selectedEvent.kind !== "custom") return;
  if (!window.confirm(`Delete “${selectedEvent.title}”? This cannot be undone.`)) return;
  const token = document.querySelector('#calendarEventForm [name="__RequestVerificationToken"]').value;
  try {
    const response = await fetch(`/Calendar/Events/${Number(selectedEvent.id)}`, {
      method: "DELETE",
      headers: { "RequestVerificationToken": token, Accept: "application/json" }
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message || "The event could not be deleted.");
    }
    document.querySelector("#calendarDetailDialog").close();
    history.replaceState(null, "", `/Calendar?date=${dateKey(currentDate)}`);
    selectedEvent = null;
    await loadCalendarData();
  } catch (error) {
    showCalendarError(error.message || "The event could not be deleted.");
  }
}

function movePeriod(amount) {
  if (currentView === "month" || currentView === "agenda") {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + amount, 1, 12);
  } else {
    currentDate = addDays(currentDate, amount * (currentView === "week" ? 7 : 1));
  }
  renderCalendar();
}

export function initCalendar() {
  const canvas = document.querySelector("#calendarCanvas");
  document.querySelector("#calendarPrevious").addEventListener("click", () => movePeriod(-1));
  document.querySelector("#calendarNext").addEventListener("click", () => movePeriod(1));
  document.querySelector("#calendarToday").addEventListener("click", () => {
    currentDate = new Date();
    renderCalendar();
  });
  document.querySelectorAll("[data-calendar-view]").forEach(button => button.addEventListener("click", () => {
    currentView = button.dataset.calendarView;
    renderCalendar();
  }));
  document.querySelector("#calendarAddEvent").addEventListener("click", () => openEventForm());
  document.querySelector("#calendarAllDay").addEventListener("change", updateDateFields);
  ["#calendarCategory", "#calendarAssessment"].forEach(selector => {
    document.querySelector(selector).addEventListener("change", () => {
      document.querySelector("#calendarFormError").hidden = true;
    });
  });
  document.querySelector("#calendarEventForm").addEventListener("submit", saveEvent);
  document.querySelectorAll("#calendarCloseEvent, #calendarCancelEvent").forEach(button =>
    button.addEventListener("click", () => document.querySelector("#calendarEventDialog").close()));
  document.querySelector("#calendarCloseDetail").addEventListener("click", () => document.querySelector("#calendarDetailDialog").close());
  document.querySelector("#calendarEditEvent").addEventListener("click", () => {
    const event = selectedEvent;
    document.querySelector("#calendarDetailDialog").close();
    openEventForm({ event });
  });
  document.querySelector("#calendarDeleteEvent").addEventListener("click", deleteEvent);
  canvas.addEventListener("click", event => {
    const eventButton = event.target.closest("[data-event-key]");
    if (eventButton) {
      openEventDetails(eventByKey(eventButton.dataset.eventKey));
      return;
    }
    const timedSlot = event.target.closest("[data-add-time]");
    if (timedSlot) {
      const [date, time] = timedSlot.dataset.addTime.split("T");
      openEventForm({ date: parseDateKey(date), time: `${date}T${time}` });
      return;
    }
    const dateButton = event.target.closest("[data-add-date]");
    if (dateButton) openEventForm({ date: parseDateKey(dateButton.dataset.addDate) });
  });
  const requestedEvent = new URLSearchParams(location.search).get("event");

  loadCalendarData().then(() => {
    if (requestedEvent) {
      const event = eventByKey(requestedEvent);
      if (event) {
        currentDate = dateFromEvent(event.startAt) || currentDate;
        renderCalendar();
        openEventDetails(event);
      }
    }
  }).catch(error => {
    showCalendarError(error.message || "Calendar data could not be loaded. Refresh to try again.");
    document.querySelector("#calendarCanvas").innerHTML = "";
  });
}
