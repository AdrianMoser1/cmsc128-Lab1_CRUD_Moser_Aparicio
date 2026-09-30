import { supabase } from "../dependencies/auth_connection.js";

export function setup_account_form(User) {
	const Form = document.getElementById("accountForm");
	const ErrorBox = document.getElementById("accountError");
	const SuccessBox = document.getElementById("accountSuccess");
	const SubmitButton = Form.querySelector("button[type='submit']");
	const Metadata = User.user_metadata || {};

	document.getElementById("accountDisplayName").value = Metadata.display_name || "";
	document.getElementById("accountEmail").value = User.email || "";
	setup_change_button("changeDisplayNameBtn", "accountDisplayName");
	setup_change_button("changeEmailBtn", "accountEmail");

	Form.addEventListener("submit", async (Event) => {
		Event.preventDefault();
		clear_feedback(ErrorBox, SuccessBox);

		const DisplayName = document.getElementById("accountDisplayName").value.trim();
		const Email = document.getElementById("accountEmail").value.trim();
		const ValidationError = validate_account_input(DisplayName, Email);

		if (ValidationError) {
			show_error(ErrorBox, ValidationError);
			return;
		}

		const Updates = {
			email: Email,
			data: { display_name: DisplayName }
		};

		set_loading(SubmitButton, true);
		try {
			const { error } = await supabase.auth.updateUser(Updates);
			if (error) {
				show_error(ErrorBox, friendly_account_error(error));
				return;
			}

			show_success(SuccessBox, "Account settings updated.");
		} catch (Error) {
			console.error(Error);
			show_error(ErrorBox, "Could not update your account. Check your connection and try again.");
		} finally {
			set_loading(SubmitButton, false);
		}
	});
}

function setup_change_button(ButtonId, InputId) {
	const Button = document.getElementById(ButtonId);
	const Input = document.getElementById(InputId);
	Button.addEventListener("click", () => {
		Input.disabled = false;
		Button.hidden = true;
		Input.focus();
	});
}

function validate_account_input(DisplayName, Email) {
	if (!DisplayName) return "Please enter a display name.";
	if (!Email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(Email)) return "Please enter a valid email address.";
	return null;
}

function friendly_account_error(Error) {
	const Message = (Error.message || "").toLowerCase();
	if (Message.includes("email") && (Message.includes("already") || Message.includes("exist") || Message.includes("unique"))) {
		return "That email is already in use. Please choose another email.";
	}
	if (Message.includes("password")) return Error.message;
	return "We could not update your account. Please check your details and try again.";
}

function set_loading(Button, IsLoading) {
	Button.disabled = IsLoading;
	Button.textContent = IsLoading ? "Saving..." : "Save changes";
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