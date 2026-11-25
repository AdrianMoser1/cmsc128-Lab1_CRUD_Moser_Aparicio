import { open_task_popup } from "./task_popup.js";
import { delete_task } from "./delete_task.js";
import { refresh_task_view } from "./task_tally.js";
import { update_task } from "../dependencies/db_fetch.js";
import { show_toast } from "./toast.js";

export function create_task_shortview(Task) {
	const TaskCard = document.createElement("article");
	const Tag = normalize_tag(Task.tag);
	const CreatedAt = Task.created_at || Task.start_date || "";
	const CreatedAtLabel = format_created_at(CreatedAt);
	TaskCard.className = "task-card";
	TaskCard.dataset.taskId = String(Task.id || Task.uid);
	TaskCard.dataset.priority = Task.priority || "Med";
	TaskCard.dataset.tag = Tag;
	TaskCard.dataset.dueDate = Task.due_date || "";
	TaskCard.dataset.createdAt = CreatedAt;
	Task.shortview = TaskCard;
	TaskCard.taskData = Task;
	TaskCard.innerHTML = `
		<label class="task-select-wrap">
			<input type="checkbox" class="task-select">
			<span class="task-select-mark" aria-hidden="true"></span>
		</label>
		<button type="button" class="task-check" aria-label="${Task.completed ? "Mark task incomplete" : "Mark task complete"}" aria-pressed="${Boolean(Task.completed)}">✓</button>
		<div class="task-body">
			<button type="button" class="task-title-edit">
				<span class="task-title">${escape_html(Task.title)}</span>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16z"></path>
				</svg>
			</button>
			<div class="task-meta">
				<span class="task-due">${escape_html(format_due(Task.due_date, Task.due_time))}</span>
				<span class="badge">${escape_html(Task.priority || "Med")}</span>
				<span class="badge badge-tag">${escape_html(Tag)}</span>
				<span class="task-created">Created on: ${escape_html(CreatedAtLabel || "No date")}</span>
			</div>
		</div>
		<div class="task-actions">
			<button type="button" class="icon-btn delete-btn">Delete</button>
		</div>
	`;

	TaskCard.querySelector(".task-select").setAttribute("aria-label", `Select task: ${Task.title}`);
	TaskCard.querySelector(".task-title-edit").setAttribute("aria-label", `Edit task: ${Task.title}`);
	render_task_completion(Task);
	TaskCard.addEventListener("click", (Event) => {
		if (Event.target.closest("button, input, label, select, textarea, a")) return;
		open_task_popup(Task);
	});
	TaskCard.querySelector(".task-title-edit").addEventListener("click", () => open_task_popup(Task));
	TaskCard.querySelector(".task-check").addEventListener("click", async () => {
		const PreviousCompleted = Task.completed;
		Task.completed = !Task.completed;
		render_task_completion(Task);
		const Controls = [...TaskCard.querySelectorAll("button, input")];
		Controls.forEach((Control) => { Control.disabled = true; });
		TaskCard.setAttribute("aria-busy", "true");
		TaskCard.closest(".task-list")?.dispatchEvent(new Event("taskviewchange"));
		try {
			await update_task(Task, { completed: Task.completed });
			refresh_task_view();
			show_toast(Task.completed ? "Task completed." : "Task reopened.");
		} catch (Error) {
			console.error(Error);
			Task.completed = PreviousCompleted;
			render_task_completion(Task);
			refresh_task_view();
			show_toast("Task could not be updated. Check your connection and try again.", "error");
		} finally {
			Controls.forEach((Control) => { Control.disabled = false; });
			TaskCard.removeAttribute("aria-busy");
			TaskCard.closest(".task-list")?.dispatchEvent(new Event("taskviewchange"));
		}
	});
	TaskCard.querySelector(".delete-btn").addEventListener("click", () => {
		delete_task(Task);
	});

	return TaskCard;
}

export function render_task_completion(Task) {
	const TaskCard = Task.shortview;
	if (!TaskCard) return;

	const IsCompleted = Boolean(Task.completed);
	TaskCard.dataset.completed = String(IsCompleted);
	TaskCard.classList.toggle("is-completed", IsCompleted);
	TaskCard.classList.toggle("is-overdue", is_overdue(Task));
	const CheckButton = TaskCard.querySelector(".task-check");
	CheckButton.setAttribute("aria-pressed", String(IsCompleted));
	CheckButton.setAttribute("aria-label", IsCompleted ? "Mark task incomplete" : "Mark task complete");
}

function normalize_tag(Tag) {
	return Tag === "Others" ? "Other" : Tag || "Other";
}

function format_created_at(Value) {
	if (!Value) return "";

	const DateValue = new Date(Value);
	if (Number.isNaN(DateValue.getTime())) return Value;

	const HasTime = Value.includes("T") || Value.includes(":");
	return format_local_date(DateValue, HasTime);
}

function format_local_date(DateValue, HasTime) {
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		...(HasTime ? { hour: "numeric", minute: "2-digit", hour12: true } : {})
	}).format(DateValue);
}

function format_due(DateValue, TimeValue) {
	if (!DateValue && !TimeValue) return "No due date";
	if (!DateValue) return `Due at ${format_time(TimeValue)}`;

	const DueDate = new Date(`${DateValue}T${TimeValue || "00:00"}`);
	if (Number.isNaN(DueDate.getTime())) return `${DateValue}${TimeValue ? ` at ${TimeValue}` : ""}`;
	return format_local_date(DueDate, Boolean(TimeValue));
}

function format_time(Value) {
	const TimeValue = new Date(`1970-01-01T${Value}`);
	if (Number.isNaN(TimeValue.getTime())) return Value;
	return new Intl.DateTimeFormat(undefined, {
		hour: "numeric",
		minute: "2-digit",
		hour12: true
	}).format(TimeValue);
}

function is_overdue(Task) {
	if (Task.completed || !Task.due_date) return false;

	const DueDate = new Date(`${Task.due_date}T${Task.due_time || "23:59"}`);
	return !Number.isNaN(DueDate.getTime()) && DueDate < new Date();
}

function escape_html(Value) {
	const Element = document.createElement("span");
	Element.textContent = Value;
	return Element.innerHTML;
}
