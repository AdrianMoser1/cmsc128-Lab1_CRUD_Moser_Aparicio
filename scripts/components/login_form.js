// Purpose: checks the input, asks Supabase Auth to verify the credentials,
// and on success sends the user into the app.
// Flow of work:
//   1. The email + password are sent once, over HTTPS, to supabase.auth.signInWithPassword().
//   2. Supabase compares the password against the stored bcrypt hash SERVER-side. This file
//      never sees or compares a hash, and never stores the raw password anywhere.
//   3. On success Supabase returns a session (short-lived access JWT + long-lived refresh
//      token). supabase-js saves it to localStorage automatically (persistSession in
//      auth_connection.js), which is what lets a refresh or restart keep the user logged in.
//   4. We then redirect. Protected pages read that stored session via require_auth_or_redirect().

import { supabase, POST_LOGIN_PAGE } from "../dependencies/auth_connection.js";

/**
 * Wires up #loginForm (fields: email, password; feedback element: #loginError).
 * Call once on page load.
 */
export function setup_login_form() {
	const Form = document.getElementById("loginForm");
	const ErrorBox = document.getElementById("loginError");
	const SuccessBox = document.getElementById("loginSuccess");
	const SubmitButton = Form.querySelector("button[type='submit']");

	Form.addEventListener("submit", async (Event) => {
		Event.preventDefault(); // handle submission ourselves so errors show inline without a page reload
		clear_feedback(ErrorBox, SuccessBox);

		const Fields = new FormData(Form);
		const Email = Fields.get("email").trim();
		const Password = Fields.get("password");

		// Only check that something was entered. We deliberately do NOT re-apply signup's
		// length/format rules here: telling an attacker "that password is too short" would
		// leak our password policy, and legacy accounts may predate a stricter policy.
		if (!Email || !Password) {
			show_error(ErrorBox, "Please enter your email and password.");
			return;
		}

		set_loading(SubmitButton, true);
		try {
			const { error } = await supabase.auth.signInWithPassword({ email: Email, password: Password });

			if (error) {
				show_error(ErrorBox, friendly_login_error(error));
				return;
			}

			// replace() instead of assign() so the login page is not left in history --
			// otherwise "back" from the app would land on a login form while logged in.
			window.location.replace(POST_LOGIN_PAGE);
		} catch (Error) {
			// Network-level failures (offline, blocked request) throw instead of returning `error`.
			console.error(Error);
			show_error(ErrorBox, "Could not reach the server. Check your internet connection and try again.");
		} finally {
			// Runs on the error paths too. On success the page is already navigating away,
			// so re-enabling the button is harmless.
			set_loading(SubmitButton, false);
		}
	});

}

// Maps Supabase's error into a message the user can act on.
// Wrong email and wrong password get the SAME message on purpose: distinguishing them
// ("no such account" vs "wrong password") would let an attacker discover which emails
// are registered (account enumeration).
function friendly_login_error(Error) {
	const Code = Error.code || "";
	const Message = (Error.message || "").toLowerCase();

	if (Code === "email_not_confirmed" || Message.includes("email not confirmed")) {
		return "Please confirm your email first. Check your inbox for the confirmation link.";
	}
	if (Code === "over_request_rate_limit" || Message.includes("rate limit")) {
		return "Too many attempts. Please wait a moment and try again.";
	}
	return "Incorrect email or password.";
}

function set_loading(Button, IsLoading) {
	Button.disabled = IsLoading;
	Button.textContent = IsLoading ? "Logging in..." : "Log In";
}

function show_error(ErrorBox, Message) {
	ErrorBox.textContent = Message;
	ErrorBox.hidden = false;
}

function show_success(SuccessBox, Message) {
	SuccessBox.textContent = Message;
	SuccessBox.hidden = false;
}

function clear_feedback(ErrorBox, SuccessBox) {
	ErrorBox.hidden = true;
	SuccessBox.hidden = true;
}