using Microsoft.EntityFrameworkCore;
using Microsoft.Data.Sqlite;
using WebApplication1.Data;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);
var connectionBuilder = new SqliteConnectionStringBuilder(
    builder.Configuration.GetConnectionString("Studyflow") ?? "Data Source=App_Data/studyflow.db");
if (connectionBuilder.DataSource != ":memory:" && !Path.IsPathRooted(connectionBuilder.DataSource))
    connectionBuilder.DataSource = Path.Combine(builder.Environment.ContentRootPath, connectionBuilder.DataSource);
var databaseDirectory = Path.GetDirectoryName(connectionBuilder.DataSource);
if (!string.IsNullOrEmpty(databaseDirectory)) Directory.CreateDirectory(databaseDirectory);

// Add services to the container.
builder.Services.AddControllersWithViews();
builder.Services.AddAntiforgery(options => options.HeaderName = "RequestVerificationToken");
builder.Services.AddDbContext<StudyflowDbContext>(options =>
    options.UseSqlite(connectionBuilder.ToString()));

var app = builder.Build();

// Create the initial SQLite schema on first run. This keeps setup simple for the project.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<StudyflowDbContext>();
    db.Database.EnsureCreated();
    // EnsureCreated does not add tables to an existing database. This additive
    // statement safely introduces drafts without changing or replacing assessments.
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS "AssessmentDrafts" (
            "AssessmentId" INTEGER NOT NULL CONSTRAINT "PK_AssessmentDrafts" PRIMARY KEY,
            "Content" TEXT NOT NULL,
            "Revision" INTEGER NOT NULL,
            "WritingSpeedWordsPerHour" INTEGER NOT NULL,
            "ProofreadingPercent" INTEGER NOT NULL,
            "AvailableHoursPerDay" INTEGER NOT NULL,
            "UpdatedAt" TEXT NOT NULL,
            CONSTRAINT "FK_AssessmentDrafts_Assessments_AssessmentId"
                FOREIGN KEY ("AssessmentId") REFERENCES "Assessments" ("Id") ON DELETE CASCADE
        );
        """);
}

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseRouting();

app.UseAuthorization();

app.MapStaticAssets();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();


app.Run();
