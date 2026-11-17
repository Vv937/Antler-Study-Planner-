using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.Models;

namespace WebApplication1.Controllers;

public sealed class CalendarController(StudyflowDbContext db, ILogger<CalendarController> logger) : Controller
{
    [HttpGet("/Calendar")]
    public IActionResult Index() => View("~/Views/Home/Calendar.cshtml");

    [HttpGet("/Calendar/Events")]
    public async Task<IActionResult> Events(CancellationToken cancellationToken)
    {
        var assessments = await db.Assessments.AsNoTracking().ToListAsync(cancellationToken);
        var events = await db.CalendarEvents.AsNoTracking().OrderBy(item => item.StartAt)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            assessments = assessments.Select(item => new
            {
                id = item.Id,
                title = item.Title,
                module = item.ModuleName,
                startAt = item.Deadline.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                endAt = item.Deadline.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                isAllDay = true,
                category = "Assessment deadline",
                targetWords = item.TargetWordCount,
                currentWords = item.CurrentWordCount,
                priority = item.Priority,
                status = item.Status
            }),
            events = events.Select(item => new
            {
                id = item.Id,
                title = item.Title,
                description = item.Description,
                startAt = item.StartAt.ToString("yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture),
                endAt = item.EndAt.ToString("yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture),
                isAllDay = item.IsAllDay,
                category = item.Category,
                module = item.ModuleName,
                assessmentId = item.AssessmentId
            })
        });
    }

    [HttpGet("/Calendar/Search")]
    public async Task<IActionResult> Search([FromQuery] string? q, CancellationToken cancellationToken)
    {
        var query = q?.Trim();
        if (string.IsNullOrEmpty(query)) return Ok(Array.Empty<object>());

        var assessments = await db.Assessments.AsNoTracking().ToListAsync(cancellationToken);
        var events = await db.CalendarEvents.AsNoTracking().ToListAsync(cancellationToken);
        var results = new List<object>();

        foreach (var item in assessments)
        {
            var deadlineText = item.Deadline.ToString("MMMM yyyy", CultureInfo.CurrentCulture);
            if (Matches(query, item.Title, item.ModuleName, deadlineText, item.Deadline.ToString("yyyy-MM-dd")))
            {
                results.Add(new
                {
                    id = item.Id,
                    title = item.Title,
                    type = "Assessment",
                    date = item.Deadline.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    module = item.ModuleName,
                    icon = "bi-journal-check",
                    url = $"/Assessments/Workspace/{item.Id}"
                });
            }

            if (Matches(query, item.Title, item.ModuleName, deadlineText, item.Deadline.ToString("yyyy-MM-dd")))
            {
                results.Add(new
                {
                    id = $"assessment-{item.Id}",
                    title = item.Title,
                    type = "Assessment deadline",
                    date = item.Deadline.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    module = item.ModuleName,
                    icon = "bi-calendar-event",
                    url = $"/Calendar?date={item.Deadline:yyyy-MM-dd}&event=assessment-{item.Id}"
                });
            }
        }

        foreach (var item in events)
        {
            var date = item.StartAt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            var dateText = item.StartAt.ToString("MMMM yyyy", CultureInfo.CurrentCulture);
            if (!Matches(query, item.Title, item.Description, item.Category, item.ModuleName, date, dateText))
                continue;

            results.Add(new
            {
                id = $"event-{item.Id}",
                title = item.Title,
                type = item.Category,
                date,
                module = item.ModuleName,
                icon = IconFor(item.Category),
                url = $"/Calendar?date={date}&event=event-{item.Id}"
            });
        }

        var modules = assessments.Select(item => item.ModuleName).Distinct(StringComparer.OrdinalIgnoreCase);
        results.AddRange(modules.Where(module => module.Contains(query, StringComparison.OrdinalIgnoreCase))
            .Select(module => (object)new
            {
                id = $"module-{module}",
                title = module,
                type = "Module",
                date = (string?)null,
                module = (string?)null,
                icon = "bi-collection",
                url = "/"
            }));

        return Ok(results);
    }

    [HttpPost("/Calendar/Events")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SaveEvent([FromBody] CalendarEventRequest? request, CancellationToken cancellationToken)
    {
        if (request is null) return BadRequest(new { message = "Event details are required." });
        if (!TryValidateModel(request))
            return BadRequest(new { message = "Check the event title, category, and field lengths." });
        if (request.StartAt is not DateTime start || request.EndAt is not DateTime end)
            return BadRequest(new { message = "Start and end dates are required." });
        if (request.Category == "Assessment deadline" && request.AssessmentId is not null)
            return BadRequest(new { message = "Assessment deadlines are synced from assessments. Edit the assessment instead of creating a linked copy." });

        start = DateTime.SpecifyKind(start, DateTimeKind.Unspecified);
        end = DateTime.SpecifyKind(end, DateTimeKind.Unspecified);
        if (request.IsAllDay ? end.Date < start.Date : end <= start)
            return BadRequest(new { message = "The event end must be after its start." });

        CalendarEvent calendarEvent;
        if (request.Id is int id)
        {
            var existingEvent = await db.CalendarEvents.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
            if (existingEvent is null) return NotFound(new { message = "This calendar event no longer exists." });
            calendarEvent = existingEvent;
        }
        else
        {
            calendarEvent = new CalendarEvent();
            db.CalendarEvents.Add(calendarEvent);
        }

        if (request.AssessmentId is int assessmentId
            && !await db.Assessments.AnyAsync(item => item.Id == assessmentId, cancellationToken))
            return BadRequest(new { message = "The selected assessment no longer exists." });

        calendarEvent.Title = request.Title.Trim();
        calendarEvent.Description = request.Description?.Trim() ?? "";
        calendarEvent.StartAt = start;
        calendarEvent.EndAt = end;
        calendarEvent.IsAllDay = request.IsAllDay;
        calendarEvent.Category = request.Category;
        calendarEvent.ModuleName = string.IsNullOrWhiteSpace(request.ModuleName) ? null : request.ModuleName.Trim();
        calendarEvent.AssessmentId = request.AssessmentId;

        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Calendar event {CalendarEventId} saved", calendarEvent.Id);
        return Ok(new { id = calendarEvent.Id });
    }

    [HttpDelete("/Calendar/Events/{id:int}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteEvent(int id, CancellationToken cancellationToken)
    {
        var calendarEvent = await db.CalendarEvents.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (calendarEvent is null) return NotFound(new { message = "This calendar event no longer exists." });

        db.CalendarEvents.Remove(calendarEvent);
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Calendar event {CalendarEventId} deleted", id);
        return NoContent();
    }

    private static bool Matches(string query, params string?[] values) =>
        values.Any(value => value?.Contains(query, StringComparison.OrdinalIgnoreCase) == true);

    private static string IconFor(string category) => category switch
    {
        "Study session" => "bi-book",
        "University event" => "bi-mortarboard",
        "Assessment deadline" => "bi-calendar-event",
        _ => "bi-calendar2"
    };
}
