namespace WebApplication1.Models;

public sealed class WritingWorkspaceViewModel
{
    public required Assessment Assessment { get; init; }
    public required string DraftContent { get; init; }
    public required int Revision { get; init; }
    public required int WritingSpeedWordsPerHour { get; init; }
    public required int ProofreadingPercent { get; init; }
    public required int AvailableHoursPerDay { get; init; }
    public DateTimeOffset? UpdatedAt { get; init; }
}

public sealed class DraftSaveRequest
{
    public string Content { get; init; } = "";
    public int Revision { get; init; }
    public int WritingSpeedWordsPerHour { get; init; }
    public int ProofreadingPercent { get; init; }
    public int AvailableHoursPerDay { get; init; }
}
