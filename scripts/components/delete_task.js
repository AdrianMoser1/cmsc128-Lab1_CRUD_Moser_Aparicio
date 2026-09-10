import { refresh_task_view } from "./task_tally.js";
import { remove_task } from "../dependencies/db_fetch.js";

const DELETE_DELAY = 10000;

export function delete_task(Task) {
	if (!Task?.shortview) return;
	if (!confirm(`Delete "${Task.title}"?`)) return;

	const TaskCard = Task.shortview;
	const TaskList = document.getElementById("taskList");
	const UndoDialog = create_undo_dialog(Task.title);
	let UndoTimer;
	let CountdownTimer;

	TaskCard.remove();
	Task.shortview = null;
	refresh_task_view();
	show_empty_state_if_needed();

	const RestoreTask = () => {
		clearTimeout(UndoTimer);
		clearInterval(CountdownTimer);
		UndoDialog.remove();
		Task.shortview = TaskCard;
		TaskList.querySelector(".empty-state")?.remove();
		TaskList.appendChild(TaskCard);
		refresh_task_view();
	};

	UndoDialog.querySelector(".undo-delete-btn").addEventListener("click", RestoreTask, { once: true });
	let RemainingSeconds = Math.ceil(DELETE_DELAY / 1000);
	const Countdown = UndoDialog.querySelector(".undo-countdown");
	CountdownTimer = setInterval(() => {
		RemainingSeconds -= 1;
		Countdown.textContent = `${RemainingSeconds}s`;
	}, 1000);
	UndoTimer = setTimeout(async () => {
		clearInterval(CountdownTimer);
		UndoDialog.remove();
		try {
			await remove_task(Task);
		} catch (Error) {
			console.error(Error);
			RestoreTask();
			alert(`The task could not be deleted.\n\n${Error.message}`);
		}
	}, DELETE_DELAY);
}

function create_undo_dialog(TaskTitle) {
	const UndoDialog = document.createElement("div");
	UndoDialog.className = "undo-dialog";
	UndoDialog.setAttribute("role", "status");
	UndoDialog.innerHTML = `
		<span>"${escape_html(TaskTitle)}" will be deleted in <strong class="undo-countdown">10s</strong>.</span>
		<button class="btn btn-ghost undo-delete-btn" type="button">Undo</button>
	`;
	document.body.appendChild(UndoDialog);
	return UndoDialog;
}

function show_empty_state_if_needed() {
	if (!document.querySelector(".task-card") && !document.querySelector(".empty-state")) {
		const TaskList = document.getElementById("taskList");
		const EmptyState = document.createElement("div");
		EmptyState.className = "empty-state";
		EmptyState.innerHTML = `
			<p class="empty-title">You have no tasks yet!</p>
			<p class="empty-sub">
				Click here to make one
				<button class="btn btn-primary" id="emptyAddTaskBtn" type="button">Add Task</button>
			</p>
		`;
		TaskList.appendChild(EmptyState);
		EmptyState.querySelector("button").addEventListener("click", () => {
			document.getElementById("addTaskBtn").click();
		});
	}
}

function escape_html(Value) {
	const Element = document.createElement("span");
	Element.textContent = Value;
	return Element.innerHTML;
}