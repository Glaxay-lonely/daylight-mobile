import {
  HABIT_COLORS,
  STORAGE_KEY,
  completedCount,
  completionRate,
  createHabit,
  formatChineseDate,
  getGreeting,
  normalizeState,
  toDateKey,
  weekSeries
} from "./domain.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const elements = {
  views: $$(".view"),
  navButtons: $$("[data-view-target]"),
  todayDate: $("#today-date"),
  greeting: $("#greeting-text"),
  profileName: $("#profile-name"),
  profileFullName: $("#profile-full-name"),
  profileAvatar: $("#profile-avatar"),
  headerInitials: $("#header-initials"),
  progressRing: $("#progress-ring"),
  progressValue: $("#progress-value"),
  todayCount: $("#today-count"),
  momentumTitle: $("#momentum-title-text"),
  momentumCopy: $("#momentum-copy"),
  bestStreak: $("#best-streak"),
  focusTotal: $("#focus-total"),
  weekTotal: $("#week-total"),
  todayHabits: $("#today-habits"),
  allHabits: $("#all-habits"),
  habitCount: $("#habit-count"),
  filterTabs: $$("[data-filter]"),
  weekChart: $("#week-chart"),
  insightWeekTotal: $("#insight-week-total"),
  insightFocusTotal: $("#insight-focus-total"),
  insightStreak: $("#insight-streak"),
  heatmap: $("#heatmap"),
  profileDays: $("#profile-days"),
  profileHabits: $("#profile-habits"),
  profileRate: $("#profile-rate"),
  profileMotto: $("#profile-motto"),
  moodOptions: $("#mood-options"),
  addDialog: $("#add-habit-dialog"),
  addForm: $("#add-habit-form"),
  toggleReminders: $("#toggle-reminders"),
  toggleSound: $("#toggle-sound"),
  installApp: $("#install-app"),
  resetToday: $("#reset-today"),
  timerDisplay: $("#timer-display"),
  timerToggle: $("#timer-toggle"),
  timerReset: $("#timer-reset"),
  timerProgress: $("#timer-progress"),
  timerPlayIcon: $("#timer-play-icon use"),
  toast: $("#toast"),
  confetti: $("#confetti")
};

