const STORAGE_KEY = "abyar_data_v1";
const SETTINGS_KEY = "abyar_settings_v1";
const SCHEDULE_COUNT = 12;

let notificationTimer = null;

function enterApp() {
  const splash = document.getElementById("splash-screen");
  splash.style.opacity = "0";
  setTimeout(() => {
    splash.style.display = "none";
  }, 350);

  requestNotificationPermission();
}

function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function switchPage(pageId, navItem) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });

  document.getElementById(`page-${pageId}`).classList.add("active");
  navItem.classList.add("active");

  if (pageId === "calendar") {
    renderSchedule();
  }
}

function getDefaultSettings() {
  return {
    reminders: {
      oneDay: true,
      oneHour: true,
      atTime: true
    }
  };
}

function getSavedData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

function getSavedSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  return raw ? JSON.parse(raw) : getDefaultSettings();
}

function saveOwnerInfo() {
  const ownerName = document.getElementById("owner-name").value.trim();
  const landName = document.getElementById("land-name").value.trim();
  const startDate = document.getElementById("start-date").value;
  const startTime = document.getElementById("start-time").value;
  const durationHours = Number(document.getElementById("duration-hours").value || 0);
  const durationMinutes = Number(document.getElementById("duration-minutes").value || 0);
  const cycleDays = Number(document.getElementById("cycle-days").value || 12);
  const notes = document.getElementById("owner-notes").value.trim();

  if (!ownerName || !landName || !startDate || !startTime) {
    alert("لطفاً نام مالک، نام زمین، تاریخ شروع و ساعت شروع را کامل وارد کنید.");
    return;
  }

  if (cycleDays <= 0) {
    alert("دوره آبیاری باید بیشتر از صفر باشد.");
    return;
  }

  if (durationHours < 0 || durationMinutes < 0 || durationMinutes > 59) {
    alert("مدت آبیاری معتبر نیست.");
    return;
  }

  const data = {
    ownerName,
    landName,
    startDate,
    startTime,
    durationHours,
    durationMinutes,
    cycleDays,
    notes,
    updatedAt: new Date().toISOString()
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  alert("اطلاعات نوبت آب ذخیره شد.");

  renderSchedule();
  scheduleBrowserReminderPreview();
}

function saveSettings() {
  const settings = {
    reminders: {
      oneDay: document.getElementById("reminder-one-day").checked,
      oneHour: document.getElementById("reminder-one-hour").checked,
      atTime: document.getElementById("reminder-at-time").checked
    }
  };

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  alert("تنظیمات یادآوری ذخیره شد.");

  scheduleBrowserReminderPreview();
}

function clearAllData() {
  const confirmed = confirm("همه اطلاعات آب‌یار حذف شود؟");
  if (!confirmed) return;

  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SETTINGS_KEY);

  if (notificationTimer) {
    clearTimeout(notificationTimer);
    notificationTimer = null;
  }

  resetForm();
  applySettingsToForm(getDefaultSettings());
  renderEmptyState();

  alert("همه اطلاعات حذف شد.");
}

function resetForm() {
  document.getElementById("owner-name").value = "";
  document.getElementById("land-name").value = "";
  document.getElementById("start-date").value = "";
  document.getElementById("start-time").value = "";
  document.getElementById("duration-hours").value = "2";
  document.getElementById("duration-minutes").value = "0";
  document.getElementById("cycle-days").value = "12";
  document.getElementById("owner-notes").value = "";
}

function exportData() {
  const data = getSavedData();
  if (!data) {
    alert("داده‌ای برای پشتیبان‌گیری وجود ندارد.");
    return;
  }

  const settings = getSavedSettings();
  const payload = {
    app: "Abyar",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
    settings
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "abyar-backup.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);

      if (!parsed.data || !parsed.data.ownerName || !parsed.data.startDate) {
        alert("فایل پشتیبان معتبر نیست.");
        return;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.data));

      const settings = parsed.settings || getDefaultSettings();
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

      fillForm(parsed.data);
      applySettingsToForm(settings);
      renderSchedule();
      scheduleBrowserReminderPreview();

      alert("پشتیبان با موفقیت بازگردانی شد.");
    } catch (error) {
      alert("خواندن فایل پشتیبان با خطا روبه‌رو شد.");
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsText(file, "utf-8");
}

function fillForm(data) {
  document.getElementById("owner-name").value = data.ownerName || "";
  document.getElementById("land-name").value = data.landName || "";
  document.getElementById("start-date").value = data.startDate || "";
  document.getElementById("start-time").value = data.startTime || "";
  document.getElementById("duration-hours").value = String(data.durationHours ?? 2);
  document.getElementById("duration-minutes").value = String(data.durationMinutes ?? 0);
  document.getElementById("cycle-days").value = String(data.cycleDays ?? 12);
  document.getElementById("owner-notes").value = data.notes || "";
}

function applySettingsToForm(settings) {
  const merged = {
    ...getDefaultSettings(),
    ...settings,
    reminders: {
      ...getDefaultSettings().reminders,
      ...(settings.reminders || {})
    }
  };

  document.getElementById("reminder-one-day").checked = merged.reminders.oneDay;
  document.getElementById("reminder-one-hour").checked = merged.reminders.oneHour;
  document.getElementById("reminder-at-time").checked = merged.reminders.atTime;
}

function renderSchedule() {
  const data = getSavedData();
  if (!data) {
    renderEmptyState();
    return;
  }

  const nextTurn = getNextTurn(data);
  const schedule = buildSchedule(data, SCHEDULE_COUNT);

  renderNextTurn(data, nextTurn);
  renderScheduleList(schedule, data);
}

