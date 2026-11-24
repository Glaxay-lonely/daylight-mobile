export const STORAGE_KEY = "daylight-state-v1";

export const HABIT_COLORS = {
  mint: "#b7e4cf",
  apricot: "#ffd0b4",
  blue: "#bfd9f2",
  lime: "#ddec9f"
};

export const ICON_OPTIONS = ["sun", "book", "droplet", "footprints", "coffee", "brain"];

const pad = (value) => String(value).padStart(2, "0");

export function toDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatChineseDate(date = new Date()) {
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${weekdays[date.getDay()]}`;
}

export function getGreeting(hour = new Date().getHours()) {
  if (hour < 6) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

export function completionRate(habits) {
  if (!habits.length) return 0;
  return Math.round((habits.filter((habit) => habit.done).length / habits.length) * 100);
}

export function completedCount(habits) {
  return habits.filter((habit) => habit.done).length;
}

export function createDefaultState(now = new Date()) {
  return {
    version: 1,
    day: toDateKey(now),
    view: "today",
    filter: "all",
    profile: {
      name: "林澄",
      initials: "LC",
      motto: "把注意力留给真正重要的事"
    },
    settings: {
      reminders: true,
      sound: false
    },
    mood: null,
    focus: {
      todayMinutes: 50,
      sessions: 2,
      weekly: [42, 68, 35, 80, 54, 0, 0]
    },
    habits: [
      {
        id: "habit-morning-stretch",
        name: "晨间拉伸",
        note: "8 分钟，唤醒身体",
        time: "07:30",
        icon: "sun",
        color: "mint",
        category: "morning",
        done: true,
        streak: 12
      },
      {
        id: "habit-read",
        name: "阅读 20 页",
        note: "正在读《创造力》",
        time: "12:30",
        icon: "book",
        color: "apricot",
        category: "afternoon",
        done: true,
        streak: 7
      },
      {
        id: "habit-water",
        name: "喝够 6 杯水",
        note: "已完成 4 杯",
        time: "全天",
        icon: "droplet",
        color: "blue",
        category: "all-day",
        done: false,
        streak: 4
      },
      {
        id: "habit-walk",
        name: "散步 30 分钟",
        note: "晚饭后沿河走走",
        time: "19:00",
        icon: "footprints",
        color: "lime",
        category: "evening",
        done: false,
        streak: 8
      },
      {
        id: "habit-journal",
        name: "写三行日记",
        note: "记录今天的一个小发现",
        time: "22:00",
        icon: "brain",
        color: "mint",
        category: "evening",
        done: true,
        streak: 19
      }
    ],
    history: {
      "2026-11-17": 4,
      "2026-11-18": 5,
      "2026-11-19": 3,
      "2026-11-20": 5,
      "2026-11-21": 4,
      "2026-11-22": 3,
      "2026-11-23": 5
    }
  };
}

export function normalizeState(saved, now = new Date()) {
  const defaults = createDefaultState(now);
  if (!saved || typeof saved !== "object") return defaults;

  const merged = {
    ...defaults,
    ...saved,
    profile: { ...defaults.profile, ...(saved.profile || {}) },
    settings: { ...defaults.settings, ...(saved.settings || {}) },
    focus: { ...defaults.focus, ...(saved.focus || {}) },
    habits: Array.isArray(saved.habits) ? saved.habits : defaults.habits,
    history: { ...defaults.history, ...(saved.history || {}) }
  };

  if (merged.day !== toDateKey(now)) {
    merged.day = toDateKey(now);
    merged.mood = null;
    merged.focus = {
      ...merged.focus,
      todayMinutes: 0,
      sessions: 0
    };
    merged.habits = merged.habits.map((habit) => ({ ...habit, done: false }));
  }

  return merged;
}

export function createHabit(values, existingIds = []) {
  const base = String(values.name || "新习惯")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);
  let id = `habit-${base || "custom"}`;
  let suffix = 2;
  while (existingIds.includes(id)) {
    id = `habit-${base || "custom"}-${suffix}`;
    suffix += 1;
  }

  return {
    id,
    name: String(values.name || "").trim(),
    note: String(values.note || "").trim() || "从今天开始，慢慢坚持",
    time: String(values.time || "全天"),
    icon: ICON_OPTIONS.includes(values.icon) ? values.icon : "sun",
    color: Object.hasOwn(HABIT_COLORS, values.color) ? values.color : "mint",
    category: ["morning", "afternoon", "evening", "all-day"].includes(values.category)
      ? values.category
      : "all-day",
    done: false,
    streak: 0
  };
}

export function weekSeries(history, now = new Date()) {
  const labels = ["一", "二", "三", "四", "五", "六", "日"];
  return labels.map((label, index) => {
    const date = new Date(now);
    const currentDay = date.getDay() || 7;
    date.setDate(date.getDate() - (currentDay - 1) + index);
    const key = toDateKey(date);
    return {
      label,
      key,
      value: Number(history[key] || 0),
      isToday: index === currentDay - 1
    };
  });
}
