export function confirm_action(TitleText, Message, ActionText) {
	const Dialog = document.getElementById("actionConfirmDialog");
	if (!Dialog) throw new Error("The confirmation dialog is missing.");
	if (Dialog.open) throw new Error("A confirmation is already open.");

	return new Promise((Resolve) => {
		const Heading = document.createElement("div");
		Heading.className = "dialog-heading";
		const Title = document.createElement("h2");
		Title.id = "actionConfirmTitle";
		Title.textContent = TitleText;

		const CloseButton = document.createElement("button");
		CloseButton.type = "button";
		CloseButton.className = "dialog-close";
		CloseButton.setAttribute("aria-label", "Close dialog");
		CloseButton.innerHTML = `
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
				<path d="m18 6-12 12M6 6l12 12"></path>
			</svg>
		`;
		Heading.append(Title, CloseButton);

		const Description = document.createElement("p");
		Description.id = "actionConfirmDescription";
		Description.append(Message);

		const Actions = document.createElement("div");
		Actions.className = "dialog-actions";
		const CancelButton = document.createElement("button");
		CancelButton.type = "button";
		CancelButton.className = "btn btn-ghost";
		CancelButton.textContent = "Cancel";
		CancelButton.autofocus = true;
		const ActionButton = document.createElement("button");
		ActionButton.type = "button";
		ActionButton.className = "btn btn-danger";
		ActionButton.textContent = ActionText;
		Actions.append(CancelButton, ActionButton);

		let Resolved = false;
		const Finish = (Confirmed) => {
			if (Resolved) return;
			Resolved = true;
			Dialog.removeEventListener("cancel", HandleCancel);
			Dialog.removeEventListener("close", HandleClose);
			Dialog.removeEventListener("click", HandleBackdrop);
			if (Dialog.open) Dialog.close();
			Resolve(Confirmed);
		};
		const HandleCancel = (Event) => {
			Event.preventDefault();
			Finish(false);
		};
		const HandleClose = () => Finish(false);
		const HandleBackdrop = (Event) => {
			if (Event.target !== Dialog) return;
			const Bounds = Dialog.getBoundingClientRect();
			if (
				Event.clientX < Bounds.left || Event.clientX > Bounds.right ||
				Event.clientY < Bounds.top || Event.clientY > Bounds.bottom
			) Finish(false);
		};

		Dialog.setAttribute("aria-labelledby", Title.id);
		Dialog.setAttribute("aria-describedby", Description.id);
		Dialog.replaceChildren(Heading, Description, Actions);
		CloseButton.addEventListener("click", () => Finish(false));
		CancelButton.addEventListener("click", () => Finish(false));
		ActionButton.addEventListener("click", () => Finish(true));
		Dialog.addEventListener("cancel", HandleCancel);
		Dialog.addEventListener("close", HandleClose);
		Dialog.addEventListener("click", HandleBackdrop);
		Dialog.showModal();
	});
}
