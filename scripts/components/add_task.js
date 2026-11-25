import { open_task_popup } from "./task_popup.js";
import { create_task_shortview } from "./task_shortview.js";
import { refresh_task_view } from "./task_tally.js";
import { insert_task, update_task } from "../dependencies/db_fetch.js";
import { show_toast } from "./toast.js";
import { get_active_list_id } from "./active_list.js";

function create_task_from_form(FormData) {
	return {
        uid: FormData.get("uid"),
		title: FormData.get("title").trim(),
		description: FormData.get("description").trim(),
		start_date: FormData.get("start_date"),
		due_date: FormData.get("due_date"),
		due_time: FormData.get("due_time"),
		priority: FormData.get("priority"),
		tag: FormData.get("tag"),
		completed: FormData.get("completed") === "on"
	};
}

export function setup_add_task(LoadTasks) {
	const AddTaskButton = document.getElementById("addTaskBtn");
	const EmptyAddTaskButton = document.getElementById("emptyAddTaskBtn");

	for (const Button of [AddTaskButton, EmptyAddTaskButton]) {
		Button.addEventListener("click", () => open_task_popup());
	}

	document.addEventListener("submit", async (Event) => {
		const Form = Event.target;
		if (Form.id !== "taskForm") return;
		Event.preventDefault();

		const SubmitButton = Form.querySelector("button[type='submit']");
		if (SubmitButton.disabled) return;

		const Task = create_task_from_form(new FormData(Form));
		const TaskDialog = document.getElementById("task-dialog");
		const PreviousTask = TaskDialog.taskToEdit;
		const ListId = PreviousTask ? PreviousTask.list_id : get_active_list_id();
		const IsCurrentForm = () => TaskDialog.open && TaskDialog.contains(Form);
		const ErrorBox = Form.querySelector("#taskSaveError");
		ErrorBox.hidden = true;
		ErrorBox.textContent = "";
		SubmitButton.disabled = true;
		SubmitButton.setAttribute("aria-busy", "true");
		SubmitButton.textContent = "Saving...";

		try {
			const SavedTask = PreviousTask
				? await update_task({ ...Task, id: PreviousTask.id, uid: PreviousTask.uid })
				: await insert_task(Task, ListId);
			const ShouldClose = IsCurrentForm();
			if (ShouldClose) {
				TaskDialog.taskToEdit = null;
				TaskDialog.close();
			}
			const FocusWasOnEmptyState = ShouldClose && document.activeElement === EmptyAddTaskButton;
			show_toast(PreviousTask ? "Task updated." : "Task added.");
			if (ListId !== get_active_list_id()) return;

			const TaskList = document.getElementById("taskList");
			if (TaskList.inert || !document.getElementById("taskLoadError").hidden) {
				// A fetch that started before the save may still return the old list.
				LoadTasks();
				return;
			}

			const TaskId = String(SavedTask.id || SavedTask.uid);
			const PreviousCard = Array.from(TaskList.querySelectorAll(".task-card"))
				.find((Card) => Card.dataset.taskId === TaskId);
			if (PreviousTask && !PreviousCard) return;

			const SavedCard = create_task_shortview(SavedTask);
			if (PreviousCard) PreviousCard.replaceWith(SavedCard);
			else TaskList.appendChild(SavedCard);
			refresh_task_view();

			if (FocusWasOnEmptyState) {
				const NextControl = SavedCard.hidden
					? document.getElementById("showAllTasksBtn")
					: SavedCard.querySelector(".task-title-edit");
				NextControl.focus();
			}
		} catch (Error) {
			console.error(Error);
			const Message = "Task could not be saved. Check your connection and try again.";
			if (IsCurrentForm()) {
				ErrorBox.textContent = Message;
				ErrorBox.hidden = false;
			} else {
				show_toast(Message, "error");
			}
		} finally {
			if (IsCurrentForm()) {
				SubmitButton.disabled = false;
				SubmitButton.removeAttribute("aria-busy");
				SubmitButton.textContent = PreviousTask ? "Apply Edits" : "Add task";
			}
		}
	});
}
