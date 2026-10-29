import { getLocalDateString, loadDashboardData, saveDashboardData } from "./storage.js";

let dashboardData = loadDashboardData();
let toastTimeout;

function getServerAssessments() {
  try { return JSON.parse(document.querySelector("#assessmentData")?.textContent || "[]"); }
  catch { return []; }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function daysUntil(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(`${dateString}T00:00:00`);
  return Math.round((deadline - today) / 86400000);
}

function formatShortDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return { day: new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(date), month: new Intl.DateTimeFormat(undefined, { month: "short" }).format(date) };
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

function getWeekdayLabels() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 6);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date), date: getLocalDateString(date), isToday: getLocalDateString(date) === getLocalDateString(today) };
  });
}

function renderStats() {
  const active = dashboardData.assessments.filter(item => item.status !== "Completed");
  const completed = dashboardData.assessments.filter(item => item.status === "Completed").length;
  const upcoming = active.filter(item => {
    const remaining = daysUntil(item.deadline);
    return remaining >= 0 && remaining <= 7;
  }).length;
  const plannedHours = dashboardData.weeklyStudyHours.reduce((total, hours) => total + Number(hours || 0), 0);
  const goal = Math.max(0, Number(dashboardData.weeklyGoalHours) || 0);
  const goalPercent = goal ? Math.min(100, Math.round((plannedHours / goal) * 100)) : 0;

  document.querySelector('[data-stat="activeAssessments"]').textContent = active.length;
  document.querySelector('[data-stat="completedAssessments"]').textContent = `${completed} completed this term`;
  document.querySelector('[data-stat="upcomingDeadlines"]').textContent = upcoming;
  document.querySelectorAll('[data-stat="plannedHours"]').forEach(element => element.textContent = Number.isInteger(plannedHours) ? plannedHours : plannedHours.toFixed(1));
  document.querySelector('[data-stat="goalHours"]').textContent = goal;
  const progress = document.querySelector(".goal-progress");
  progress.setAttribute("aria-valuenow", String(goalPercent));
  document.querySelector("#goalProgressBar").style.width = `${goalPercent}%`;
}

function renderTasks() {
  const today = getLocalDateString();
  const tasks = dashboardData.tasks.filter(task => task.date === today);
  const list = document.querySelector("#todayTasks");
  if (!tasks.length) {
    list.innerHTML = '<div class="empty-state"><i class="bi bi-check2-circle" aria-hidden="true"></i>Your day is clear. Add a task when you are ready.</div>';
    return;
  }

  list.innerHTML = tasks.map(task => `
    <article class="task-row ${task.completed ? "is-complete" : ""}">
      <button class="task-check" type="button" data-task-id="${escapeHtml(task.id)}" aria-label="${task.completed ? "Mark incomplete" : "Mark complete"}: ${escapeHtml(task.title)}" aria-pressed="${task.completed}"><i class="bi bi-check-lg" aria-hidden="true"></i></button>
      <div class="task-main">
        <span class="task-title">${escapeHtml(task.title)}</span>
        <span class="task-meta"><span>${escapeHtml(task.module)}</span><span class="meta-separator"></span><span>${escapeHtml(task.category)}</span><span class="priority-label priority-${escapeHtml(task.priority)}">${escapeHtml(task.priority)}</span></span>
      </div>
      <span class="task-duration">${formatDuration(Number(task.duration) || 0)}</span>
    </article>`).join("");
}

