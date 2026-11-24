import { open_task_popup } from "./task_popup.js";
import { create_task_shortview } from "./task_shortview.js";
import { refresh_task_view } from "./task_tally.js";
import { insert_task, update_task } from "../dependencies/db_fetch.js";
import { show_toast } from "./toast.js";

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

export function setup_add_task() {
	const AddTaskButton = document.getElementById("addTaskBtn");
	const EmptyAddTaskButton = document.getElementById("emptyAddTaskBtn");

	AddTaskButton.addEventListener("click", () => open_task_popup());
	EmptyAddTaskButton.addEventListener("click", () => open_task_popup());
	
    // listens to any form submit action but filters it to the dialog ## see task_popup.js
	document.addEventListener("submit", async (Event) => {
		if (Event.target.id !== "taskForm") return;
		Event.preventDefault();
		const Task = create_task_from_form(new FormData(Event.target));
		const TaskDialog = document.getElementById("task-dialog");
		const PreviousTask = TaskDialog.taskToEdit;
		const SubmitButton = Event.target.querySelector("button[type='submit']");
		const ErrorBox = Event.target.querySelector("#taskSaveError");
		ErrorBox.hidden = true;
		ErrorBox.textContent = "";
		SubmitButton.disabled = true;
		SubmitButton.setAttribute("aria-busy", "true");
		SubmitButton.textContent = "Saving...";

		try {
			const SavedTask = PreviousTask
				? await update_task({ ...Task, id: PreviousTask.id, uid: PreviousTask.uid })
				: await insert_task(Task);
			const TaskList = document.getElementById("taskList");
			if (PreviousTask) {
				SavedTask.shortview = PreviousTask.shortview;
				PreviousTask.shortview.replaceWith(create_task_shortview(SavedTask));
			} else {
				document.getElementById("emptyState")?.remove();
				TaskList.appendChild(create_task_shortview(SavedTask));
			}
			refresh_task_view();
			TaskDialog.taskToEdit = null;
			TaskDialog.close();
			show_toast(PreviousTask ? "Task updated." : "Task added.");
		} catch (Error) {
			console.error(Error);
			ErrorBox.textContent = "Task could not be saved. Check your connection and try again.";
			ErrorBox.hidden = false;
		} finally {
			if (TaskDialog.open) {
				SubmitButton.disabled = false;
				SubmitButton.removeAttribute("aria-busy");
				SubmitButton.textContent = PreviousTask ? "Apply Edits" : "Add task";
			}
		}
	});
}