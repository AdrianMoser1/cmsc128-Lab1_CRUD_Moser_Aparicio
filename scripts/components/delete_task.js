import { refresh_task_view } from "./task_tally.js";

export function delete_task(Task) {
	if (!Task?.shortview) return;

	Task.shortview.remove();
	Task.shortview = null;
	refresh_task_view();

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