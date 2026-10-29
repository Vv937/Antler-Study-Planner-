export function countWords(text) {
  const matches = String(text ?? "").match(/(?:\p{N}+(?:[.,]\p{N}+)*|[\p{L}\p{N}]+(?:['’‐‑–-][\p{L}\p{N}]+)*)/gu);
  return matches ? matches.length : 0;
}

export function calculateProgress(currentWords, targetWords) {
  const parsedCurrent = Number(currentWords);
  const current = Number.isFinite(parsedCurrent) ? Math.max(0, parsedCurrent) : 0;
  const target = Number(targetWords);
  if (!Number.isFinite(target) || target <= 0) {
    return { currentWords: current, targetWords: 0, remainingWords: 0, percent: 0 };
  }
  return {
    currentWords: current,
    targetWords: target,
    remainingWords: Math.max(0, target - current),
    percent: Math.min(100, Math.round((current / target) * 100))
  };
}

export function daysUntilDeadline(deadline, now = new Date()) {
  if (typeof deadline !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return null;
  const deadlineDate = new Date(`${deadline}T00:00:00Z`);
  if (Number.isNaN(deadlineDate.getTime()) || deadlineDate.toISOString().slice(0, 10) !== deadline) return null;
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return null;

  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((deadlineDate.getTime() - todayUtc) / 86400000);
}

export function validateWritingSettings({
  writingSpeedWordsPerHour, proofreadingPercent, availableHoursPerDay
}) {
  const speed = Number(writingSpeedWordsPerHour);
  const proofread = Number(proofreadingPercent);
  const dailyHours = Number(availableHoursPerDay);

  if (!Number.isInteger(speed) || speed < 1 || speed > 10000) {
    return "Writing speed must be a whole number between 1 and 10,000 words per hour.";
  }
  if (!Number.isInteger(proofread) || proofread < 0 || proofread > 100) {
    return "Proofreading allowance must be a whole number between 0% and 100%.";
  }
  if (!Number.isInteger(dailyHours) || dailyHours < 1 || dailyHours > 24) {
    return "Available hours must be a whole number between 1 and 24 per day.";
  }
  return null;
}

export function calculateWritingEstimate({
  remainingWords, writingSpeedWordsPerHour, proofreadingPercent,
  availableHoursPerDay, daysUntilDeadline
}) {
  const words = Number(remainingWords);
  const speed = Number(writingSpeedWordsPerHour);
  const proofread = Number(proofreadingPercent);
  const dailyHours = Number(availableHoursPerDay);
  const hasDeadline = daysUntilDeadline !== null && daysUntilDeadline !== undefined && daysUntilDeadline !== "";
  const days = hasDeadline ? Number(daysUntilDeadline) : null;

  if (!Number.isFinite(words) || words < 0) return { valid: false, message: "Remaining words must be zero or more." };
  const settingsError = validateWritingSettings({
    writingSpeedWordsPerHour: speed,
    proofreadingPercent: proofread,
    availableHoursPerDay: dailyHours
  });
  if (settingsError) return { valid: false, message: settingsError };
  if (hasDeadline && !Number.isFinite(days)) return { valid: false, message: "The assessment deadline is invalid." };

  const writingHours = words / speed;
  const proofreadingHours = writingHours * proofread / 100;
  const totalHours = writingHours + proofreadingHours;
  const availableHours = days === null ? null : Math.max(0, days) * dailyHours;
  const overdue = days !== null && days < 0;
  return {
    valid: true,
    writingHours,
    proofreadingHours,
    totalHours,
    availableHours,
    fitsBeforeDeadline: days === null ? null : !overdue && totalHours <= availableHours,
    overdue
  };
}

export function formatHours(hours) {
  if (hours <= 0) return "0 min";
  const totalMinutes = Math.round(hours * 60);
  if (totalMinutes < 1) return "less than a minute";
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${wholeHours} hr ${minutes} min` : `${wholeHours} hr`;
}

function initWritingWorkspace() {
  const root = document.querySelector("#writingWorkspace");
  if (!root) return;

  const editor = document.querySelector("#draftEditor");
  const speedInput = document.querySelector("#writingSpeed");
  const proofreadingInput = document.querySelector("#proofreadingPercent");
  const dailyHoursInput = document.querySelector("#availableHoursPerDay");
  const saveButton = document.querySelector("#saveDraftButton");
  const retryButton = document.querySelector("#retrySaveButton");
  const reloadButton = document.querySelector("#reloadDraftButton");
  const saveStatus = document.querySelector("#draftSaveStatus");
  const deadline = root.dataset.deadline;
  const targetWords = Number(root.dataset.targetWords);
  const saveUrl = root.dataset.saveUrl;
  const token = document.querySelector('#draftSecurity input[name="__RequestVerificationToken"]')?.value;

  let revision = Number(root.dataset.revision) || 0;
  let savedContent = editor.value;
  const readWritingSettings = () => ({
    writingSpeedWordsPerHour: Number(speedInput.value),
    proofreadingPercent: Number(proofreadingInput.value),
    availableHoursPerDay: Number(dailyHoursInput.value)
  });
  const initialSettings = readWritingSettings();
  let lastValidSettings = validateWritingSettings(initialSettings)
    ? { writingSpeedWordsPerHour: 300, proofreadingPercent: 15, availableHoursPerDay: 2 }
    : initialSettings;
  let saveTimer;
  let saveInFlight = false;
  let saveAgain = false;
  let hasUnsavedChanges = false;
  let hasConflict = false;
  let hasInvalidEstimatorInput = false;

  const setSaveStatus = (message, state = "") => {
    saveStatus.textContent = message;
    saveStatus.dataset.state = state;
  };

  const deadlineDaysRemaining = () => daysUntilDeadline(deadline);
  const availableCalendarDays = () => {
    const daysRemaining = deadlineDaysRemaining();
    return daysRemaining === null ? null : daysRemaining < 0 ? daysRemaining : daysRemaining + 1;
  };
  const deadlineCountdown = document.querySelector("#deadlineCountdown");
  const updateDeadlineCountdown = days => {
    if (days === null) {
      deadlineCountdown.textContent = "No valid deadline is set.";
    } else if (days < 0) {
      const overdueDays = Math.abs(days);
      deadlineCountdown.textContent = `Overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"}.`;
    } else if (days === 0) {
      deadlineCountdown.textContent = "Due today.";
    } else if (days === 1) {
      deadlineCountdown.textContent = "Due tomorrow.";
    } else {
      deadlineCountdown.textContent = `Due in ${days} days.`;
    }
  };

  const updateMetrics = () => {
    const progress = calculateProgress(countWords(editor.value), targetWords);
    const hasTarget = Number.isFinite(targetWords) && targetWords > 0;
    document.querySelector("#currentWordCount").textContent = progress.currentWords.toLocaleString();
    document.querySelector("#targetWordCount").textContent = hasTarget ? progress.targetWords.toLocaleString() : "Not set";
    document.querySelector("#remainingWordCount").textContent = hasTarget ? progress.remainingWords.toLocaleString() : "—";
    document.querySelector("#wordProgressPercent").textContent = hasTarget ? `${progress.percent}%` : "—";
    const bar = document.querySelector("#writingProgressBar");
    const visiblePercent = hasTarget ? progress.percent : 0;
    bar.style.width = `${visiblePercent}%`;
    bar.parentElement.setAttribute("aria-valuenow", String(visiblePercent));
    bar.parentElement.setAttribute("aria-valuetext", hasTarget
      ? `${visiblePercent}% complete`
      : "Target word count not set");

    const daysRemaining = deadlineDaysRemaining();
    updateDeadlineCountdown(daysRemaining);
    const estimate = calculateWritingEstimate({
      remainingWords: hasTarget ? progress.remainingWords : 0,
      writingSpeedWordsPerHour: speedInput.value,
      proofreadingPercent: proofreadingInput.value,
      availableHoursPerDay: dailyHoursInput.value,
      daysUntilDeadline: availableCalendarDays()
    });
    const estimateError = document.querySelector("#estimateValidation");
    const warning = document.querySelector("#deadlineWarning");
    warning.dataset.state = "neutral";
    if (!hasTarget) {
      estimateError.textContent = "";
      document.querySelector("#estimatedWritingTime").textContent = "—";
      document.querySelector("#estimatedProofreadingTime").textContent = "—";
      document.querySelector("#estimatedTotalTime").textContent = "—";
      warning.textContent = daysRemaining !== null && daysRemaining < 0
        ? "This assessment deadline has passed."
        : "Set a target word count in assessment details to estimate the work remaining.";
      warning.dataset.state = daysRemaining !== null && daysRemaining < 0 ? "overdue" : "neutral";
    } else if (!estimate.valid) {
      estimateError.textContent = estimate.message;
      warning.textContent = "";
      document.querySelector("#estimatedWritingTime").textContent = "—";
      document.querySelector("#estimatedProofreadingTime").textContent = "—";
      document.querySelector("#estimatedTotalTime").textContent = "—";
    } else {
      estimateError.textContent = "";
      document.querySelector("#estimatedWritingTime").textContent = formatHours(estimate.writingHours);
      document.querySelector("#estimatedProofreadingTime").textContent = formatHours(estimate.proofreadingHours);
      document.querySelector("#estimatedTotalTime").textContent = formatHours(estimate.totalHours);
      if (estimate.overdue) {
        warning.textContent = "This assessment deadline has passed. The estimate cannot fit before the deadline.";
        warning.dataset.state = "overdue";
      } else if (estimate.fitsBeforeDeadline === null) {
        warning.textContent = "Add a deadline in assessment details to compare this estimate with the available time.";
      } else if (estimate.fitsBeforeDeadline) {
        warning.textContent = "The estimated work may fit before the deadline; this is a planning estimate, not a guarantee.";
      } else {
        warning.textContent = `This estimate may not fit: it needs about ${formatHours(estimate.totalHours)}, with about ${formatHours(estimate.availableHours)} available at ${dailyHoursInput.value} focused writing hour(s) per day.`;
        warning.dataset.state = "warning";
      }
    }
    return progress;
  };

  const createPayload = () => ({
    content: editor.value,
    revision,
    ...lastValidSettings
  });

  const payloadKey = payload => JSON.stringify({
    content: payload.content,
    writingSpeedWordsPerHour: payload.writingSpeedWordsPerHour,
    proofreadingPercent: payload.proofreadingPercent,
    availableHoursPerDay: payload.availableHoursPerDay
  });

  const scheduleSave = () => {
    if (hasConflict) return;
    hasUnsavedChanges = true;
    setSaveStatus("Unsaved changes", "pending");
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveDraft, 800);
  };

  async function saveDraft() {
    window.clearTimeout(saveTimer);
    const payload = createPayload();
    updateMetrics();
    if (!token) {
      setSaveStatus("Save failed: security token is missing. Reload the workspace and try again.", "error");
      retryButton.hidden = false;
      return;
    }
    if (hasConflict) return;
    if (saveInFlight) {
      saveAgain = true;
      return;
    }

    saveInFlight = true;
    saveAgain = false;
    const savedPayloadKey = payloadKey(payload);
    setSaveStatus("Saving…", "saving");
    saveButton.disabled = true;
    retryButton.hidden = true;
    try {
      const response = await fetch(saveUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "RequestVerificationToken": token },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 409) {
        hasConflict = true;
        hasUnsavedChanges = true;
        setSaveStatus(result.message || "This draft changed in another session. Reload before saving again to avoid overwriting it.", "error");
        reloadButton.hidden = false;
        return;
      }
      if (!response.ok) throw new Error(result.message || "The server could not save this draft.");

      revision = result.revision;
      root.dataset.revision = String(revision);
      hasUnsavedChanges = payloadKey(createPayload()) !== savedPayloadKey;
      if (hasUnsavedChanges || saveAgain) {
        saveAgain = false;
        window.clearTimeout(saveTimer);
        setSaveStatus("Saving newer changes…", "saving");
        saveTimer = window.setTimeout(saveDraft, 0);
      } else {
        savedContent = payload.content;
        const settingsError = validateWritingSettings(readWritingSettings());
        setSaveStatus(settingsError
          ? `Draft saved at ${result.updatedAt}. Invalid estimator settings were not saved: ${settingsError}`
          : `Saved at ${result.updatedAt}.`, settingsError ? "error" : "saved");
      }
    } catch (error) {
      hasUnsavedChanges = true;
      setSaveStatus(`Save failed: ${error.message} Your draft is still in this editor; retry when the connection is available.`, "error");
      retryButton.hidden = false;
    } finally {
      saveInFlight = false;
      saveButton.disabled = false;
      if (saveAgain && !hasConflict) {
        saveAgain = false;
        saveTimer = window.setTimeout(saveDraft, 0);
      }
    }
  }

  editor.addEventListener("input", () => {
    updateMetrics();
    scheduleSave();
  });
  [speedInput, proofreadingInput, dailyHoursInput].forEach(input => input.addEventListener("input", () => {
    updateMetrics();
    const settings = readWritingSettings();
    const settingsError = validateWritingSettings(settings);
    hasInvalidEstimatorInput = Boolean(settingsError);
    if (settingsError) {
      if (editor.value !== savedContent || hasUnsavedChanges) {
        scheduleSave();
      } else {
        window.clearTimeout(saveTimer);
        setSaveStatus(`Estimator settings not saved: ${settingsError}`, "error");
        retryButton.hidden = true;
      }
      return;
    }

    lastValidSettings = settings;
    scheduleSave();
  }));
  saveButton.addEventListener("click", saveDraft);
  retryButton.addEventListener("click", () => {
    hasConflict = false;
    reloadButton.hidden = true;
    saveDraft();
  });
  reloadButton.addEventListener("click", () => window.location.reload());
  window.addEventListener("beforeunload", event => {
    if (hasUnsavedChanges || hasInvalidEstimatorInput) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  updateMetrics();
  setSaveStatus(root.dataset.updatedAt ? `Last saved ${root.dataset.updatedAt}.` : "No saved draft yet.");
}

if (typeof document !== "undefined") initWritingWorkspace();
