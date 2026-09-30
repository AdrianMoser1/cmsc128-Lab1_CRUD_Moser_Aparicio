export function setup_password_toggle() {
	const ToggleButtons = document.querySelectorAll("[data-toggle-password]");

	ToggleButtons.forEach((Button) => {
		const Input = Button.closest(".password-field")?.querySelector("input");
		if (!Input) return;

		const Icon = Button.querySelector("i");
		const update_button_state = () => {
			const IsVisible = Input.type === "text";
			Button.setAttribute("aria-label", IsVisible ? "Hide password" : "Show password");
			Button.title = IsVisible ? "Hide password" : "Show password";
			if (Icon) {
				Icon.classList.toggle("fa-eye", !IsVisible);
				Icon.classList.toggle("fa-eye-slash", IsVisible);
			}
		};

		Button.addEventListener("click", () => {
			Input.type = Input.type === "password" ? "text" : "password";
			update_button_state();
			Input.focus();
		});

		update_button_state();
	});
}
