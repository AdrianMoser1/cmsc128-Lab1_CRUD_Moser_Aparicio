import { refresh_task_view } from "./task_tally.js";
import { remove_task } from "../dependencies/db_fetch.js";
import { get_active_list_id } from "./active_list.js";
import { confirm_action } from "./confirm_action.js";
import { show_toast } from "./toast.js";

const DELETE_DELAY = 10000;
// An in-flight list fetch can still contain a task after its deletion succeeds.
const RemovedIds = new Set();

export function is_task_removed(Task) {
	return RemovedIds.has(String(Task.id || Task.uid));
}

export async function delete_task(Task) {
	return delete_tasks([Task]);
}

export async function delete_tasks(Tasks) {
	const PendingTasks = Tasks.filter((Task) => Task?.shortview?.isConnected && (Task.id || Task.uid) && !is_task_removed(Task));
	if (!PendingTasks.length) return;

	const Count = PendingTasks.length;
	const Title = Count === 1 ? "Delete this task?" : `Delete ${Count} selected tasks?`;
	const Message = document.createDocumentFragment();
	Message.append(
		Count === 1
			? `"${PendingTasks[0].title}" will be permanently deleted after a 10-second undo window.`
			: `${Count} tasks will be permanently deleted after a 10-second undo window.`,
		document.createElement("br")
	);
	const Warning = document.createElement("strong");
	Warning.textContent = "Deleted tasks cannot be recovered.";
	Message.append(Warning);
	if (!await confirm_action(Title, Message, Count === 1 ? "Delete task" : "Delete tasks")) return;

	start_delete_countdown(PendingTasks);
}

function start_delete_countdown(Tasks) {
	const TaskList = document.getElementById("taskList");
	const ListId = Tasks[0].list_id || null;
	const Cards = Tasks.map((Task) => ({ Task, Card: Task.shortview }));
	const UndoDialog = create_undo_dialog(Tasks);
	let UndoTimer;
	let CountdownTimer;

	Cards.forEach(({ Task, Card }) => {
		const Selection = Card.querySelector(".task-select");
		if (Selection) Selection.checked = false;
		RemovedIds.add(Card.dataset.taskId);
		Card.remove();
		Task.shortview = null;
	});
	refresh_task_view();

	const Countdown = UndoDialog.querySelector(".undo-countdown");
	const Deadline = performance.now() + DELETE_DELAY;
	CountdownTimer = setInterval(() => {
		const RemainingSeconds = Math.max(0, Math.ceil((Deadline - performance.now()) / 1000));
		Countdown.textContent = `${RemainingSeconds}s`;
	}, 1000);
	UndoDialog.querySelector(".undo-delete-btn").addEventListener("click", () => {
		if (performance.now() >= Deadline) return;
		clearTimeout(UndoTimer);
		clearInterval(CountdownTimer);
		UndoDialog.remove();
		restore_tasks(Cards, TaskList, ListId);
		show_toast("Task deletion canceled.");
	}, { once: true });

	UndoTimer = setTimeout(async () => {
		clearInterval(CountdownTimer);
		const UndoButton = UndoDialog.querySelector(".undo-delete-btn");
		UndoButton.disabled = true;
		UndoButton.setAttribute("aria-busy", "true");
		UndoButton.textContent = "Deleting...";
		UndoDialog.querySelector(".undo-message").textContent = "Deleting tasks...";

		const Results = await Promise.allSettled(Tasks.map((Task) => remove_task(Task)));
		const FailedTasks = Results.flatMap((Result, Index) => {
			if (Result.status === "fulfilled") return [];
			console.error("Could not delete task:", Result.reason);
			return [Cards[Index]];
		});
		UndoDialog.remove();
		const DeletedIds = Results.flatMap((Result, Index) =>
			Result.status === "fulfilled" ? [Cards[Index].Card.dataset.taskId] : []
		);
		if (DeletedIds.length) TaskList.dispatchEvent(new CustomEvent("tasksdeleted", { detail: DeletedIds }));

		if (FailedTasks.length) {
			restore_tasks(FailedTasks, TaskList, ListId);
			const DeletedCount = Tasks.length - FailedTasks.length;
			const Message = DeletedCount
				? `${FailedTasks.length} task${FailedTasks.length === 1 ? "" : "s"} could not be deleted. The others were deleted.`
				: "Tasks could not be deleted. Check your connection and try again.";
			show_toast(Message, "error");
		} else {
			show_toast(Tasks.length === 1 ? "Task deleted." : `${Tasks.length} tasks deleted.`);
		}
	}, DELETE_DELAY);
}

function restore_tasks(Cards, TaskList, ListId) {
	for (const { Card } of Cards) RemovedIds.delete(Card.dataset.taskId);
	if (get_active_list_id() === ListId) {
		const ExistingCards = new Map(
			[...TaskList.querySelectorAll(".task-card")].map((Card) => [Card.dataset.taskId, Card])
		);
		for (const { Task, Card } of Cards) {
			const TaskId = String(Task.id || Task.uid);
			const ExistingCard = ExistingCards.get(TaskId);
			if (ExistingCard) {
				Task.shortview = ExistingCard;
				continue;
			}
			Task.shortview = Card;
			TaskList.appendChild(Task.shortview);
		}
		refresh_task_view();
	}
}

function create_undo_dialog(Tasks) {
	const UndoDialog = document.createElement("div");
	UndoDialog.className = "undo-dialog";
	UndoDialog.setAttribute("role", "group");
	UndoDialog.setAttribute("aria-label", "Undo task deletion");
	const Message = document.createElement("span");
	Message.className = "undo-message";
	Message.setAttribute("role", "status");
	const Count = Tasks.length;
	Message.textContent = Count === 1
		? `"${Tasks[0].title}" queued for deletion.`
		: `${Count} tasks queued for deletion.`;
	const Countdown = document.createElement("strong");
	Countdown.className = "undo-countdown";
	Countdown.textContent = "10s";

	const UndoButton = document.createElement("button");
	UndoButton.className = "btn btn-ghost undo-delete-btn";
	UndoButton.type = "button";
	UndoButton.textContent = "Undo";
	UndoDialog.append(Message, Countdown, UndoButton);
	document.getElementById("taskUndoStack").appendChild(UndoDialog);

	return UndoDialog;
}
