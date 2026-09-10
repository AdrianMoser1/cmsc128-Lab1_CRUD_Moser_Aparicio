import { open_task_popup } from "./task_popup.js";
import { delete_task } from "./delete_task.js";
import { render_task_tally } from "./task_tally.js";
import { update_task } from "../dependencies/db_fetch.js";

export function create_task_shortview(Task) {
	const TaskCard = document.createElement("article");
	const Tag = normalize_tag(Task.tag);
	const CreatedAt = Task.created_at || Task.start_date || "";
	const CreatedAtLabel = format_created_at(CreatedAt);
	TaskCard.className = "task-card";
	TaskCard.tabIndex = 0;
	TaskCard.setAttribute("role", "button");
	TaskCard.dataset.priority = Task.priority || "Med";
	TaskCard.dataset.tag = Tag;
	TaskCard.dataset.dueDate = Task.due_date || "";
	TaskCard.dataset.createdAt = CreatedAt;
	TaskCard.dataset.completed = Task.completed ? "true" : "false";
	TaskCard.classList.toggle("is-completed", Boolean(Task.completed));
	TaskCard.classList.toggle("is-overdue", is_overdue(Task));
	Task.shortview = TaskCard;
	TaskCard.innerHTML = `
		<button type="button" class="task-check" aria-label="${Task.completed ? "Mark task incomplete" : "Mark task complete"}" aria-pressed="${Boolean(Task.completed)}">✓</button>
		<div class="task-body">
			<p class="task-title">${escape_html(Task.title)}</p>
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

	TaskCard.addEventListener("click", () => open_task_popup(Task));
	TaskCard.querySelector(".task-check").addEventListener("click", async (Event) => {
		Event.stopPropagation();
		const PreviousCompleted = Task.completed;
		Task.completed = !Task.completed;
		TaskCard.dataset.completed = Task.completed ? "true" : "false";
		TaskCard.classList.toggle("is-completed", Task.completed);
		TaskCard.classList.toggle("is-overdue", is_overdue(Task));
		TaskCard.hidden = Task.completed && !document.getElementById("showCompleted")?.checked;
		Event.currentTarget.setAttribute("aria-pressed", String(Task.completed));
		Event.currentTarget.setAttribute("aria-label", Task.completed ? "Mark task incomplete" : "Mark task complete");
		try {
			await update_task(Task);
			render_task_tally();
		} catch (Error) {
			console.error(Error);
			Task.completed = PreviousCompleted;
			TaskCard.dataset.completed = Task.completed ? "true" : "false";
			TaskCard.classList.toggle("is-completed", Task.completed);
			TaskCard.classList.toggle("is-overdue", is_overdue(Task));
			TaskCard.hidden = false;
			Event.currentTarget.setAttribute("aria-pressed", String(Task.completed));
			Event.currentTarget.setAttribute("aria-label", Task.completed ? "Mark task incomplete" : "Mark task complete");
			alert(`The task could not be updated.\n\n${Error.message}`);
		}
	});
	TaskCard.querySelector(".delete-btn").addEventListener("click", (Event) => {
		Event.stopPropagation();
		delete_task(Task);
	});

	return TaskCard;
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
