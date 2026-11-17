const storageKey = "studyflow.dashboard.v1";

function localDateOffset(offset) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createInitialDashboardData() {
  return {
    semester: "Autumn 2026",
    weeklyGoalHours: 12,
    tasks: [
      { id: "task-1", title: "Review database normalization notes", module: "Computer Science", duration: 45, category: "Review", priority: "high", date: localDateOffset(0), completed: false },
      { id: "task-2", title: "Outline research methods section", module: "Human-Computer Interaction", duration: 60, category: "Writing", priority: "medium", date: localDateOffset(0), completed: false },
      { id: "task-3", title: "Complete practice problem set 4", module: "Data Science", duration: 50, category: "Practice", priority: "low", date: localDateOffset(0), completed: true }
    ],
    assessments: [
      { id: "assessment-1", title: "Database Design Report", module: "Computer Science", moduleCode: "CS204", deadline: localDateOffset(2), targetWords: 2500, progress: 64, status: "In progress" },
      { id: "assessment-2", title: "Research Methods Proposal", module: "Human-Computer Interaction", moduleCode: "HCI210", deadline: localDateOffset(6), targetWords: 1800, progress: 38, status: "In progress" },
      { id: "assessment-3", title: "Data Visualization Portfolio", module: "Data Science", moduleCode: "DS305", deadline: localDateOffset(11), targetWords: 1200, progress: 82, status: "In progress" },
      { id: "assessment-4", title: "Ethics Reflection", module: "Human-Computer Interaction", moduleCode: "HCI210", deadline: localDateOffset(-2), targetWords: 1000, progress: 100, status: "Completed" }
    ],
    weeklyStudyHours: [1.5, 2, 0.5, 2.5, 1, 3, 1]
  };
}

function hasExpectedShape(data) {
  return data && Array.isArray(data.tasks) && Array.isArray(data.assessments)
    && Array.isArray(data.weeklyStudyHours) && data.weeklyStudyHours.length === 7;
}

export function loadDashboardData() {
  const defaults = createInitialDashboardData();
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      saveDashboardData(defaults);
      return defaults;
    }

    const parsed = JSON.parse(stored);
    if (!hasExpectedShape(parsed)) return defaults;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function saveDashboardData(data) {
  try {
    // Keep any legacy assessment records in localStorage untouched. Assessments now
    // belong to the server database, while tasks and preferences remain browser-local.
    let previous;
    try { previous = JSON.parse(localStorage.getItem(storageKey) || "null"); } catch { previous = null; }
    const dataToSave = previous && Array.isArray(previous.assessments)
      ? { ...data, assessments: previous.assessments }
      : data;
    localStorage.setItem(storageKey, JSON.stringify(dataToSave));
    return true;
  } catch {
    return false;
  }
}

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