const TIMER_SECONDS = 25 * 60;
let state = loadState();
let toastTimer = null;
let timerRemaining = TIMER_SECONDS;
let timerEndsAt = null;
let timerInterval = null;
let deferredInstallPrompt = null;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return normalizeState(saved);
  } catch {
    return normalizeState(null);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function iconMarkup(name) {
  return `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2400);
}

function celebrate() {
  elements.confetti.replaceChildren();
  const colors = ["#dceca4", "#ffcfb5", "#bfd9f2", "#1e604a", "#f3bd61"];
  for (let index = 0; index < 18; index += 1) {
    const piece = document.createElement("span");
    const angle = (Math.PI * 2 * index) / 18;
    const distance = 45 + Math.random() * 85;
    piece.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    piece.style.setProperty("--dy", `${Math.sin(angle) * distance - 20}px`);
    piece.style.setProperty("--rot", `${Math.random() * 360}deg`);
    piece.style.setProperty("--piece-color", colors[index % colors.length]);
    elements.confetti.append(piece);
  }
  window.setTimeout(() => elements.confetti.replaceChildren(), 850);
}

function renderHabit(habit, { full = false } = {}) {
  const color = HABIT_COLORS[habit.color] || HABIT_COLORS.mint;
  return `
    <article class="habit-item ${habit.done ? "is-complete" : ""}" data-habit-id="${escapeHtml(habit.id)}">
      <span class="habit-icon" style="background:${color}">${iconMarkup(habit.icon)}</span>
      <div class="habit-main">
        <div class="habit-name-row">
          <h3 class="habit-name">${escapeHtml(habit.name)}</h3>
          <span class="habit-time">${escapeHtml(habit.time)}</span>
        </div>
        <p class="habit-note">${escapeHtml(habit.note)}${habit.streak ? ` · ${habit.streak} 天` : ""}</p>
      </div>
      <button
        class="habit-check"
        type="button"
        data-toggle-habit="${escapeHtml(habit.id)}"
        aria-label="${habit.done ? "取消完成" : "标记完成"} ${escapeHtml(habit.name)}"
        aria-pressed="${habit.done}"
      >
        ${iconMarkup("check")}
      </button>
      ${
        full
          ? `<button class="delete-habit" type="button" data-delete-habit="${escapeHtml(habit.id)}" aria-label="删除 ${escapeHtml(habit.name)}">${iconMarkup("trash")}</button>`
          : ""
      }
    </article>
  `;
}

function emptyHabits(message) {
  return `
    <div class="empty-state">
      <strong>这里还很安静</strong>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function renderHabits() {
  const todayItems = state.habits.map((habit) => renderHabit(habit)).join("");
  elements.todayHabits.innerHTML = todayItems || emptyHabits("添加一个小习惯，从今天开始。");

  const filtered =
    state.filter === "all" ? state.habits : state.habits.filter((habit) => habit.category === state.filter);
  elements.allHabits.innerHTML =
    filtered.map((habit) => renderHabit(habit, { full: true })).join("") ||
    emptyHabits("这个时段还没有习惯，换个筛选或添加一个。");

  elements.habitCount.textContent = state.habits.length;
  elements.filterTabs.forEach((tab) => {
    const active = tab.dataset.filter === state.filter;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
}

function momentumMessage(rate) {
  if (rate === 0) return ["从一件小事开始", "完成一个习惯，今天就会向前一点。"];
  if (rate < 50) return ["节奏正在形成", "不必一口气做完，先完成眼前这一件。"];
  if (rate < 100) return ["今天状态很好", "剩下的也不用着急，按自己的速度来。"];
  return ["今天的约定都做到了", "给自己留一点空白，也是一种完成。"];
}

function renderToday() {
  const rate = completionRate(state.habits);
  const completed = completedCount(state.habits);
  const streak = Math.max(0, ...state.habits.map((habit) => habit.streak || 0));
  const week = weekSeries(state.history);
  const message = momentumMessage(rate);

  elements.progressRing.style.setProperty("--progress", `${rate * 3.6}deg`);
  elements.progressRing.setAttribute("aria-label", `今日完成度 ${rate}%`);
  elements.progressValue.textContent = `${rate}%`;
  elements.todayCount.textContent = `${completed} / ${state.habits.length} 项`;
  elements.momentumTitle.textContent = message[0];
  elements.momentumCopy.textContent = message[1];
  elements.bestStreak.textContent = streak;
  elements.focusTotal.textContent = state.focus.todayMinutes;
  elements.weekTotal.textContent = week.reduce((sum, day) => sum + day.value, 0);
}

function renderInsights() {
  const week = weekSeries(state.history);
  const weekValues = week.reduce((sum, day) => sum + day.value, 0);
  const maxValue = Math.max(5, ...week.map((day) => day.value));

  elements.weekChart.innerHTML = week
    .map(
      (day) => `
        <div class="bar-column ${day.isToday ? "is-today" : ""}" title="${day.key}：完成 ${day.value} 次">
          <span class="bar-value">${day.value}</span>
          <span class="bar" style="height:${Math.max(5, (day.value / maxValue) * 100)}%"></span>
          <span class="bar-label">${day.label}</span>
        </div>
      `
    )
    .join("");

  elements.insightWeekTotal.textContent = weekValues;
  elements.insightFocusTotal.textContent = state.focus.todayMinutes;
  elements.insightStreak.textContent = Math.max(0, ...state.habits.map((habit) => habit.streak || 0));

  const cells = [];
  const now = new Date();
  for (let offset = 27; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    const key = toDateKey(date);
    const value = Number(state.history[key] || 0);
    cells.push(
      `<span class="heat-cell ${offset === 0 ? "is-today" : ""}" data-level="${Math.min(5, value)}" title="${key}：完成 ${value} 次"></span>`
    );
  }
  elements.heatmap.innerHTML = cells.join("");
}

function renderProfile() {
  const average = state.habits.length
    ? Math.round(state.habits.reduce((sum, habit) => sum + Math.min(100, habit.streak * 5), 0) / state.habits.length)
    : 0;
  elements.profileDays.textContent = Object.keys(state.history).length;
  elements.profileHabits.textContent = state.habits.length;
  elements.profileRate.textContent = `${average}%`;
}

function renderStatic() {
  const now = new Date();
  elements.todayDate.textContent = formatChineseDate(now);
  elements.greeting.textContent = getGreeting(now.getHours());
  elements.profileName.textContent = state.profile.name;
  elements.profileFullName.textContent = state.profile.name;
  elements.profileMotto.textContent = state.profile.motto;
  elements.profileAvatar.textContent = state.profile.initials;
  elements.headerInitials.textContent = state.profile.initials;
  elements.toggleReminders.setAttribute("aria-checked", String(state.settings.reminders));
  elements.toggleSound.setAttribute("aria-checked", String(state.settings.sound));
  $$("[data-mood]").forEach((button) => {
    const selected = button.dataset.mood === state.mood;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function renderAll() {
  renderStatic();
  renderHabits();
  renderToday();
  renderInsights();
  renderProfile();
}

function saveAndRender() {
  saveState();
  renderAll();
}

function validView(view) {
  return ["today", "habits", "insights", "profile"].includes(view);
}

function showView(view, { updateState = true } = {}) {
  if (!validView(view)) return;

  elements.views.forEach((section) => {
    const active = section.dataset.view === view;
    section.hidden = !active;
    section.classList.toggle("is-active", active);
  });
  elements.navButtons.forEach((button) => {
    if (!button.closest(".bottom-nav")) return;
    const active = button.dataset.viewTarget === view;
    button.classList.toggle("is-active", active);
    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  if (updateState) {
    state.view = view;
    saveState();
  }
  window.scrollTo({ top: 0, behavior: "auto" });
}

function toggleHabit(id) {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit) return;

  habit.done = !habit.done;
  habit.streak = Math.max(0, habit.streak + (habit.done ? 1 : -1));
  state.history[state.day] = completedCount(state.habits);
  saveAndRender();

  if (habit.done) {
    const allDone = state.habits.every((item) => item.done);
    if (allDone) {
      showToast("今天的约定都完成了");
      celebrate();
    } else {
      showToast(`完成了「${habit.name}」`);
    }
  } else {
    showToast(`已取消「${habit.name}」`);
  }
}

function deleteHabit(id) {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit) return;
  state.habits = state.habits.filter((item) => item.id !== id);
  state.history[state.day] = completedCount(state.habits);
  saveAndRender();
  showToast(`已删除「${habit.name}」`);
}

function openAddDialog() {
  elements.addForm.reset();
  elements.addForm.elements.time.value = "20:30";
  elements.addDialog.showModal();
  requestAnimationFrame(() => elements.addForm.elements.name.focus());
}

function closeAddDialog() {
  elements.addDialog.close();
}

function setFilter(filter) {
  state.filter = filter;
  saveState();
  renderHabits();
}

function setMood(mood) {
  state.mood = state.mood === mood ? null : mood;
  saveState();
  renderStatic();
  if (state.mood) showToast("心情已记录");
}

function updateTimerDisplay() {
  const minutes = Math.floor(timerRemaining / 60);
  const seconds = timerRemaining % 60;
  elements.timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const elapsed = 1 - timerRemaining / TIMER_SECONDS;
  elements.timerProgress.style.width = `${Math.max(0, elapsed * 100)}%`;
}

function finishTimer() {
  window.clearInterval(timerInterval);
  timerInterval = null;
  timerEndsAt = null;
  timerRemaining = TIMER_SECONDS;
  elements.timerPlayIcon.setAttribute("href", "#icon-play");
  elements.timerToggle.setAttribute("aria-label", "开始专注");
  state.focus.todayMinutes += 25;
  state.focus.sessions += 1;
  saveAndRender();
  showToast("完成一次 25 分钟专注");
  celebrate();
  updateTimerDisplay();
}

function tickTimer() {
  if (!timerEndsAt) return;
  timerRemaining = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
  updateTimerDisplay();
  if (timerRemaining === 0) finishTimer();
}

function toggleTimer() {
  if (timerInterval) {
    window.clearInterval(timerInterval);
    timerInterval = null;
    timerEndsAt = null;
    elements.timerPlayIcon.setAttribute("href", "#icon-play");
    elements.timerToggle.setAttribute("aria-label", "继续专注");
    showToast("已暂停");
    return;
  }

  timerEndsAt = Date.now() + timerRemaining * 1000;
  timerInterval = window.setInterval(tickTimer, 250);
  elements.timerPlayIcon.setAttribute("href", "#icon-pause");
  elements.timerToggle.setAttribute("aria-label", "暂停专注");
  showToast("专注计时开始");
}

function resetTimer() {
  window.clearInterval(timerInterval);
  timerInterval = null;
  timerEndsAt = null;
  timerRemaining = TIMER_SECONDS;
  elements.timerPlayIcon.setAttribute("href", "#icon-play");
  elements.timerToggle.setAttribute("aria-label", "开始专注");
  updateTimerDisplay();
  showToast("计时器已重置");
}

function toggleSetting(setting) {
  state.settings[setting] = !state.settings[setting];
  saveState();
  renderStatic();
  showToast(state.settings[setting] ? "设置已开启" : "设置已关闭");
}

function resetToday() {
  if (!window.confirm("清空今天的打卡和专注记录？习惯本身会保留。")) return;
  state.habits = state.habits.map((habit) => ({ ...habit, done: false }));
  state.focus.todayMinutes = 0;
  state.focus.sessions = 0;
  state.mood = null;
  state.history[state.day] = 0;
  saveAndRender();
  showToast("今天已重新开始");
}

function bindEvents() {
  elements.navButtons.forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.viewTarget));
  });

  const handleHabitClick = (event) => {
    const toggle = event.target.closest("[data-toggle-habit]");
    if (toggle) {
      toggleHabit(toggle.dataset.toggleHabit);
      return;
    }
    const remove = event.target.closest("[data-delete-habit]");
    if (remove) deleteHabit(remove.dataset.deleteHabit);
  };

  elements.todayHabits.addEventListener("click", handleHabitClick);
  elements.allHabits.addEventListener("click", handleHabitClick);

  $$("[data-open-add]").forEach((button) => button.addEventListener("click", openAddDialog));
  $("[data-close-dialog]").addEventListener("click", closeAddDialog);

  elements.addDialog.addEventListener("click", (event) => {
    if (event.target === elements.addDialog) closeAddDialog();
  });

  elements.addForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(elements.addForm));
    if (!String(values.name || "").trim()) {
      elements.addForm.elements.name.focus();
      return;
    }
    const habit = createHabit(values, state.habits.map((item) => item.id));
    state.habits.push(habit);
    saveAndRender();
    closeAddDialog();
    showToast(`「${habit.name}」已加入今天`);
  });

  elements.filterTabs.forEach((tab) => {
    tab.addEventListener("click", () => setFilter(tab.dataset.filter));
  });

  elements.moodOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mood]");
    if (button) setMood(button.dataset.mood);
  });

  elements.timerToggle.addEventListener("click", toggleTimer);
  elements.timerReset.addEventListener("click", resetTimer);
  elements.toggleReminders.addEventListener("click", () => toggleSetting("reminders"));
  elements.toggleSound.addEventListener("click", () => toggleSetting("sound"));
  elements.resetToday.addEventListener("click", resetToday);

  elements.installApp.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      showToast("请从浏览器菜单选择「添加到主屏幕」");
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && timerEndsAt) tickTimer();
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator && ["http:", "https:"].includes(window.location.protocol)) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

renderAll();
bindEvents();
updateTimerDisplay();
const requestedView = new URLSearchParams(window.location.search).get("view");
showView(validView(requestedView) ? requestedView : state.view, { updateState: false });
registerServiceWorker();
