using Microsoft.EntityFrameworkCore;
using WebApplication1.Models;

namespace WebApplication1.Data;

public sealed class StudyflowDbContext(DbContextOptions<StudyflowDbContext> options) : DbContext(options)
{
    public DbSet<Assessment> Assessments => Set<Assessment>();
    public DbSet<AssessmentDraft> AssessmentDrafts => Set<AssessmentDraft>();
    public DbSet<CalendarEvent> CalendarEvents => Set<CalendarEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var draft = modelBuilder.Entity<AssessmentDraft>();
        draft.HasKey(item => item.AssessmentId);
        draft.Property(item => item.AssessmentId).ValueGeneratedNever();
        draft.Property(item => item.Content).HasMaxLength(2_000_000);
        draft.Property(item => item.Revision).IsConcurrencyToken();
        draft.HasOne<Assessment>().WithOne()
            .HasForeignKey<AssessmentDraft>(item => item.AssessmentId)
            .OnDelete(DeleteBehavior.Cascade);

        var calendarEvent = modelBuilder.Entity<CalendarEvent>();
        calendarEvent.Property(item => item.Title).HasMaxLength(120);
        calendarEvent.Property(item => item.Description).HasMaxLength(2000);
        calendarEvent.Property(item => item.Category).HasMaxLength(40);
        calendarEvent.Property(item => item.ModuleName).HasMaxLength(100);
        calendarEvent.HasOne<Assessment>().WithMany()
            .HasForeignKey(item => item.AssessmentId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
