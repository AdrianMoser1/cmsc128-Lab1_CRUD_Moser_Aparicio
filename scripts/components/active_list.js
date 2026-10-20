/*
 * Which list is the user looking at right now?
 *   null  -> their Personal list (tasks with list_id = NULL)
 *   uuid  -> a collaborative list
 *
 * Kept in one tiny module so db_fetch.js can scope every read/write to the visible list
 * WITHOUT add_task.js / task_popup.js having to pass a list id around.
 * This is UI state only. It is never trusted for security: the database (RLS) re-checks
 * list membership on every request, so a tampered value just gets an empty/denied result.
 */
let ActiveListId = null;

export function get_active_list_id() {
	return ActiveListId;
}

export function set_active_list_id(ListId) {
	ActiveListId = ListId || null;
}
