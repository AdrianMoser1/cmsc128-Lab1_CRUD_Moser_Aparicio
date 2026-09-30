import { get_client_id, supabase_request } from "./db_connection.js";
import { get_current_session } from "./auth_connection.js";

async function get_account_id() {
	const Session = await get_current_session();
	if (!Session?.user?.id) throw new Error("You must be signed in to access tasks.");
	return Session.user.id;
}

export async function fetch_tasks() {
	const AccountId = await get_account_id();
	const LegacyClientId = get_client_id();
	if (LegacyClientId !== AccountId) {
		await supabase_request(`tasks?client_id=eq.${encodeURIComponent(LegacyClientId)}`, {
			method: "PATCH",
			body: JSON.stringify({ client_id: AccountId })
		});
	}
	const Rows = await supabase_request(`tasks?select=*&client_id=eq.${encodeURIComponent(AccountId)}&order=created_at.asc`);
	return Rows.map(row_to_task);
}

export async function insert_task(Task) {
	const AccountId = await get_account_id();
	const Rows = await supabase_request("tasks", {
		method: "POST",
		body: JSON.stringify(task_to_row(Task, AccountId))
	});
	return row_to_task(Rows[0]);
}

export async function update_task(Task) {
	const AccountId = await get_account_id();
	const TaskId = encodeURIComponent(Task.id || Task.uid);
	const Rows = await supabase_request(`tasks?id=eq.${TaskId}&client_id=eq.${encodeURIComponent(AccountId)}`, {
		method: "PATCH",
		body: JSON.stringify(task_to_row(Task, AccountId))
	});
	return row_to_task(Rows[0]);
}

export async function remove_task(Task) {
	const AccountId = await get_account_id();
	const TaskId = encodeURIComponent(Task.id || Task.uid);
	await supabase_request(`tasks?id=eq.${TaskId}&client_id=eq.${encodeURIComponent(AccountId)}`, {
		method: "DELETE"
	});
}

function task_to_row(Task, AccountId) {
	return {
		client_id: AccountId,
		title: Task.title,
		description: Task.description || null,
		completed: Boolean(Task.completed),
		priority: (Task.priority || "Med").toLowerCase(),
		tag: normalize_tag(Task.tag).toLowerCase(),
		due_date: Task.due_date || null,
		due_time: Task.due_time || null
	};
}

function row_to_task(Row) {
	return {
		id: Row.id,
		uid: Row.id,
		title: Row.title,
		description: Row.description || "",
		start_date: Row.created_at?.slice(0, 10) || "",
		created_at: Row.created_at,
		due_date: Row.due_date || "",
		due_time: Row.due_time || "",
		priority: capitalize(Row.priority),
		tag: capitalize(Row.tag),
		completed: Boolean(Row.completed)
	};
}

function normalize_tag(Tag) {
	return Tag === "Others" ? "Other" : Tag || "Other";
}

function capitalize(Value) {
	return Value ? Value.charAt(0).toUpperCase() + Value.slice(1) : Value;
}