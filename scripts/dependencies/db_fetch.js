import { supabase_request } from "./db_connection.js";

export async function fetch_tasks() {
	const Rows = await supabase_request("tasks?select=*&order=created_at.asc");
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
	const Rows = await supabase_request(`tasks?id=eq.${TaskId}`, {
		method: "PATCH",
		body: JSON.stringify(task_to_row(Task))
	});
	return row_to_task(Rows[0]);
}

export async function remove_task(Task) {
	const TaskId = encodeURIComponent(Task.id || Task.uid);
	await supabase_request(`tasks?id=eq.${TaskId}`, {
		method: "DELETE"
	});
}

function task_to_row(Task) {
	return {
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