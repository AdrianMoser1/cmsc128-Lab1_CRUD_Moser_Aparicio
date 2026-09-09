import { refresh_task_view } from "./task_tally.js";
import { remove_task } from "../dependencies/db_fetch.js";

let PendingDelete = null;

export async function delete_task(Task) {
	if (!Task?.shortview) return;

	const Confirmed = await confirm_delete(Task.title);
	if (!Confirmed) return;

	if (PendingDelete) finalize_pending_delete();

	const TaskCard = Task.shortview;
	const Parent = TaskCard.parentNode;
	const NextSibling = TaskCard.nextSibling;
	TaskCard.remove();
	refresh_task_view();
	ensure_empty_state();

	const Toast = show_undo_toast();
	const Timer = setTimeout(() => finalize_pending_delete(), 5000);
	PendingDelete = { Task, TaskCard, Parent, NextSibling, Toast, Timer };
}

function confirm_delete(Title) {
	return new Promise((Resolve) => {
		const Dialog = document.createElement("dialog");
		Dialog.className = "confirm-dialog";
		Dialog.innerHTML = `
			<p>Delete <strong>${escape_html(Title || "this task")}</strong>?</p>
			<div class="dialog-actions">
				<button type="button" class="btn btn-ghost cancel-delete">Cancel</button>
				<button type="button" class="btn btn-danger confirm-delete">Delete</button>
			</div>`;
		document.body.appendChild(Dialog);

		const Finish = (Value) => {
			Dialog.close();
			Dialog.remove();
			Resolve(Value);
		};
		Dialog.querySelector(".cancel-delete").addEventListener("click", () => Finish(false));
		Dialog.querySelector(".confirm-delete").addEventListener("click", () => Finish(true));
		Dialog.addEventListener("cancel", (Event) => { Event.preventDefault(); Finish(false); });
		Dialog.showModal();
	});
}

function show_undo_toast() {
	const Toast = document.createElement("div");
	Toast.className = "toast undo-toast";
	Toast.innerHTML = `Task deleted. <button type="button" class="toast-undo">Undo</button>`;
	document.body.appendChild(Toast);
	requestAnimationFrame(() => Toast.classList.add("is-visible"));
	Toast.querySelector(".toast-undo").addEventListener("click", undo_pending_delete);
	return Toast;
}

function undo_pending_delete() {
	if (!PendingDelete) return;
	const { Task, TaskCard, Parent, NextSibling, Toast, Timer } = PendingDelete;
	clearTimeout(Timer);
	if (NextSibling && NextSibling.parentNode === Parent) Parent.insertBefore(TaskCard, NextSibling);
	else Parent.appendChild(TaskCard);
	Task.shortview = TaskCard;
	remove_empty_state();
	dismiss_toast(Toast);
	PendingDelete = null;
	refresh_task_view();
}

async function finalize_pending_delete() {
	if (!PendingDelete) return;
	const Current = PendingDelete;
	PendingDelete = null;
	clearTimeout(Current.Timer);
	dismiss_toast(Current.Toast);

	try {
		await remove_task(Current.Task);
		Current.Task.shortview = null;
	} catch (Error) {
		console.error(Error);
		if (Current.NextSibling && Current.NextSibling.parentNode === Current.Parent) {
			Current.Parent.insertBefore(Current.TaskCard, Current.NextSibling);
		} else {
			Current.Parent.appendChild(Current.TaskCard);
		}
		Current.Task.shortview = Current.TaskCard;
		remove_empty_state();
		refresh_task_view();
		alert(`The task could not be deleted.\n\n${Error.message}`);
	}
}

function ensure_empty_state() {
	if (document.querySelector(".task-card") || document.getElementById("emptyState")) return;
	const EmptyState = document.createElement("div");
	EmptyState.className = "empty-state";
	EmptyState.id = "emptyState";
	EmptyState.innerHTML = `<p class="empty-title">Create a task using the "+ Add Task"</p>`;
	document.getElementById("taskList")?.appendChild(EmptyState);
}

function remove_empty_state() {
	document.getElementById("emptyState")?.remove();
}

function dismiss_toast(Toast) {
	if (!Toast) return;
	Toast.classList.remove("is-visible");
	setTimeout(() => Toast.remove(), 220);
}

function escape_html(Value) {
	const Element = document.createElement("span");
	Element.textContent = Value;
	return Element.innerHTML;
}