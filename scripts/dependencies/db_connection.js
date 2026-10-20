//export rather than just const so other modules(auth_connection.js) can reuse the exact key without duplication of copy
export const SupabaseUrl = "https://nsehnepbiqpwnxmosxvq.supabase.co";
export const SupabaseKey = "sb_publishable_DULbfqw0xns8j7OTgJT5og_NwnFEYpq";
export async function supabase_request(Path, Options = {}) {
	// Dynamic import: auth_connection.js already imports this file, so a static
	// import here would be circular. Loading it at call time avoids that.
	const { get_current_session } = await import("./auth_connection.js");
	const Session = await get_current_session();
	if (!Session) throw new Error("Not logged in");

	const Response = await fetch(`${SupabaseUrl}/rest/v1/${Path}`, {
		...Options,
		headers: {
			apikey: SupabaseKey,
			Authorization: `Bearer ${Session.access_token}`,
			"Content-Type": "application/json",
			Prefer: "return=representation",
			...Options.headers
		}
	});

	if (!Response.ok) {
		const ErrorText = await Response.text();
		throw new Error(`Supabase request failed (${Response.status}): ${ErrorText}`);
	}

	if (Response.status === 204) return null;
	return Response.json();
}