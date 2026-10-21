import { supabase_request } from "./db_connection.js";
import { get_current_user } from "./auth_connection.js";
import { get_active_list_id } from "../components/active_list.js";

/*
 *   Personal list      -> list_id IS NULL AND user_id = me
 *   Collaborative list -> list_id = <active list>  (RLS only returns rows if I'm a member)
 */
export async function fetch_tasks() {
	const UserId = await get_authenticated_user_id();
	const ListId = get_active_list_id();
	const Scope = ListId
		? `list_id=eq.${encodeURIComponent(ListId)}`
		: `list_id=is.null&user_id=eq.${encodeURIComponent(UserId)}`;
	const Rows = await supabase_request(`tasks?select=*&${Scope}&order=created_at.asc`);
	return Rows.map(row_to_task);
}

export async function insert_task(Task) {
	const UserId = await get_authenticated_user_id();
	const Rows = await supabase_request("tasks", {
		method: "POST",
		// user_id = who created it; list_id = the list currently open (null = Personal)
		body: JSON.stringify({ ...task_to_row(Task), user_id: UserId, list_id: get_active_list_id() })
	});
	return row_to_task(Rows[0]);
}

// Filters by task id only: in a shared list the editor is not the creator, so a
// user_id filter would wrongly block members. RLS decides who may touch the row.
// user_id / list_id are deliberately NOT in the PATCH body, so editing never changes ownership.
export async function update_task(Task) {
	const TaskId = encodeURIComponent(Task.id || Task.uid);
	const Rows = await supabase_request(`tasks?id=eq.${TaskId}`, {
		method: "PATCH",
		body: JSON.stringify(task_to_row(Task))
	});
	if (!Rows?.length) throw new Error("Task not found or you no longer have access to it.");
	return row_to_task(Rows[0]);
}

export async function remove_task(Task) {
	const TaskId = encodeURIComponent(Task.id || Task.uid);
	const Rows = await supabase_request(`tasks?id=eq.${TaskId}`, { method: "DELETE" });
	if (!Rows?.length) throw new Error("Task not found or you no longer have access to it.");
}

async function get_authenticated_user_id() {
	const User = await get_current_user();
	const UserId = User?.id;
	if (!UserId) throw new Error("Not logged in");
	return UserId;
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
		list_id: Row.list_id || null,
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