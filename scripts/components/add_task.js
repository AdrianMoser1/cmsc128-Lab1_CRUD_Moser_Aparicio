import { open_task_popup } from "./task_popup.js";

function create_task_from_form(FormData) {
	return {
		title: FormData.get("title").trim(),
		description: FormData.get("description").trim()
	};
}

export function setup_add_task() {
	const AddTaskButton = document.getElementById("addTaskBtn");

	AddTaskButton.addEventListener("click", open_task_popup);
	
    // listens to any form submit action but filters it to the dialog ## see task_popup.js
	document.addEventListener("submit", (Event) => {
		if (Event.target.id !== "taskForm") return;
		const Task = create_task_from_form(new FormData(Event.target));
		console.log("Task added:", Task);
	});
}