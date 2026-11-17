import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateProgress,
  calculateWritingEstimate,
  countWords,
  daysUntilDeadline,
  formatHours,
  validateWritingSettings
} from "../wwwroot/js/writing-workspace.js";

test("word counting handles empty text, whitespace, punctuation, and pasted text", () => {
  assert.equal(countWords(""), 0);
  assert.equal(countWords(" \n\t "), 0);
  assert.equal(countWords("Café isn't a co-operate test — 1,000.5 中文"), 7);
  assert.equal(countWords("one   two\nthree\tfour"), 4);
});

test("word-count progress covers empty, partial, complete, and over-target drafts", () => {
  assert.deepEqual(calculateProgress(0, 1200), {
    currentWords: 0, targetWords: 1200, remainingWords: 1200, percent: 0
  });
  assert.deepEqual(calculateProgress(600, 1200), {
    currentWords: 600, targetWords: 1200, remainingWords: 600, percent: 50
  });
  assert.deepEqual(calculateProgress(1200, 1200), {
    currentWords: 1200, targetWords: 1200, remainingWords: 0, percent: 100
  });
  assert.deepEqual(calculateProgress(1300, 1200), {
    currentWords: 1300, targetWords: 1200, remainingWords: 0, percent: 100
  });
  assert.equal(calculateProgress(20, 0).percent, 0);
  assert.deepEqual(calculateProgress(20, null), {
    currentWords: 20, targetWords: 0, remainingWords: 0, percent: 0
  });
  assert.equal(calculateProgress(Number.POSITIVE_INFINITY, 1200).currentWords, 0);
});

test("writing estimate calculates writing and separate proofreading time", () => {
  const estimate = calculateWritingEstimate({
    remainingWords: 1000,
    writingSpeedWordsPerHour: 500,
    proofreadingPercent: 20,
    availableHoursPerDay: 1,
    daysUntilDeadline: 3
  });

  assert.equal(estimate.valid, true);
  assert.equal(estimate.writingHours, 2);
  assert.equal(estimate.proofreadingHours, 0.4);
  assert.equal(estimate.totalHours, 2.4);
  assert.equal(estimate.fitsBeforeDeadline, true);
});

test("writing estimates handle the documented example and short or large assignments", () => {
  const settings = { proofreadingPercent: 0, availableHoursPerDay: 8, daysUntilDeadline: null };
  assert.equal(calculateWritingEstimate({
    ...settings, remainingWords: 1200, writingSpeedWordsPerHour: 300
  }).writingHours, 4);
  assert.equal(calculateWritingEstimate({
    ...settings, remainingWords: 30, writingSpeedWordsPerHour: 300
  }).writingHours, 0.1);
  assert.equal(calculateWritingEstimate({
    ...settings, remainingWords: 200000, writingSpeedWordsPerHour: 1000
  }).writingHours, 200);
});

test("deadline fit warns when the estimate exceeds available focused hours", () => {
  const estimate = calculateWritingEstimate({
    remainingWords: 1000,
    writingSpeedWordsPerHour: 100,
    proofreadingPercent: 15,
    availableHoursPerDay: 1,
    daysUntilDeadline: 2
  });

  assert.equal(estimate.valid, true);
  assert.equal(estimate.availableHours, 2);
  assert.equal(estimate.fitsBeforeDeadline, false);
});

test("writing time formatting rounds across hour boundaries", () => {
  assert.equal(formatHours(4), "4 hr");
  assert.equal(formatHours(1.5), "1 hr 30 min");
  assert.equal(formatHours(0.75), "45 min");
  assert.equal(formatHours(1.999), "2 hr");
  assert.equal(formatHours(0.001), "less than a minute");
});

test("missing and overdue deadlines are distinct from an estimate that fits", () => {
  const base = {
    remainingWords: 0,
    writingSpeedWordsPerHour: 300,
    proofreadingPercent: 15,
    availableHoursPerDay: 2
  };
  const noDeadline = calculateWritingEstimate({ ...base, daysUntilDeadline: null });
  assert.equal(noDeadline.valid, true);
  assert.equal(noDeadline.fitsBeforeDeadline, null);
  assert.equal(noDeadline.overdue, false);

  const overdue = calculateWritingEstimate({ ...base, daysUntilDeadline: -1 });
  assert.equal(overdue.valid, true);
  assert.equal(overdue.fitsBeforeDeadline, false);
  assert.equal(overdue.overdue, true);
});

test("date-only deadline countdown respects local calendar dates and invalid input", () => {
  const today = new Date(2026, 9, 29, 23, 30);
  assert.equal(daysUntilDeadline("2026-10-29", today), 0);
  assert.equal(daysUntilDeadline("2026-10-30", today), 1);
  assert.equal(daysUntilDeadline("2026-10-28", today), -1);
  assert.equal(daysUntilDeadline("2026-02-30", today), null);
  assert.equal(daysUntilDeadline(null, today), null);
  const beforeDaylightSaving = new Date(2026, 2, 7, 23, 30);
  assert.equal(daysUntilDeadline("2026-03-08", beforeDaylightSaving), 1);
});

test("invalid writing settings never produce a calculation", () => {
  const base = {
    remainingWords: 1000,
    writingSpeedWordsPerHour: 300,
    proofreadingPercent: 15,
    availableHoursPerDay: 2,
    daysUntilDeadline: 3
  };

  for (const invalidSpeed of [0, -1, 10001, 2.5, ""]) {
    const result = calculateWritingEstimate({ ...base, writingSpeedWordsPerHour: invalidSpeed });
    assert.equal(result.valid, false);
    assert.match(result.message, /Writing speed/);
  }
  assert.match(validateWritingSettings({
    writingSpeedWordsPerHour: undefined, proofreadingPercent: 15, availableHoursPerDay: 2
  }), /Writing speed/);

  assert.match(validateWritingSettings({
    writingSpeedWordsPerHour: 300, proofreadingPercent: 15.5, availableHoursPerDay: 2
  }), /Proofreading allowance/);
  assert.match(validateWritingSettings({
    writingSpeedWordsPerHour: 300, proofreadingPercent: 15, availableHoursPerDay: 0
  }), /Available hours/);
});

test("invalid remaining-word and deadline inputs return validation errors", () => {
  const base = {
    remainingWords: 100,
    writingSpeedWordsPerHour: 300,
    proofreadingPercent: 15,
    availableHoursPerDay: 2,
    daysUntilDeadline: 3
  };

  assert.equal(calculateWritingEstimate({ ...base, remainingWords: -1 }).valid, false);
  assert.equal(calculateWritingEstimate({ ...base, daysUntilDeadline: Number.NaN }).valid, false);
});
