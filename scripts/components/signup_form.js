// components/signup_form.js
//
// Handles the Sign Up page: client-side validation for fast feedback, then hands the
// email/password/display name off to Supabase Auth to actually create the account.
//
// This file never hashes, stores, or logs the raw password itself.
// Supabase is the one that hashes it (bcrypt) server-side before it ever touches a database row.

import { supabase } from "../dependencies/auth_connection.js";

// Same with Supabase's default minimum password length
// Reject an obviously-too-short password instantly, without a back and forth trip to the server.
const MIN_PASSWORD_LENGTH = 8;

/**
 * Wires up the #signupForm element (expected markup: display_name, email, password,
 * confirm_password fields, plus #signupError/#signupSuccess feedback elements).
 * Call this once on page load.
 */
export function setup_signup_form() {
	const Form = document.getElementById("signupForm");
	const ErrorBox = document.getElementById("signupError");
	const SuccessBox = document.getElementById("signupSuccess");
	const SubmitButton = Form.querySelector("button[type='submit']");

	Form.addEventListener("submit", async (Event) => { 
		Event.preventDefault(); // we handle submission ourselves so we can show inline feedback instead of a full page reload
		clear_feedback(ErrorBox, SuccessBox);

		const Fields = new FormData(Form);
		const DisplayName = Fields.get("display_name").trim();
		const Email = Fields.get("email").trim();
		const Password = Fields.get("password");
		const ConfirmPassword = Fields.get("confirm_password");

		const ValidationError = validate_signup_input(DisplayName, Email, Password, ConfirmPassword);
		if (ValidationError) {
			show_error(ErrorBox, ValidationError);
			return;
		}

		set_loading(SubmitButton, true);
		try {
			// display_name is stored in Supabase's built-in user_metadata, so the
			// account and its display name live together without needing a separate "profiles"
			const { data, error } = await supabase.auth.signUp({
				email: Email,
				password: Password,
				options: {
					data: { display_name: DisplayName }
				}
			});

			if (error) {
				show_error(ErrorBox, friendly_signup_error(error));
				return;
			}

			// Supabase deliberately does not reveal whether an email is already registered.
			const IsAlreadyRegistered = data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;
			if (IsAlreadyRegistered) {
				show_error(ErrorBox, "An account with that email already exists. Try logging in instead.");
				return;
			}

			Form.reset();
			show_success(SuccessBox, "Account created! Check your email to confirm your address, then log in.");
		} catch (Error) {
			// error handling for Network failures land here rather than the `error` which clarifies the cause issue
			console.error(Error);
			show_error(ErrorBox, "Something went wrong creating your account. Please try again.");
		} finally {
			set_loading(SubmitButton, false);
		}
	});
}

// Validates the registration form before touching the network.
// Returns a user-facing error message, or null when the input looks valid.
function validate_signup_input(DisplayName, Email, Password, ConfirmPassword) {
	if (!DisplayName) return "Please enter a display name.";
	if (!Email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(Email)) return "Please enter a valid email address.";
	if (!Password || Password.length < MIN_PASSWORD_LENGTH) {
		return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
	}
	if (Password !== ConfirmPassword) return "Passwords do not match.";
	return null;
}

// Turns a raw Supabase error into a message a user can act on, without echoing back
// internal implementation details.
function friendly_signup_error(Error) {
	const Message = Error.message || "";
	if (Message.toLowerCase().includes("password")) return Message; // Supabase's password-policy messages are already user-friendly
	if (Message.toLowerCase().includes("email")) return "Please enter a valid, deliverable email address.";
	return "We couldn't create your account. Please check your details and try again.";
}

function set_loading(Button, IsLoading) {
	Button.disabled = IsLoading;
	Button.textContent = IsLoading ? "Creating account..." : "Sign Up";
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
