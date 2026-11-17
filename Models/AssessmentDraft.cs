namespace WebApplication1.Models;

/// <summary>A single saved writing draft and its estimator settings for an assessment.</summary>
public sealed class AssessmentDraft
{
    public int AssessmentId { get; set; }
    public string Content { get; set; } = "";
    public int Revision { get; set; }
    public int WritingSpeedWordsPerHour { get; set; } = 300;
    public int ProofreadingPercent { get; set; } = 15;
    public int AvailableHoursPerDay { get; set; } = 2;
    public DateTimeOffset UpdatedAt { get; set; }
}
