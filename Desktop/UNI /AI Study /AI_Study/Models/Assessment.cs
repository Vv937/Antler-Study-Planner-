using System.ComponentModel.DataAnnotations;

namespace WebApplication1.Models;

public sealed class Assessment
{
    public int Id { get; set; }

    [Required, StringLength(120, MinimumLength = 2)]
    public string Title { get; set; } = "";

    [Required, StringLength(100, MinimumLength = 2)]
    public string ModuleName { get; set; } = "";

    [Required]
    public DateOnly Deadline { get; set; }

    [Range(1, 1_000_000)]
    public int TargetWordCount { get; set; }

    [Range(0, 1_000_000)]
    public int CurrentWordCount { get; set; }

    [Required, RegularExpression("Low|Medium|High", ErrorMessage = "Choose Low, Medium, or High priority.")]
    public string Priority { get; set; } = "Medium";

    [Required, RegularExpression("In progress|Completed", ErrorMessage = "Choose In progress or Completed.")]
    public string Status { get; set; } = "In progress";
}