function renderDeadlines() {
  const list = document.querySelector("#upcomingDeadlinesList");
  const upcoming = [...dashboardData.assessments]
    .sort((left, right) => left.deadline.localeCompare(right.deadline));

  if (!upcoming.length) {
    list.innerHTML = '<div class="empty-state"><i class="bi bi-calendar2-check" aria-hidden="true"></i>No upcoming deadlines. You have room to breathe.</div>';
    return;
  }

  list.innerHTML = upcoming.map(item => {
    const remaining = daysUntil(item.deadline);
    const date = formatShortDate(item.deadline);
    const isCompleted = item.status === "Completed";
    const urgency = isCompleted ? "Completed" : remaining < 0 ? `Overdue · ${Math.abs(remaining)} days` : remaining === 0 ? "Due today" : remaining === 1 ? "1 day left" : `${remaining} days left`;
    const urgencyClass = !isCompleted && remaining < 0 ? "overdue" : !isCompleted && remaining <= 2 ? "urgent" : "";
    const progress = Math.max(0, Math.min(100, Math.round((Number(item.currentWords) / Math.max(1, Number(item.targetWords))) * 100)));
    const token = document.querySelector('#assessmentForm input[name="__RequestVerificationToken"]')?.value || "";
    return `<article class="deadline-item">
      <div class="deadline-date"><strong>${escapeHtml(date.day)}</strong><span>${escapeHtml(date.month)}</span></div>
      <div class="deadline-content">
        <div class="deadline-title-row"><span class="deadline-title">${escapeHtml(item.title)}</span><span class="deadline-status ${urgencyClass}">${escapeHtml(urgency)}</span></div>
        <div class="deadline-module">${escapeHtml(item.module)} · ${Number(item.currentWords).toLocaleString()} / ${Number(item.targetWords).toLocaleString()} words · ${escapeHtml(item.priority)} priority</div>
        <div class="deadline-progress-row"><div class="deadline-progress" role="progressbar" aria-label="${escapeHtml(item.title)} completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div><span class="deadline-progress-label">${progress}%</span></div>
        <div class="assessment-actions"><button class="text-button assessment-edit" type="button" data-assessment="${escapeHtml(JSON.stringify(item))}">Edit</button><form class="assessment-delete-form" action="/Assessments/Delete" method="post"><input type="hidden" name="__RequestVerificationToken" value="${escapeHtml(token)}"><input type="hidden" name="id" value="${Number(item.id)}"><button class="text-button delete-button" type="submit">Delete</button></form></div>
      </div>
    </article>`;
  }).join("");
}

function renderWeeklyChart() {
  const chart = document.querySelector("#weeklyChart");
  const days = getWeekdayLabels();
  const values = days.map((_, index) => Math.max(0, Number(dashboardData.weeklyStudyHours[index]) || 0));
  const maxHours = Math.max(3, ...values);
  chart.setAttribute("aria-label", `Planned study hours for the last seven days. ${values.reduce((sum, value) => sum + value, 0)} hours total.`);
  chart.innerHTML = days.map((day, index) => {
    const hours = values[index];
    const height = hours ? Math.max(8, Math.round((hours / maxHours) * 100)) : 3;
    return `<div class="chart-day ${day.isToday ? "is-today" : ""}"><div class="chart-bar-wrap"><span class="chart-bar ${day.isToday ? "is-today" : ""}" style="height:${height}%" data-hours="${hours}" aria-label="${day.label}: ${hours} planned hours"></span></div><span class="chart-day-label">${escapeHtml(day.label)}</span></div>`;
  }).join("");
}

function renderDashboard() {
  renderStats();
  renderTasks();
  renderDeadlines();
  renderWeeklyChart();
}

function openTaskDialog() {
  document.querySelector("#taskForm").reset();
  document.querySelector("#taskDialog").showModal();
  document.querySelector("#taskTitle").focus();
}

function addTask(form) {
  const formData = new FormData(form);
  const title = String(formData.get("title") || "").trim();
  if (!title) return;

  dashboardData.tasks.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `task-${Date.now()}`,
    title,
    module: String(formData.get("module")),
    duration: Number(formData.get("duration")),
    category: String(formData.get("category")),
    priority: String(formData.get("priority")),
    date: getLocalDateString(),
    completed: false
  });
  const saved = saveDashboardData(dashboardData);
  renderDashboard();
  document.querySelector("#taskDialog").close();
  showToast(saved ? "Task added to today's study plan." : "Task added for this session, but browser storage is unavailable.");
}

