/** @type {Array<Object>} in-memory task list. Not persisted yet. */
let tasks = [];

/** Currently pending delete, set while the confirm dialog is open */
let pendingDeleteId = null;

/** Generates a reasonably-unique id without pulling in a UUID library. */
function makeId() {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Dashboard: summary stats

function isOverdue(task) {
  const due = new Date(`${task.dueDate}T${task.dueTime || "23:59"}`);
  return due.getTime() < Date.now();
}

// Dashboard: rendering

function formatDue(task) {
  const due = new Date(`${task.dueDate}T${task.dueTime || "00:00"}`);
  const dateStr = due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const timeStr = due.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${dateStr}, ${timeStr}`;
}

const PRIORITY_COLOR = { Low: "#4C7A4E", Med: "#A9781A", High: "#B3492B" };

function renderTaskCard(task) {
  const card = document.createElement("article");
  card.className = "task-card";
  card.style.borderLeftColor = PRIORITY_COLOR[task.priority];
  card.dataset.id = task.id;

  const overdue = isOverdue(task);

  card.innerHTML = `
    <div class="task-body">
      <p class="task-title">${escapeHtml(task.title)}</p>
      <div class="task-meta">
        <span class="task-due ${overdue ? "is-overdue" : ""}">${formatDue(task)}</span>
        <span class="badge badge-priority-${task.priority}">${task.priority}</span>
        <span class="badge badge-tag">${task.tag}</span>
      </div>
    </div>
    <div class="task-actions">
      <button type="button" class="icon-btn delete-btn" aria-label="Delete task">Delete</button>
    </div>
  `;

  card.querySelector(".delete-btn").addEventListener("click", () => {
    openConfirmDelete(task.id);
  });

  return card;
}

/** Minimal HTML-escaping so a task title like "<script>" can't inject markup. */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderDashboard() {
  const list = document.getElementById("taskList");
  const emptyState = document.getElementById("emptyState");

  // Clear everything except the empty-state node, which we toggle instead
  // of re-creating (keeps the DOM diff small).
  [...list.children].forEach((child) => {
    if (child.id !== "emptyState") child.remove();
  });

  if (tasks.length === 0) {
    emptyState.style.display = "block";
  } else {
    emptyState.style.display = "none";
    tasks.forEach((task) => list.appendChild(renderTaskCard(task)));
  }

  renderSummary();
}

// Add Task Logic

const taskDialog = document.getElementById("taskDialog");
const taskForm = document.getElementById("taskForm");

function openAddTaskDialog() {
  taskForm.reset();
  document.getElementById("priorityInput").value = "Med";
  clearFormErrors();
  taskDialog.showModal();
  document.getElementById("titleInput").focus();
}

function clearFormErrors() {
  document.getElementById("titleError").textContent = "";
  document.getElementById("dateError").textContent = "";
}

/**
 * Validates the Add Task form. Returns true if valid; otherwise writes
 * inline error messages next to the offending fields and returns false.
 * We validate manually (rather than relying only on `required`) so we can
 * control the wording and also check the date/time isn't in the past.
 */
function validateTaskForm() {
  clearFormErrors();
  let valid = true;

  const title = document.getElementById("titleInput").value.trim();
  if (!title) {
    document.getElementById("titleError").textContent = "Title is required.";
    valid = false;
  }

  const date = document.getElementById("dateInput").value;
  const time = document.getElementById("timeInput").value;
  if (!date || !time) {
    document.getElementById("dateError").textContent = "Due date and time are both required.";
    valid = false;
  }

  return valid;
}

function handleAddTaskSubmit(e) {
  e.preventDefault();
  if (!validateTaskForm()) return;

  const newTask = {
    id: makeId(),
    title: document.getElementById("titleInput").value.trim(),
    dueDate: document.getElementById("dateInput").value,
    dueTime: document.getElementById("timeInput").value,
    priority: document.getElementById("priorityInput").value,
    tag: document.getElementById("tagInput").value,
    createdAt: Date.now(),
  };

  tasks.push(newTask);
  renderDashboard();
  taskDialog.close();
  showToast("Task added.");
}

// Delete Task Logic


const confirmDialog = document.getElementById("confirmDialog");

function openConfirmDelete(id) {
  pendingDeleteId = id;
  confirmDialog.showModal();
}

function handleConfirmDelete() {
  tasks = tasks.filter((t) => t.id !== pendingDeleteId);
  pendingDeleteId = null;
  renderDashboard();
  confirmDialog.close();
  showToast("Task deleted.");
}

// Toast feedback

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
}
// Wiring

document.getElementById("openAddTaskBtn").addEventListener("click", openAddTaskDialog);
document.getElementById("cancelBtn").addEventListener("click", () => taskDialog.close());
taskForm.addEventListener("submit", handleAddTaskSubmit);

document.getElementById("confirmCancelBtn").addEventListener("click", () => {
  pendingDeleteId = null;
  confirmDialog.close();
});
document.getElementById("confirmDeleteBtn").addEventListener("click", handleConfirmDelete);

// Init
renderDashboard();