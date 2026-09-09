import { refresh_task_view } from "./task_tally.js";
import { remove_task } from "../dependencies/db_fetch.js";

export async function delete_task(Task) {
	if (!Task?.shortview) return;

	try {
		await remove_task(Task);
		Task.shortview.remove();
		Task.shortview = null;
		refresh_task_view();
	} catch (Error) {
		console.error(Error);
		alert(`The task could not be deleted.\n\n${Error.message}`);
		return;
	}

	if (!document.querySelector(".task-card")) {
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