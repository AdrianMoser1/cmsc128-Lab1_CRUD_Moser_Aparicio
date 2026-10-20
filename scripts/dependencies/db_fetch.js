import { supabase_request } from "./db_connection.js";
import { get_current_user } from "./auth_connection.js";

export async function fetch_tasks() {
	const ClientId = encodeURIComponent(await get_authenticated_user_id());
	const Rows = await supabase_request(`tasks?select=*&user_id=eq.${ClientId}&order=created_at.asc`);
	return Rows.map(row_to_task);
}

export async function insert_task(Task) {
	const UserId = await get_authenticated_user_id();
	const Rows = await supabase_request("tasks", {
		method: "POST",
		body: JSON.stringify(task_to_row(Task, UserId))
	});
	return row_to_task(Rows[0]);
}

export async function update_task(Task) {
	const TaskId = encodeURIComponent(Task.id || Task.uid);
	const UserId = await get_authenticated_user_id();
	const ClientId = encodeURIComponent(UserId);
	const Rows = await supabase_request(`tasks?id=eq.${TaskId}&user_id=eq.${ClientId}`, {
		method: "PATCH",
		body: JSON.stringify(task_to_row(Task, UserId))
	});
	return row_to_task(Rows[0]);
}

export async function remove_task(Task) {
	const TaskId = encodeURIComponent(Task.id || Task.uid);
	const ClientId = encodeURIComponent(await get_authenticated_user_id());
	await supabase_request(`tasks?id=eq.${TaskId}&user_id=eq.${ClientId}`, {
		method: "DELETE"
	});
}

async function get_authenticated_user_id() {
	const User = await get_current_user();
	const UserId = User?.id;
	if (!UserId) throw new Error("Not logged in");
	return UserId;
}

function task_to_row(Task, UserId) {
	return {
		user_id: UserId,
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