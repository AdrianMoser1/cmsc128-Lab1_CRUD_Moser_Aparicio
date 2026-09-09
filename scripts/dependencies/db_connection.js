const SupabaseUrl = "https://nsehnepbiqpwnxmosxvq.supabase.co";
const SupabaseKey = "sb_publishable_DULbfqw0xns8j7OTgJT5og_NwnFEYpq";
const ClientIdKey = "todo_aoi_client_id";
let MemoryClientId = null;

export function get_client_id() {
	try {
		let ClientId = localStorage.getItem(ClientIdKey);
		if (!ClientId) {
			ClientId = create_client_id();
			localStorage.setItem(ClientIdKey, ClientId);
		}
		return ClientId;
	} catch {
		if (!MemoryClientId) MemoryClientId = create_client_id();
		return MemoryClientId;
	}
}

function create_client_id() {
	if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
	return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function supabase_request(Path, Options = {}) {
	const Response = await fetch(`${SupabaseUrl}/rest/v1/${Path}`, {
		...Options,
		headers: {
			apikey: SupabaseKey,
			Authorization: `Bearer ${SupabaseKey}`,
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