function getDemoReply(message) {
  const normalized = message.toLowerCase();
  const pendingTasks = dashboardData.tasks.filter(task => task.date === getLocalDateString() && !task.completed);
  const nextAssessment = dashboardData.assessments
    .filter(item => item.status !== "Completed")
    .sort((left, right) => left.deadline.localeCompare(right.deadline))[0];

  if (/(focus|today|start)/.test(normalized)) {
    if (pendingTasks.length) return `Demo suggestion: start with “${pendingTasks[0].title}” (${formatDuration(pendingTasks[0].duration)}). It's marked ${pendingTasks[0].priority} priority in your sample plan.`;
    return "Demo suggestion: your sample plan is clear for today. Add one focused task to get started.";
  }
  if (/(deadline|assignment|break down|finish)/.test(normalized) && nextAssessment) {
    const remaining = daysUntil(nextAssessment.deadline);
    return `Demo suggestion: “${nextAssessment.title}” is next, due in ${Math.max(0, remaining)} days. Try splitting it into research, a first draft, and one editing session.`;
  }
  return "Demo reply: choose one small, specific task and give it a focused 25-minute start. This preview uses simple local rules, not an AI service.";
}

export function showToast(message) {
  const toast = document.querySelector("#toastMessage");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

export function initDashboard() {
  dashboardData.assessments = getServerAssessments();
  const now = new Date();
  document.querySelector("#currentDate").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(now).toUpperCase();

  document.querySelectorAll("#addTaskButton, #todayAddButton").forEach(button => button.addEventListener("click", openTaskDialog));
  document.querySelector("#taskForm").addEventListener("submit", event => {
    event.preventDefault();
    addTask(event.currentTarget);
  });
  document.querySelectorAll("#closeTaskDialog, #cancelTaskDialog").forEach(button => button.addEventListener("click", () => document.querySelector("#taskDialog").close()));
  document.querySelector("#taskDialog").addEventListener("click", event => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
  document.querySelector("#todayTasks").addEventListener("click", event => {
    const button = event.target.closest("[data-task-id]");
    if (!button) return;
    const task = dashboardData.tasks.find(item => item.id === button.dataset.taskId);
    if (!task) return;
    task.completed = !task.completed;
    const saved = saveDashboardData(dashboardData);
    renderDashboard();
    if (!saved) showToast("Updated for this session. Browser storage is unavailable.");
  });
  const assessmentDialog = document.querySelector("#assessmentDialog");
  const assessmentForm = document.querySelector("#assessmentForm");
  const openAssessmentForm = assessment => {
    assessmentForm.reset();
    assessmentForm.querySelector('[name="AssessmentForm.Id"]').value = assessment?.id ?? "";
    assessmentForm.querySelector('[name="AssessmentForm.Title"]').value = assessment?.title ?? "";
    assessmentForm.querySelector('[name="AssessmentForm.ModuleName"]').value = assessment?.module ?? "";
    assessmentForm.querySelector('[name="AssessmentForm.Deadline"]').value = assessment?.deadline ?? "";
    assessmentForm.querySelector('[name="AssessmentForm.TargetWordCount"]').value = assessment?.targetWords ?? 1000;
    assessmentForm.querySelector('[name="AssessmentForm.CurrentWordCount"]').value = assessment?.currentWords ?? 0;
    assessmentForm.querySelector('[name="AssessmentForm.Priority"]').value = assessment?.priority ?? "Medium";
    assessmentForm.querySelector('[name="AssessmentForm.Status"]').value = assessment?.status ?? "In progress";
    assessmentForm.querySelector(".validation-summary").textContent = "";
    assessmentDialog.querySelector("#assessmentDialogTitle").textContent = assessment ? "Edit assessment" : "Add assessment";
    assessmentForm.querySelector("#saveAssessmentButton").textContent = "Save assessment";
    // The direct create route uses an `open` attribute as a no-JavaScript fallback.
    // Promote that non-modal dialog to a real modal when JavaScript is available.
    if (assessmentDialog.open) assessmentDialog.close();
    assessmentDialog.showModal();
    assessmentForm.querySelector('[name="AssessmentForm.Title"]').focus();
  };
  document.querySelectorAll("#closeAssessmentDialog, #cancelAssessmentDialog").forEach(button => button.addEventListener("click", () => assessmentDialog.close()));
  assessmentDialog.addEventListener("click", event => { if (event.target === assessmentDialog) assessmentDialog.close(); });
  document.querySelector("#assessmentList").addEventListener("click", event => {
    const button = event.target.closest(".assessment-edit");
    if (!button) return;
    try { openAssessmentForm(JSON.parse(button.dataset.assessment)); }
    catch { showToast("Could not open this assessment. Refresh the page and try again."); }
  });
  document.querySelector("#assessmentList").addEventListener("submit", event => {
    if (!event.target.matches(".assessment-delete-form")) return;
    const item = dashboardData.assessments.find(assessment => assessment.id === Number(event.target.elements.id.value));
    if (!window.confirm(`Delete “${item?.title || "this assessment"}”? This cannot be undone.`)) event.preventDefault();
  });
  assessmentForm.addEventListener("submit", () => {
    const button = assessmentForm.querySelector("#saveAssessmentButton");
    button.disabled = true;
    button.textContent = "Saving…";
  });
  const flashMessage = document.querySelector(".welcome-row")?.dataset.flashMessage;
  if (flashMessage) showToast(flashMessage);
  document.querySelector("#assistantForm").addEventListener("submit", event => {
    event.preventDefault();
    const input = document.querySelector("#assistantInput");
    const prompt = input.value.trim();
    if (!prompt) {
      input.focus();
      return;
    }
    const response = document.querySelector("#assistantResponse");
    response.textContent = getDemoReply(prompt);
    response.hidden = false;
    input.value = "";
  });
  document.querySelectorAll("[data-prompt]").forEach(button => button.addEventListener("click", () => {
    const input = document.querySelector("#assistantInput");
    input.value = button.dataset.prompt;
    input.focus();
    document.querySelector("#assistantForm").requestSubmit();
  }));

  const semesterSelect = document.querySelector("#semesterSelect");
  semesterSelect.value = dashboardData.semester;
  semesterSelect.addEventListener("change", () => {
    dashboardData.semester = semesterSelect.value;
    saveDashboardData(dashboardData);
    showToast(`Workspace set to ${semesterSelect.value}.`);
  });

  renderDashboard();
  const assessmentList = document.querySelector("#assessmentList");
  if (!dashboardData.assessments.length) {
    assessmentList.innerHTML = '<div class="empty-state">No assessments yet. Add one to start tracking your coursework.</div>';
  } else {
    assessmentList.innerHTML = dashboardData.assessments.map(item => {
      const remaining = daysUntil(item.deadline);
      const progress = Math.max(0, Math.min(100, Math.round((Number(item.currentWords) / Math.max(1, Number(item.targetWords))) * 100)));
      const urgency = item.status === "Completed" ? "Completed" : remaining < 0 ? `Overdue by ${Math.abs(remaining)} days` : remaining === 0 ? "Due today" : `${remaining} days remaining`;
      const urgencyClass = item.status !== "Completed" && remaining < 0 ? "overdue" : "";
      return `<article class="assessment-card"><div class="assessment-card-main"><div class="assessment-card-title"><h3>${escapeHtml(item.title)}</h3><span class="deadline-status ${urgencyClass}">${escapeHtml(urgency)}</span></div><p>${escapeHtml(item.module)} · ${escapeHtml(item.priority)} priority · ${escapeHtml(item.status)}</p><p>${Number(item.currentWords).toLocaleString()} of ${Number(item.targetWords).toLocaleString()} words</p><div class="deadline-progress" role="progressbar" aria-label="${escapeHtml(item.title)} word count progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div></div><div class="assessment-card-actions"><a class="button button-primary" href="/Assessments/Workspace/${Number(item.id)}"><i class="bi bi-pencil-square" aria-hidden="true"></i>Open workspace</a><button class="button button-secondary assessment-edit" type="button" data-assessment="${escapeHtml(JSON.stringify(item))}">Edit</button><form class="assessment-delete-form" action="/Assessments/Delete" method="post"><input type="hidden" name="__RequestVerificationToken" value="${escapeHtml(document.querySelector('#assessmentForm input[name="__RequestVerificationToken"]')?.value || "")}"><input type="hidden" name="id" value="${Number(item.id)}"><button class="button button-secondary delete-button" type="submit">Delete</button></form></div></article>`;
    }).join("");
  }
}
