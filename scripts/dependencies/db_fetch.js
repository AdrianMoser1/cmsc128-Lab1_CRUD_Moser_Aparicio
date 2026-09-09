import { get_client_id, supabase_request } from "./db_connection.js";

export async function fetch_tasks() {
	const ClientId = encodeURIComponent(get_client_id());
	const Rows = await supabase_request(`tasks?client_id=eq.${ClientId}&select=*&order=created_at.asc`);
	return Rows.map(row_to_task);
}

export async function insert_task(Task) {
	const Rows = await supabase_request("tasks", {
		method: "POST",
		body: JSON.stringify(task_to_row(Task))
	});
	return row_to_task(Rows[0]);
}

export async function update_task(Task) {
	const TaskId = encodeURIComponent(Task.id || Task.uid);
	const ClientId = encodeURIComponent(get_client_id());
	const Rows = await supabase_request(`tasks?id=eq.${TaskId}&client_id=eq.${ClientId}`, {
		method: "PATCH",
		body: JSON.stringify(task_to_row(Task))
	});
	return row_to_task(Rows[0]);
}

export async function remove_task(Task) {
	const TaskId = encodeURIComponent(Task.id || Task.uid);
	const ClientId = encodeURIComponent(get_client_id());
	await supabase_request(`tasks?id=eq.${TaskId}&client_id=eq.${ClientId}`, {
		method: "DELETE"
	});
}

function task_to_row(Task) {
	return {
		client_id: get_client_id(),
		title: Task.title,
		description: Task.description || null,
		completed: Boolean(Task.completed),
		priority: (Task.priority || "Med").toLowerCase(),
		tag: normalize_tag(Task.tag).toLowerCase(),
		due_date: Task.due_date || null
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