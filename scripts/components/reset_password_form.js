import { supabase } from "../dependencies/auth_connection.js";

const MIN_PASSWORD_LENGTH = 8;

export function setup_reset_password_form() {
	const Form = document.getElementById("resetPasswordForm");
	const ErrorBox = document.getElementById("resetPasswordError");
	const SubmitButton = Form.querySelector("button[type='submit']");

	Form.addEventListener("submit", async (Event) => {
		Event.preventDefault();
		clear_feedback(ErrorBox);

		const Password = Form.password.value;
		const ConfirmPassword = Form.confirm_password.value;
		const ValidationError = validate_reset_input(Password, ConfirmPassword);

		if (ValidationError) {
			show_error(ErrorBox, ValidationError);
			return;
		}

		set_loading(SubmitButton, true);
		try {
			const { error } = await supabase.auth.updateUser({ password: Password });
			if (error) {
				show_error(ErrorBox, friendly_reset_error(error));
				return;
			}

			window.location.replace("login.html?reset=success");
		} catch (Error) {
			console.error(Error);
			show_error(ErrorBox, "Could not update your password. Check your connection and try again.");
		} finally {
			set_loading(SubmitButton, false);
		}
	});
}

function validate_reset_input(Password, ConfirmPassword) {
	if (!Password || Password.length < MIN_PASSWORD_LENGTH) {
		return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
	}
	if (Password !== ConfirmPassword) return "Passwords do not match.";
	return null;
}

function friendly_reset_error(Error) {
	const Message = (Error.message || "").toLowerCase();
	if (Message.includes("expired") || Message.includes("token")) {
		return "This reset link has expired or is invalid. Request a new one.";
	}
	if (Message.includes("password")) return Error.message;
	return "We couldn't update your password. Please try again.";
}

function set_loading(Button, IsLoading) {
	Button.disabled = IsLoading;
	Button.textContent = IsLoading ? "Updating..." : "Set new password";
}

function show_error(ErrorBox, Message) {
	ErrorBox.textContent = Message;
	ErrorBox.hidden = false;
}

function clear_feedback(ErrorBox) {
	ErrorBox.hidden = true;
}
