import { setup_add_task } from "./components/add_task.js";
import { setup_task_view } from "./components/task_tally.js";
import { fetch_tasks } from "./dependencies/db_fetch.js";
import { require_auth_or_redirect, supabase } from "./dependencies/auth_connection.js";
import { create_task_shortview } from "./components/task_shortview.js";
import { refresh_task_view } from "./components/task_tally.js";
import { setup_list_switcher } from "./components/list_switcher.js";
import { is_task_removed } from "./components/delete_task.js";
import { setup_bulk_actions } from "./components/bulk_actions.js";
import { show_toast } from "./components/toast.js";

const Session = await require_auth_or_redirect();

// Incremented on every load so a slow response for an old list can't overwrite a newer one.
let LoadCounter = 0;

if (Session) {
	const User = Session.user;
	const DisplayName = User.user_metadata?.display_name || User.email?.split("@")[0] || "there";
	document.getElementById("userGreeting").textContent = DisplayName;
	const LogoutButton = document.getElementById("logoutBtn");
	LogoutButton.addEventListener("click", async () => {
		LogoutButton.disabled = true;
		LogoutButton.setAttribute("aria-busy", "true");
		LogoutButton.textContent = "Logging out...";
		try {
			const { error } = await supabase.auth.signOut();
			if (error) throw error;
		} catch (Error) {
			console.error("Failed to log out:", Error);
			show_toast("Could not log out. Check your connection and try again.", "error");
			LogoutButton.disabled = false;
			LogoutButton.removeAttribute("aria-busy");
			LogoutButton.textContent = "Log out";
		}
	});

	setup_add_task(load_tasks);
	setup_task_view();
	setup_bulk_actions();
	document.getElementById("retryTasksBtn").addEventListener("click", () => {
		document.getElementById("listSelect").focus();
		load_tasks();
	});

	// Decide which list is active BEFORE the first fetch, otherwise we'd briefly
	// load Personal tasks and then flash to the remembered list.
	await setup_list_switcher(User.id, load_tasks);

	load_tasks();
}

async function load_tasks() {
	const ThisLoad = ++LoadCounter;
	const TaskList = document.getElementById("taskList");
	const LoadError = document.getElementById("taskLoadError");
	LoadError.hidden = true;
	TaskList.classList.add("is-loading");
	TaskList.setAttribute("aria-busy", "true");
	TaskList.inert = true;
	TaskList.dispatchEvent(new Event("tasklistloading"));
	try {
		const Tasks = await fetch_tasks(); // scoped to the active list inside db_fetch.js
		if (ThisLoad !== LoadCounter) return; // user already switched lists again

		TaskList.querySelectorAll(".task-card").forEach((Card) => Card.remove());
		for (const Task of Tasks) {
			if (!is_task_removed(Task)) TaskList.appendChild(create_task_shortview(Task));
		}
	} catch (Error) {
		console.error(Error);
		if (ThisLoad === LoadCounter) {
			TaskList.querySelectorAll(".task-card").forEach((Card) => Card.remove());
			LoadError.hidden = false;
		}
	} finally {
		if (ThisLoad === LoadCounter) {
			TaskList.classList.remove("is-loading");
			TaskList.removeAttribute("aria-busy");
			TaskList.inert = false;
			refresh_task_view();
		}
	}
}