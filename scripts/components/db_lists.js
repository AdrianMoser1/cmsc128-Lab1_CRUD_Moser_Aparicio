import { supabase_request } from "./db_connection.js";
import { get_current_session } from "./auth_connection.js";

/*
 * Data access for collaborative lists. Same rule as db_fetch.js: every call carries the
 * user's JWT so the database decides what they may see. The client never has to be trusted.
 */
async function get_auth_context() {
	const Session = await get_current_session();
	if (!Session?.user?.id) throw new Error("You must be signed in.");
	return { AccountId: Session.user.id, Token: Session.access_token };
}

const enc = encodeURIComponent;

// Every list I own OR was added to. RLS (lists_select) already filters this, so a list
// I wasn't added to simply never appears: "Nikko can't see Victor's Group List".
export async function fetch_lists() {
	const { Token } = await get_auth_context();
	return supabase_request("lists?select=id,name,owner_id,created_at&order=created_at.asc", {}, Token);
}

export async function create_list(Name) {
	const { AccountId, Token } = await get_auth_context();
	const Rows = await supabase_request("lists", {
		method: "POST",
		body: JSON.stringify({ name: Name.trim(), owner_id: AccountId })
	}, Token);
	return Rows[0];
}

// Owner only (RLS). Tasks in the list are removed by the ON DELETE CASCADE foreign key.
export async function delete_list(ListId) {
	const { Token } = await get_auth_context();
	const Rows = await supabase_request(`lists?id=eq.${enc(ListId)}`, { method: "DELETE" }, Token);
	if (!Rows?.length) throw new Error("List not found or you are not its owner.");
}

// Owner only. Lookup by username/email happens inside the database function so the client
// never gets to enumerate other users' profiles.
export async function add_list_member(ListId, Identifier) {
	const { Token } = await get_auth_context();
	await supabase_request("rpc/add_list_member", {
		method: "POST",
		body: JSON.stringify({ p_list_id: ListId, p_identifier: Identifier })
	}, Token);
}

// -> [{ user_id, display_name, is_owner }]
export async function fetch_list_members(ListId) {
	const { Token } = await get_auth_context();
	return supabase_request("rpc/get_list_members", {
		method: "POST",
		body: JSON.stringify({ p_list_id: ListId })
	}, Token);
}

// The owner removes anyone; a member can remove only themselves (leave the list).
export async function remove_list_member(ListId, UserId) {
	const { Token } = await get_auth_context();
	await supabase_request(`list_members?list_id=eq.${enc(ListId)}&user_id=eq.${enc(UserId)}`,
		{ method: "DELETE" }, Token);
}
