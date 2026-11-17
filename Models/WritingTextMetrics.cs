using System.Text.RegularExpressions;

namespace WebApplication1.Models;

/// <summary>
/// Counts Unicode letter/number words, including internal apostrophes and hyphens.
/// Punctuation-only tokens are ignored; numeric separators are allowed inside numbers.
/// </summary>
public static class WritingTextMetrics
{
    private static readonly Regex WordPattern = new(
        @"(?:\p{N}+(?:[.,]\p{N}+)*|[\p{L}\p{N}]+(?:['’‐‑–-][\p{L}\p{N}]+)*)",
        RegexOptions.CultureInvariant | RegexOptions.Compiled);

    public static int CountWords(string? text) =>
        string.IsNullOrWhiteSpace(text) ? 0 : WordPattern.Matches(text).Count;
}
