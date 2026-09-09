import { open_task_popup } from "./task_popup.js";

export function create_task_shortview(Task) {
	const TaskSection = document.createElement("section");
	TaskSection.className = "task-shortview";
	TaskSection.tabIndex = 0;
	TaskSection.setAttribute("role", "button");
	Task.shortview = TaskSection;
	TaskSection.innerHTML = `
		<strong>${Task.title}</strong>
		<span>Due: ${Task.due_date || "No date"}</span>
		<span>Priority: ${Task.priority}</span>
		<span>Tag: ${Task.tag}</span>
	`;

	TaskSection.addEventListener("click", () => open_task_popup(Task));
	return TaskSection;
}
