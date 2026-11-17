using Microsoft.AspNetCore.Mvc;

namespace WebApplication1.Controllers;

public sealed class DocumentsController : Controller
{
    [HttpGet("/Documents")]
    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Index() => View("~/Views/Documents/Index.cshtml");
}
