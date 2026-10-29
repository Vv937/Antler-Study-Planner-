using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.Models;

namespace WebApplication1.Controllers;

public sealed class AssessmentsController(StudyflowDbContext db, ILogger<AssessmentsController> logger) : Controller
{
    [HttpGet]
    public async Task<IActionResult> Create()
    {
        return View("~/Views/Home/Index.cshtml", new DashboardViewModel
        {
            Assessments = await db.Assessments.AsNoTracking().OrderBy(item => item.Deadline).ToListAsync(),
            ShowAssessmentForm = true
        });
    }

    [HttpGet("/Assessments/Workspace/{id:int}")]
    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public async Task<IActionResult> Workspace(int id)
    {
        var assessment = await db.Assessments.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id);
        if (assessment is null)
            return NotFound("Assessment not found. It may have been deleted. Return to the dashboard and choose another assessment.");

        var draft = await db.AssessmentDrafts.AsNoTracking().SingleOrDefaultAsync(item => item.AssessmentId == id);
        return View("~/Views/Assessments/Workspace.cshtml", new WritingWorkspaceViewModel
        {
            Assessment = assessment,
            DraftContent = draft?.Content ?? "",
            Revision = draft?.Revision ?? 0,
            WritingSpeedWordsPerHour = draft?.WritingSpeedWordsPerHour ?? 300,
            ProofreadingPercent = draft?.ProofreadingPercent ?? 15,
            AvailableHoursPerDay = draft?.AvailableHoursPerDay ?? 2,
            UpdatedAt = draft?.UpdatedAt
        });
    }

    [HttpPost("/Assessments/SaveDraft/{id:int}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SaveDraft(int id, [FromBody] DraftSaveRequest? request, CancellationToken cancellationToken)
    {
        if (request is null || request.Content is null)
            return BadRequest(new { message = "Draft content is required." });
        if (request.Content.Length > 2_000_000)
            return BadRequest(new { message = "Drafts must be smaller than 2 MB." });
        if (request.Revision < 0 || request.WritingSpeedWordsPerHour is < 1 or > 10_000
            || request.ProofreadingPercent is < 0 or > 100 || request.AvailableHoursPerDay is < 1 or > 24)
            return BadRequest(new { message = "Check the writing speed, proofreading allowance, and available hours." });

        var assessment = await db.Assessments.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (assessment is null) return NotFound(new { message = "This assessment no longer exists." });

        var draft = await db.AssessmentDrafts.SingleOrDefaultAsync(item => item.AssessmentId == id, cancellationToken);
        if (draft is null)
        {
            if (request.Revision != 0)
                return Conflict(new { message = "This draft has changed. Reload the workspace before saving again." });

            draft = new AssessmentDraft { AssessmentId = id, Revision = 1 };
            db.AssessmentDrafts.Add(draft);
        }
        else if (draft.Revision != request.Revision)
        {
            return Conflict(new { message = "This draft was changed in another session. Reload the workspace before saving again to avoid overwriting it." });
        }
        else
        {
            draft.Revision++;
        }

        draft.Content = request.Content;
        draft.WritingSpeedWordsPerHour = request.WritingSpeedWordsPerHour;
        draft.ProofreadingPercent = request.ProofreadingPercent;
        draft.AvailableHoursPerDay = request.AvailableHoursPerDay;
        draft.UpdatedAt = DateTimeOffset.UtcNow;
        assessment.CurrentWordCount = WritingTextMetrics.CountWords(request.Content);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new { message = "This draft was changed in another session. Reload the workspace before saving again to avoid overwriting it." });
        }
        catch (DbUpdateException exception)
        {
            logger.LogError(exception, "Could not save writing draft for assessment {AssessmentId}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { message = "The draft could not be saved to the database. Your text remains in the editor; please retry." });
        }

        logger.LogInformation("Saved writing draft for assessment {AssessmentId} at revision {Revision}", id, draft.Revision);
        return Ok(new
        {
            revision = draft.Revision,
            wordCount = assessment.CurrentWordCount,
            updatedAt = draft.UpdatedAt.ToLocalTime().ToString("g")
        });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Save([Bind(Prefix = "AssessmentForm")] AssessmentFormModel form)
    {
        Assessment? assessment = null;
        if (form.Id is int id)
        {
            assessment = await db.Assessments.FindAsync(id);
            if (assessment is null) return NotFound();
        }

        if (!ModelState.IsValid)
        {
            var assessments = await db.Assessments.AsNoTracking().OrderBy(item => item.Deadline).ToListAsync();
            return View("~/Views/Home/Index.cshtml", new DashboardViewModel
            {
                Assessments = assessments,
                AssessmentForm = form,
                ShowAssessmentForm = true
            });
        }

        assessment ??= new Assessment();
        assessment.Title = form.Title.Trim();
        assessment.ModuleName = form.ModuleName.Trim();
        assessment.Deadline = form.Deadline!.Value;
        assessment.TargetWordCount = form.TargetWordCount;
        assessment.CurrentWordCount = form.CurrentWordCount;
        assessment.Priority = form.Priority;
        assessment.Status = form.Status;

        var savedDraft = form.Id is int assessmentId
            ? await db.AssessmentDrafts.SingleOrDefaultAsync(item => item.AssessmentId == assessmentId)
            : null;
        if (savedDraft is not null)
        {
            assessment.CurrentWordCount = WritingTextMetrics.CountWords(savedDraft.Content);
            if (assessment.CurrentWordCount > assessment.TargetWordCount)
            {
                ModelState.AddModelError("AssessmentForm.TargetWordCount", "The target cannot be lower than the word count in the saved draft.");
                var assessments = await db.Assessments.AsNoTracking().OrderBy(item => item.Deadline).ToListAsync();
                return View("~/Views/Home/Index.cshtml", new DashboardViewModel
                {
                    Assessments = assessments,
                    AssessmentForm = form,
                    ShowAssessmentForm = true
                });
            }
        }

        if (assessment.Id == 0) db.Assessments.Add(assessment);
        await db.SaveChangesAsync();
        TempData["AssessmentMessage"] = form.Id.HasValue ? "Assessment updated." : "Assessment created.";
        logger.LogInformation("Assessment {AssessmentId} saved", assessment.Id);
        return RedirectToAction("Index", "Home");
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var assessment = await db.Assessments.FindAsync(id);
        if (assessment is null) return NotFound();

        db.Assessments.Remove(assessment);
        await db.SaveChangesAsync();
        TempData["AssessmentMessage"] = "Assessment deleted.";
        logger.LogInformation("Assessment {AssessmentId} deleted", id);
        return RedirectToAction("Index", "Home");
    }

}
