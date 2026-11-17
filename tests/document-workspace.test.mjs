import assert from "node:assert/strict";
import test from "node:test";
import { countDocumentWords, getDocumentMetrics } from "../wwwroot/js/document-workspace.js";

test("document word count handles whitespace, punctuation, and Unicode text", () => {
  assert.equal(countDocumentWords(""), 0);
  assert.equal(countDocumentWords("  \n\t "), 0);
  assert.equal(countDocumentWords("Café isn't a co-operate test — 1,000.5 中文"), 7);
  assert.equal(countDocumentWords("one   two\nthree\tfour"), 4);
});

test("document metrics count characters, non-whitespace characters, paragraphs, and reading time", () => {
  assert.deepEqual(getDocumentMetrics(""), {
    words: 0, characters: 0, charactersWithoutSpaces: 0, paragraphs: 0, readingMinutes: 0
  });
  assert.deepEqual(getDocumentMetrics("one two\nthree"), {
    words: 3, characters: 13, charactersWithoutSpaces: 11, paragraphs: 2, readingMinutes: 1
  });
  assert.equal(getDocumentMetrics("word ".repeat(201)).readingMinutes, 2);
});
