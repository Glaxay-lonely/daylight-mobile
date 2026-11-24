import assert from "node:assert/strict";
import test from "node:test";
import {
  completionRate,
  createDefaultState,
  createHabit,
  formatChineseDate,
  getGreeting,
  normalizeState,
  toDateKey,
  weekSeries
} from "../js/domain.js";

test("date formatting is stable and localized", () => {
  const date = new Date(2026, 10, 24, 9);
  assert.equal(toDateKey(date), "2026-11-24");
  assert.equal(formatChineseDate(date), "11月24日 · 星期二");
  assert.equal(getGreeting(8), "早上好");
  assert.equal(getGreeting(20), "晚上好");
});

test("completion rate handles empty and partial lists", () => {
  assert.equal(completionRate([]), 0);
  assert.equal(completionRate([{ done: true }, { done: false }, { done: true }]), 67);
});

test("new habit gets safe defaults and a unique id", () => {
  const habit = createHabit(
    { name: "早睡", icon: "moon", color: "not-real", category: "evening" },
    ["habit-早睡"]
  );
  assert.equal(habit.id, "habit-早睡-2");
  assert.equal(habit.icon, "sun");
  assert.equal(habit.color, "mint");
  assert.equal(habit.done, false);
  assert.equal(habit.streak, 0);
});

test("state resets daily actions but keeps habits", () => {
  const today = new Date(2026, 10, 24, 9);
  const state = createDefaultState(today);
  state.day = "2026-11-23";
  state.focus.todayMinutes = 50;
  state.habits.forEach((habit) => {
    habit.done = true;
  });

  const normalized = normalizeState(state, today);
  assert.equal(normalized.day, "2026-11-24");
  assert.equal(normalized.focus.todayMinutes, 0);
  assert.ok(normalized.habits.every((habit) => habit.done === false));
});

test("week series starts Monday and marks current day", () => {
  const date = new Date(2026, 10, 24, 9);
  const series = weekSeries({ "2026-11-24": 3 }, date);
  assert.equal(series[0].key, "2026-11-23");
  assert.equal(series[1].key, "2026-11-24");
  assert.equal(series[1].value, 3);
  assert.equal(series[1].isToday, true);
});