function renderEmptyState() {
  document.getElementById("countdown-text").textContent = "هنوز نوبتی ثبت نشده است";
  document.getElementById("next-turn-details").textContent = "ابتدا اطلاعات مالک و زمین را ثبت کنید.";
  document.getElementById("schedule-container").innerHTML = `
    <p style="text-align:center; color: var(--muted); margin:0;">
      پس از ثبت اطلاعات، نوبت‌های آینده اینجا نمایش داده می‌شوند.
    </p>
  `;
}

function buildSchedule(data, count) {
  const result = [];
  const nextTurn = getNextTurn(data);
  const cycleMs = Number(data.cycleDays) * 24 * 60 * 60 * 1000;
  const durationMs = ((Number(data.durationHours) * 60) + Number(data.durationMinutes)) * 60 * 1000;

  for (let i = 0; i < count; i += 1) {
    const start = new Date(nextTurn.start.getTime() + (i * cycleMs));
    const end = new Date(start.getTime() + durationMs);

    result.push({
      index: i + 1,
      start,
      end
    });
  }

  return result;
}

function getNextTurn(data) {
  const firstStart = new Date(`${data.startDate}T${data.startTime}`);
  const cycleMs = Number(data.cycleDays) * 24 * 60 * 60 * 1000;
  const durationMs = ((Number(data.durationHours) * 60) + Number(data.durationMinutes)) * 60 * 1000;
  const now = new Date();

  let start = new Date(firstStart);

  while (start.getTime() + durationMs < now.getTime()) {
    start = new Date(start.getTime() + cycleMs);
  }

  const end = new Date(start.getTime() + durationMs);

  return { start, end };
}

function renderNextTurn(data, nextTurn) {
  const now = new Date();
  const diffMs = nextTurn.start.getTime() - now.getTime();
  const isRunning = now >= nextTurn.start && now <= nextTurn.end;

  let countdownText = "";
  if (isRunning) {
    countdownText = "نوبت آب اکنون در جریان است";
  } else if (diffMs <= 0) {
    countdownText = "نوبت بعدی خیلی نزدیک است";
  } else {
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    countdownText = `${days} روز، ${hours} ساعت و ${minutes} دقیقه تا نوبت بعدی`;
  }

  document.getElementById("countdown-text").textContent = countdownText;

  const startDateText = formatPersianDate(nextTurn.start);
  const weekday = nextTurn.start.toLocaleDateString("fa-IR-u-ca-persian", { weekday: "long" });
  const startTimeText = formatPersianTime(nextTurn.start);
  const endTimeText = formatPersianTime(nextTurn.end);

  document.getElementById("next-turn-details").innerHTML = `
    <div>${data.ownerName} | ${data.landName}</div>
    <div>${weekday} ${startDateText}</div>
    <div>شروع: ${startTimeText} | پایان: ${endTimeText}</div>
  `;
}

function renderScheduleList(schedule, data) {
  const container = document.getElementById("schedule-container");
  container.innerHTML = "";

  schedule.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = `schedule-item ${idx === 0 ? "active-turn" : ""}`;

    const weekday = item.start.toLocaleDateString("fa-IR-u-ca-persian", { weekday: "long" });
    const dateText = formatPersianDate(item.start);
    const startTime = formatPersianTime(item.start);
    const endTime = formatPersianTime(item.end);
    const durationText = `${toPersianNumber(data.durationHours)} ساعت و ${toPersianNumber(data.durationMinutes)} دقیقه`;

    row.innerHTML = `
      <div>
        <div><b>نوبت ${toPersianNumber(item.index)} - ${weekday} ${dateText}</b></div>
        <div class="note-box">شروع: ${startTime} | پایان: ${endTime}</div>
        <div class="note-box">مدت آبیاری: ${durationText}</div>
      </div>
      ${idx === 0 ? '<span class="badge-next">نوبت بعدی</span>' : ""}
    `;

    container.appendChild(row);
  });
}

function formatPersianDate(date) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

function formatPersianTime(date) {
  return new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function toPersianNumber(value) {
  return String(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[digit]);
}

function scheduleBrowserReminderPreview() {
  if (notificationTimer) {
    clearTimeout(notificationTimer);
    notificationTimer = null;
  }

  const data = getSavedData();
  const settings = getSavedSettings();

  if (!data || !("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const nextTurn = getNextTurn(data);
  const now = Date.now();

  const reminderTimes = [];

  if (settings.reminders.oneDay) {
    reminderTimes.push({
      when: nextTurn.start.getTime() - (24 * 60 * 60 * 1000),
      title: "یادآوری نوبت آب",
      body: `یک روز تا نوبت آب ${data.landName} باقی مانده است.`
    });
  }

  if (settings.reminders.oneHour) {
    reminderTimes.push({
      when: nextTurn.start.getTime() - (60 * 60 * 1000),
      title: "یادآوری نوبت آب",
      body: `یک ساعت تا شروع نوبت آب ${data.landName} باقی مانده است.`
    });
  }

  if (settings.reminders.atTime) {
    reminderTimes.push({
      when: nextTurn.start.getTime(),
      title: "شروع نوبت آب",
      body: `نوبت آب ${data.landName} برای ${data.ownerName} شروع شد.`
    });
  }

  const futureReminders = reminderTimes
    .filter((item) => item.when > now)
    .sort((a, b) => a.when - b.when);

  if (!futureReminders.length) return;

  const nearest = futureReminders[0];
  const delay = nearest.when - now;

  notificationTimer = setTimeout(() => {
    new Notification(nearest.title, {
      body: nearest.body
    });
  }, delay);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

window.addEventListener("load", () => {
  const data = getSavedData();
  const settings = getSavedSettings();

  if (data) {
    fillForm(data);
    renderSchedule();
  } else {
    renderEmptyState();
  }

  applySettingsToForm(settings);
  registerServiceWorker();
  scheduleBrowserReminderPreview();
});
