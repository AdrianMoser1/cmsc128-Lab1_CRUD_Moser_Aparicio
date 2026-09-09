import { open_task_popup } from "./task_popup.js";
import { create_task_shortview } from "./task_shortview.js";
import { refresh_task_view } from "./task_tally.js";

function create_task_from_form(FormData) {
	return {
        uid: FormData.get("uid"),
		title: FormData.get("title").trim(),
		description: FormData.get("description").trim(),
		start_date: FormData.get("start_date"),
		due_date: FormData.get("due_date"),
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
	document.addEventListener("submit", (Event) => {
		if (Event.target.id !== "taskForm") return;
		const Task = create_task_from_form(new FormData(Event.target));
		const TaskDialog = document.getElementById("task-dialog");
		const PreviousTask = TaskDialog.taskToEdit;

		if (PreviousTask) {
			Task.shortview = PreviousTask.shortview;
			PreviousTask.shortview.replaceWith(create_task_shortview(Task));
		} else {
			const TaskList = document.getElementById("taskList");
			document.getElementById("emptyState")?.remove();
			TaskList.appendChild(create_task_shortview(Task));
		}
		refresh_task_view();

		TaskDialog.taskToEdit = null;
	});
}