// Auth involves password hashing, so just utilize supabase auth client
// Session tokens, automatic token refresh, and persisting the session across page reloads
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SupabaseUrl, SupabaseKey } from "./db_connection.js";

/*
 * A single shared client instance. Every part of the app that needs auth
 * state: the signup form, login form, session guard, logout button. Imports this
 * same instance, so they all see the same in-memory + localStorage session rather than
 * each accidentally creating an independent instances.
 */
export const supabase = createClient(SupabaseUrl, SupabaseKey, {
	auth: {
		persistSession: true,     // keep the session in localStorage so a refresh doesn't log the user out
		autoRefreshToken: true,   // refreshes the token before expiration, so long sessions don't malfunction mid-use
		detectSessionInUrl: true  // required so email confirmation complete the sign-in
	}
});
/*
 * Returns the current logged-in user's session, or null if nobody is logged in.
 * Auth state checks centralized here so pages re-implement their own "am I already logged in?" logic.
 */
export async function get_current_session() {
	const { data, error } = await supabase.auth.getSession();
	if (error) {
		console.error("Failed to read auth session:", error);
		return null;
	}
	return data.session;
}

/**
 * Guard for pages that require a logged-in user (e.g. the task dashboard).
 * Redirects to the login page if there is no active session.
 */
export async function require_auth_or_redirect(LoginPage = "login.html") {
	const Session = await get_current_session();
	if (!Session) {
		window.location.replace(LoginPage);
		return null;
	}
	return Session;
}
