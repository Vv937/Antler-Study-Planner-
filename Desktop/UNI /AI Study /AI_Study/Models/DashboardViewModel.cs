using System.ComponentModel.DataAnnotations;

namespace WebApplication1.Models;

public sealed class DashboardViewModel
{
    public IReadOnlyList<Assessment> Assessments { get; init; } = [];
    public AssessmentFormModel AssessmentForm { get; init; } = new();
    public bool ShowAssessmentForm { get; init; }
    public string? FlashMessage { get; init; }
}

public sealed class AssessmentFormModel : IValidatableObject
{
    public int? Id { get; set; }

    [Required, StringLength(120, MinimumLength = 2)]
    [Display(Name = "Assessment title")]
    public string Title { get; set; } = "";

    [Required, StringLength(100, MinimumLength = 2)]
    [Display(Name = "Module name")]
    public string ModuleName { get; set; } = "";

    [Required, DataType(DataType.Date)]
    public DateOnly? Deadline { get; set; }

    [Range(1, 1_000_000)]
    [Display(Name = "Target word count")]
    public int TargetWordCount { get; set; } = 1000;

    [Range(0, 1_000_000)]
    [Display(Name = "Current word count")]
    public int CurrentWordCount { get; set; }

    [Required, RegularExpression("Low|Medium|High", ErrorMessage = "Choose Low, Medium, or High priority.")]
    public string Priority { get; set; } = "Medium";

    [Required, RegularExpression("In progress|Completed", ErrorMessage = "Choose In progress or Completed status.")]
    public string Status { get; set; } = "In progress";

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (TargetWordCount > 0 && CurrentWordCount > TargetWordCount)
            yield return new ValidationResult("Current word count cannot exceed the target.", [nameof(CurrentWordCount)]);
    }
}
