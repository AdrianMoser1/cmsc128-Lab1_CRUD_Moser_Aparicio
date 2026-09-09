import { setup_add_task } from "./components/add_task.js";
import { setup_task_view } from "./components/task_tally.js";
import { fetch_tasks } from "./dependencies/db_fetch.js";
import { create_task_shortview } from "./components/task_shortview.js";
import { refresh_task_view } from "./components/task_tally.js";

setup_add_task();
setup_task_view();

load_tasks();

async function load_tasks() {
	try {
		const Tasks = await fetch_tasks();
		const TaskList = document.getElementById("taskList");
		if (Tasks.length) document.getElementById("emptyState")?.remove();
		Tasks.forEach((Task) => TaskList.appendChild(create_task_shortview(Task)));
		refresh_task_view();
	} catch (Error) {
		console.error(Error);
		alert("Tasks could not be loaded. Check your connection to the Internet");
	}
}