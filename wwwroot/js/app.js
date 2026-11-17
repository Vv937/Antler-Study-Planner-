import { initDashboard, showToast } from "./dashboard.js";
import { initCalendar } from "./calendar.js";
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
  let activeIndex = -1;
  let requestNumber = 0;
  let debounceTimer;
  let items = [];
  const hideResults = () => {
    window.clearTimeout(debounceTimer);
    requestNumber++;
    results.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    activeIndex = -1;
  };
  const formatResultDate = value => {
    if (!value) return "";
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    if (!year || !month || !day) return "";
    return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" })
      .format(new Date(year, month - 1, day, 12));
  };
  const setActiveResult = index => {
    const options = [...results.querySelectorAll('[role="option"]')];
    if (!options.length) return;
    activeIndex = (index + options.length) % options.length;
    options.forEach((option, optionIndex) => {
      const selected = optionIndex === activeIndex;
      option.setAttribute("aria-selected", String(selected));
      if (selected) {
        input.setAttribute("aria-activedescendant", option.id);
        option.scrollIntoView({ block: "nearest" });
      }
    });
  };
  const openResult = result => {
    if (!result?.url) return;
    window.location.assign(result.url);
  };
  const renderResults = matches => {
    items = matches;
    activeIndex = -1;
    input.removeAttribute("aria-activedescendant");
    input.setAttribute("aria-expanded", "true");
    results.hidden = false;
    results.innerHTML = matches.length
      ? matches.map((item, index) => {
        const detail = [item.type, formatResultDate(item.date), item.module].filter(Boolean).join(" · ");
        return `<button class="search-result" id="search-option-${index}" type="button" role="option" aria-selected="false" data-search-index="${index}"><i class="bi ${escapeHtml(item.icon)}" aria-hidden="true"></i><span>${escapeHtml(item.title)} <small>· ${escapeHtml(detail)}</small></span></button>`;
      }).join("")
      : '<p class="search-empty" role="status">No results found.</p>';
  };

  searchForm.addEventListener("submit", event => event.preventDefault());
  input.addEventListener("input", () => {
    const query = input.value.trim();
    if (!query) {
      hideResults();
      return;
    }

    window.clearTimeout(debounceTimer);
    const currentRequest = ++requestNumber;
    debounceTimer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/Calendar/Search?q=${encodeURIComponent(query)}`, {
          headers: { Accept: "application/json" }
        });
        if (!response.ok) throw new Error(`Search request failed with status ${response.status}.`);
        const serverResults = await response.json();
        if (currentRequest !== requestNumber) return;

        const normalizedQuery = query.toLocaleLowerCase();
        const tasks = loadDashboardData().tasks
          .filter(task => `${task.title} ${task.module} ${task.category} ${task.date}`.toLocaleLowerCase().includes(normalizedQuery))
          .map(task => ({
            title: task.title,
            type: "Study task",
            date: task.date,
            module: task.module,
            icon: "bi-check2-square",
            url: "/#todayHeading"
          }));
        const matches = [...serverResults, ...tasks].slice(0, 8);
        renderResults(matches);
      } catch (error) {
        if (currentRequest !== requestNumber) return;
        console.error("Global search failed.", error);
        items = [];
        input.removeAttribute("aria-activedescendant");
        results.hidden = false;
        input.setAttribute("aria-expanded", "true");
        results.innerHTML = '<p class="search-empty" role="status">Search is unavailable. Try again.</p>';
      }
    }, 120);
  });

  results.addEventListener("click", event => {
    const result = event.target.closest("[data-search-index]");
    if (!result) return;
    openResult(items[Number(result.dataset.searchIndex)]);
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
    } else if (event.key === "ArrowDown" && !results.hidden) {
      event.preventDefault();
      setActiveResult(activeIndex + 1);
    } else if (event.key === "ArrowUp" && !results.hidden) {
      event.preventDefault();
      setActiveResult(activeIndex < 0 ? items.length - 1 : activeIndex - 1);
    } else if (event.key === "Enter" && !results.hidden && activeIndex >= 0) {
      event.preventDefault();
      openResult(items[activeIndex]);
    }
  });
}

if (document.querySelector("#sidebar")) initNavigation();
if (document.querySelector("#searchForm")) initSearch();
if (document.querySelector("#dashboardRoot")) initDashboard();
if (document.querySelector("#calendarRoot")) initCalendar();
