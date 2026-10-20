import { setup_add_task } from "./components/add_task.js";
import { setup_task_view } from "./components/task_tally.js";
import { fetch_tasks } from "./dependencies/db_fetch.js";
import { require_auth_or_redirect, supabase } from "./dependencies/auth_connection.js";
import { create_task_shortview } from "./components/task_shortview.js";
import { refresh_task_view } from "./components/task_tally.js";
import { setup_list_switcher } from "./components/list_switcher.js";

const Session = await require_auth_or_redirect();

// Keep a handle on the empty-state block: it is removed when there are tasks and must be
// put back when the user switches to a list that has none.
const EmptyState = document.getElementById("emptyState");
// Incremented on every load so a slow response for an old list can't overwrite a newer one.
let LoadCounter = 0;

if (Session) {
	const User = Session.user;
	const DisplayName = User.user_metadata?.display_name || User.email?.split("@")[0] || "there";
	document.getElementById("userGreeting").textContent = `Welcome back! ${DisplayName}`;
	document.getElementById("logoutBtn").addEventListener("click", async () => {
		const { error } = await supabase.auth.signOut();
		if (error) console.error("Failed to log out:", error);
	});

	setup_add_task();
	setup_task_view();

	// Decide which list is active BEFORE the first fetch, otherwise we'd briefly
	// load Personal tasks and then flash to the remembered list.
	await setup_list_switcher(User.id, load_tasks);

	load_tasks();
}

// Removes every rendered task but keeps the static hint and empty-state elements.
function clear_rendered_tasks(TaskList) {
	[...TaskList.children]
		.filter((Node) => !Node.matches(".task-list-hint, #emptyState"))
		.forEach((Node) => Node.remove());
}

async function load_tasks() {
	const ThisLoad = ++LoadCounter;
	try {
		const Tasks = await fetch_tasks(); // scoped to the active list inside db_fetch.js
		if (ThisLoad !== LoadCounter) return; // user already switched lists again

		const TaskList = document.getElementById("taskList");
		clear_rendered_tasks(TaskList);

		if (Tasks.length) EmptyState.remove();
		else if (!EmptyState.isConnected) TaskList.appendChild(EmptyState);

		Tasks.forEach((Task) => TaskList.appendChild(create_task_shortview(Task)));
		refresh_task_view();
	} catch (Error) {
		console.error(Error);
		alert("Tasks could not be loaded. Check your connection to the Internet");
	}
}