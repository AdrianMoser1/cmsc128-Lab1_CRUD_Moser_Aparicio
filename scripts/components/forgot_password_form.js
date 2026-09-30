// components/forgot_password_form.js
//
// Handles the "request a reset link" step of password recovery.
//
// SECURITY NOTE: regardless of whether the email is actually registered, we show the
// exact same success message. If we said "no account found" for unknown emails, an
// attacker could feed in a list of addresses and learn which ones have accounts on
// this app (account enumeration) -- the same reasoning login_form.js already applies
// to its "Incorrect email or password" message.

import { supabase } from "../dependencies/auth_connection.js";

// Where Supabase should send the user after they click the emailed link. Supabase
// requires this exact URL to be present in the project's "Redirect URLs" allow-list
// (Authentication -> URL Configuration in the Supabase dashboard), otherwise the link
// is rejected -- worth checking there first if testing this locally.
const RESET_PASSWORD_REDIRECT = `${window.location.origin}/pages/reset-password.html`;

/**
 * Wires up #forgotPasswordForm (field: email; feedback element: #forgotPasswordStatus).
 * Call once on page load.
 */
export function setup_forgot_password_form() {
	const Form = document.getElementById("forgotPasswordForm");
	const StatusBox = document.getElementById("forgotPasswordStatus");
	const SubmitButton = Form.querySelector("button[type='submit']");

	Form.addEventListener("submit", async (Event) => {
		Event.preventDefault();
		hide_status(StatusBox);

		const Email = new FormData(Form).get("email").trim();
		if (!Email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(Email)) {
			show_status(StatusBox, "Please enter a valid email address.", "error");
			return;
		}

		set_loading(SubmitButton, true);
		try {
			// resetPasswordForEmail() itself never reveals whether the account exists --
			// it returns { error: null } either way for a well-formed email, by design.
			const { error } = await supabase.auth.resetPasswordForEmail(Email, {
				redirectTo: RESET_PASSWORD_REDIRECT
			});

			// A malformed request (rate limited, etc.) is the only case that legitimately
			// surfaces an error here; "email not found" is NOT one of them.
			if (error) {
				show_status(StatusBox, friendly_recovery_error(error), "error");
				return;
			}

			Form.reset();
			show_status(
				StatusBox,
				"If an account exists for that email, a password reset link has been sent. Check your inbox.",
				"success"
			);
		} catch (Error) {
			console.error(Error);
			show_status(StatusBox, "Could not reach the server. Check your internet connection and try again.", "error");
		} finally {
			set_loading(SubmitButton, false);
		}
	});
}

function friendly_recovery_error(Error) {
	const Message = (Error.message || "").toLowerCase();
	if (Message.includes("rate limit")) return "Too many requests. Please wait a moment and try again.";
	return "Something went wrong sending the reset link. Please try again.";
}

function set_loading(Button, IsLoading) {
	Button.disabled = IsLoading;
	Button.textContent = IsLoading ? "Sending..." : "Send reset link";
}

function show_status(StatusBox, Message, Kind) {
	StatusBox.textContent = Message;
	StatusBox.className = Kind === "success" ? "field-success" : "field-error";
	StatusBox.hidden = false;
}

function hide_status(StatusBox) {
	StatusBox.hidden = true;
}
