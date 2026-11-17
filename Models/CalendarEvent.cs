using System.ComponentModel.DataAnnotations;

namespace WebApplication1.Models;

public sealed class CalendarEvent
{
    public int Id { get; set; }

    [Required, StringLength(120, MinimumLength = 1)]
    public string Title { get; set; } = "";

    [StringLength(2000)]
    public string Description { get; set; } = "";

    public DateTime StartAt { get; set; }

    public DateTime EndAt { get; set; }

    public bool IsAllDay { get; set; }

    [Required, RegularExpression("Assessment deadline|Study session|Personal event|University event")]
    public string Category { get; set; } = "Personal event";

    [StringLength(100)]
    public string? ModuleName { get; set; }

    public int? AssessmentId { get; set; }
}

public sealed class CalendarEventRequest
{
    public int? Id { get; set; }

    [Required, StringLength(120, MinimumLength = 1)]
    public string Title { get; set; } = "";

    [StringLength(2000)]
    public string Description { get; set; } = "";

    [Required]
    public DateTime? StartAt { get; set; }

    [Required]
    public DateTime? EndAt { get; set; }

    public bool IsAllDay { get; set; }

    [Required, RegularExpression("Assessment deadline|Study session|Personal event|University event")]
    public string Category { get; set; } = "Personal event";

    [StringLength(100)]
    public string? ModuleName { get; set; }

    public int? AssessmentId { get; set; }
}
