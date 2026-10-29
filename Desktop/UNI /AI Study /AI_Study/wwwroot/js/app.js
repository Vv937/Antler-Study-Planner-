import { initDashboard, showToast } from "./dashboard.js";
import { loadDashboardData } from "./storage.js";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function initNavigation() {
  const sidebar = document.querySelector("#sidebar");
  const backdrop = document.querySelector("#sidebarBackdrop");
  const menuButton = document.querySelector("#menuButton");
  const closeMenu = () => {
    sidebar.classList.remove("is-open");
    backdrop.classList.remove("is-visible");
    menuButton.setAttribute("aria-expanded", "false");
  };

  menuButton.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("is-open");
    backdrop.classList.toggle("is-visible", isOpen);
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });
  backdrop.addEventListener("click", closeMenu);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenu();
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      document.querySelector("#globalSearch").focus();
    }
  });

  document.querySelector("#settingsButton").addEventListener("click", () => showToast("Profile and study preferences are planned for a later stage."));
  document.querySelector("#helpButton").addEventListener("click", () => showToast("This is a local demo workspace. Help content will be added in a later stage."));
  document.querySelector("#profileButton").addEventListener("click", () => showToast("Alex Morgan is a fictional demo profile. Authentication is not connected."));
  document.querySelector("#topProfileButton").addEventListener("click", () => showToast("Alex Morgan is a fictional demo profile. Authentication is not connected."));
  document.querySelector("#notificationButton").addEventListener("click", () => showToast("You're all caught up. Notifications are part of a future stage."));
}

function initSearch() {
  const input = document.querySelector("#globalSearch");
  const results = document.querySelector("#searchResults");
  const searchForm = document.querySelector("#searchForm");
  const hideResults = () => { results.hidden = true; };

  searchForm.addEventListener("submit", event => event.preventDefault());
  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    if (!query) {
      hideResults();
      return;
    }

    const data = loadDashboardData();
    let assessments = [];
    try { assessments = JSON.parse(document.querySelector("#assessmentData")?.textContent || "[]"); } catch { assessments = []; }
    const searchableItems = [
      ...data.tasks.map(item => ({ title: item.title, type: "Study task", icon: "bi-check2-square" })),
      ...assessments.map(item => ({ title: item.title, type: "Assessment", icon: "bi-journal-check" })),
      ...[...new Set(assessments.map(item => item.module))].map(title => ({ title, type: "Module", icon: "bi-collection" }))
    ];
    const matches = searchableItems.filter(item => `${item.title} ${item.type}`.toLowerCase().includes(query)).slice(0, 6);
    results.hidden = false;
    results.innerHTML = matches.length
      ? matches.map(item => `<button class="search-result" type="button" role="option" data-search-title="${escapeHtml(item.title)}"><i class="bi ${item.icon}" aria-hidden="true"></i><span>${escapeHtml(item.title)} <small>· ${escapeHtml(item.type)}</small></span></button>`).join("")
      : '<p class="search-empty">No matching tasks, assessments, or modules.</p>';
  });

  results.addEventListener("click", event => {
    const result = event.target.closest("[data-search-title]");
    if (!result) return;
    input.value = result.dataset.searchTitle;
    hideResults();
    searchForm.classList.remove("is-expanded");
    document.querySelector("#mobileSearchButton").setAttribute("aria-expanded", "false");
    showToast(`Found “${result.dataset.searchTitle}” in your local sample data.`);
  });
  document.addEventListener("click", event => {
    if (!searchForm.contains(event.target)) {
      hideResults();
      searchForm.classList.remove("is-expanded");
      document.querySelector("#mobileSearchButton").setAttribute("aria-expanded", "false");
    }
  });
  document.querySelector("#mobileSearchButton").addEventListener("click", () => {
    searchForm.classList.add("is-expanded");
    document.querySelector("#mobileSearchButton").setAttribute("aria-expanded", "true");
    input.focus();
  });
  input.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      hideResults();
      searchForm.classList.remove("is-expanded");
      document.querySelector("#mobileSearchButton").setAttribute("aria-expanded", "false");
      input.blur();
    }
  });
}

if (document.querySelector("#sidebar")) initNavigation();
if (document.querySelector("#searchForm")) initSearch();
if (document.querySelector("#dashboardRoot")) initDashboard();
