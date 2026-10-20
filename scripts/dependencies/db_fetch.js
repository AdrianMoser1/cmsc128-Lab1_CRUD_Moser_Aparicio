import { supabase_request } from "./db_connection.js";
import { get_current_session } from "./auth_connection.js";
import { get_active_list_id } from "./active_list.js";

/*
 * Who is asking? Returns the account id and the JWT for this request.
 * The JWT is what lets Row-Level Security identify the user (see db_connection.js).
 */
async function get_auth_context() {
	const Session = await get_current_session();
	if (!Session?.user?.id) throw new Error("You must be signed in to access tasks.");
	return { AccountId: Session.user.id, Token: Session.access_token };
}

/*
 * Query-string filter that limits a request to the visible list.
 *   - Personal list: rows with no list AND created by me.
 *   - Collaborative list: rows of that list (RLS additionally requires I am owner/member).
 * This is defense-in-depth. RLS in the database is the real enforcement.
 */
function scope_filter(ListId, AccountId) {
	return ListId
		? `list_id=eq.${encodeURIComponent(ListId)}`
		: `list_id=is.null&client_id=eq.${encodeURIComponent(AccountId)}`;
}

// A task remembers which list it came from (undo re-inserts into the original list);
// otherwise fall back to the list currently on screen.
function list_of(Task) {
	return Task.list_id !== undefined ? Task.list_id : get_active_list_id();
}

export async function fetch_tasks(ListId = get_active_list_id()) {
	const { AccountId, Token } = await get_auth_context();
	const Rows = await supabase_request(
		`tasks?select=*&${scope_filter(ListId, AccountId)}&order=created_at.asc`, {}, Token
	);
	return Rows.map(row_to_task);
}

export async function insert_task(Task) {
	const { AccountId, Token } = await get_auth_context();
	const Rows = await supabase_request("tasks", {
		method: "POST",
		body: JSON.stringify({
			...task_to_row(Task),
			client_id: AccountId,        // the creator; RLS rejects any id that isn't mine
			list_id: list_of(Task)       // null = personal; RLS rejects lists I can't access
		})
	}, Token);
	return row_to_task(Rows[0]);
}

export async function update_task(Task) {
	const { AccountId, Token } = await get_auth_context();
	const TaskId = encodeURIComponent(Task.id || Task.uid);
	// Only content fields are sent. client_id / list_id are never rewritten on edit, otherwise
	// a collaborator editing a task would take over authorship (or move it to another list).
	const Rows = await supabase_request(
		`tasks?id=eq.${TaskId}&${scope_filter(list_of(Task), AccountId)}`,
		{ method: "PATCH", body: JSON.stringify(task_to_row(Task)) },
		Token
	);
	// RLS doesn't raise an error for rows you can't touch; it silently matches zero rows.
	// Treat that as "not found / not yours" so another user's task id fails safely (IDOR).
	if (!Rows?.length) throw new Error("Task not found or you do not have access to it.");
	return row_to_task(Rows[0]);
}

export async function remove_task(Task) {
	const { AccountId, Token } = await get_auth_context();
	const TaskId = encodeURIComponent(Task.id || Task.uid);
	const Rows = await supabase_request(
		`tasks?id=eq.${TaskId}&${scope_filter(list_of(Task), AccountId)}`,
		{ method: "DELETE" },
		Token
	);
	if (!Rows?.length) throw new Error("Task not found or you do not have access to it.");
}

// Content fields only (no ownership columns), shared by insert and update.
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
		list_id: Row.list_id ?? null,
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