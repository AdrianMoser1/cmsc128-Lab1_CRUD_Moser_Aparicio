import { set_active_list_id } from "../dependencies/active_list.js";
import {
	fetch_lists, create_list, delete_list,
	add_list_member, fetch_list_members, remove_list_member
} from "../dependencies/db_lists.js";

const PERSONAL = "personal"; // <option> value for the Personal list (stored as list_id = null)

/*
 * Wires up the Personal / Collaborative list bar.
 *
 *   UserId        - the signed-in account id (used to tell "my lists" from "shared with me")
 *   OnListChange  - called after the visible list changes so the page can reload its tasks
 *
 * SECURITY NOTE: every string that comes from other users (list names, display names) is
 * inserted with textContent / new Option(), never innerHTML, so a member who sets their
 * display name to "<img onerror=...>" cannot run script in someone else's browser (XSS).
 */
export async function setup_list_switcher(UserId, OnListChange) {
	const Select = document.getElementById("listSelect");
	const NewListBtn = document.getElementById("newListBtn");
	const ManageBtn = document.getElementById("manageListBtn");
	const Dialog = document.getElementById("listDialog");
	// Remembered per account, so user B logging in on the same browser never inherits A's list.
	const StorageKey = `todo_aoi_active_list:${UserId}`;

	let Lists = [];

	// ---- small DOM helper -------------------------------------------------
	function el(Tag, Text = "", ClassName = "") {
		const Node = document.createElement(Tag);
		if (Text) Node.textContent = Text;
		if (ClassName) Node.className = ClassName;
		return Node;
	}

	function find_list(Id) {
		return Lists.find((List) => List.id === Id) || null;
	}

	// ---- selection ---------------------------------------------------------
	// Rebuilds the dropdown from the server's answer. RLS guarantees `Lists` only contains
	// lists I own or was added to.
	function render_options(SelectedValue) {
		Select.replaceChildren(new Option("Personal", PERSONAL));

		const Owned = Lists.filter((List) => List.owner_id === UserId);
		const Shared = Lists.filter((List) => List.owner_id !== UserId);
		for (const [Label, Group] of [["My collaborative lists", Owned], ["Shared with me", Shared]]) {
			if (!Group.length) continue;
			const OptGroup = document.createElement("optgroup");
			OptGroup.label = Label;
			Group.forEach((List) => OptGroup.appendChild(new Option(List.name, List.id)));
			Select.appendChild(OptGroup);
		}
		Select.value = SelectedValue;
	}

	// Applies a selection to the app state. Falls back to Personal if the id no longer
	// exists (list deleted, or I was removed from it).
	function apply_selection(Value) {
		const Valid = Value !== PERSONAL && find_list(Value) ? Value : PERSONAL;
		Select.value = Valid;
		set_active_list_id(Valid === PERSONAL ? null : Valid);
		ManageBtn.hidden = Valid === PERSONAL; // Personal has no members to manage
		try { localStorage.setItem(StorageKey, Valid); } catch { /* storage blocked: not critical */ }
		return Valid;
	}

	async function reload_lists(PreferredValue) {
		try {
			Lists = await fetch_lists();
		} catch (Error) {
			// e.g. migration not run yet: degrade to Personal-only instead of breaking the page
			console.error("Could not load lists:", Error);
			Lists = [];
		}
		let Saved = null;
		try { Saved = localStorage.getItem(StorageKey); } catch { /* ignore */ }
		const Wanted = PreferredValue ?? Saved ?? PERSONAL;
		render_options(PERSONAL);
		return apply_selection(Wanted);
	}

	// ---- dialog ------------------------------------------------------------
	async function open_dialog(Title, Build) {
		Dialog.replaceChildren(el("h2", Title));
		const ErrorBox = el("p", "", "field-error dialog-error");
		ErrorBox.setAttribute("role", "alert");
		ErrorBox.hidden = true;
		const show_error = (Message) => {
			ErrorBox.textContent = Message || "";
			ErrorBox.hidden = !Message;
		};
		await Build(Dialog, show_error);
		Dialog.append(ErrorBox);

		const Actions = el("div", "", "dialog-actions");
		const CloseBtn = el("button", "Close", "btn btn-ghost");
		CloseBtn.type = "button";
		CloseBtn.addEventListener("click", () => Dialog.close());
		Actions.append(CloseBtn);
		Dialog.append(Actions);
		Dialog.showModal();
	}

	// ---- create a list -----------------------------------------------------
	NewListBtn.addEventListener("click", () => {
		open_dialog("New collaborative list", (Root, show_error) => {
			const Form = el("form", "", "list-form");
			const Input = el("input");
			Input.type = "text";
			Input.maxLength = 60;
			Input.placeholder = "e.g. Group project";
			Input.required = true;
			Input.setAttribute("aria-label", "List name");
			const Submit = el("button", "Create", "btn btn-primary");
			Submit.type = "submit";
			Form.append(Input, Submit);

			Form.addEventListener("submit", async (Event) => {
				Event.preventDefault();
				if (!Input.value.trim()) return show_error("Give your list a name.");
				Submit.disabled = true;
				try {
					const Created = await create_list(Input.value);
					Dialog.close();
					await reload_lists(Created.id);
					OnListChange();
				} catch (Error) {
					console.error(Error);
					show_error(Error.userMessage || "Could not create the list.");
					Submit.disabled = false;
				}
			});
			Root.append(Form);
		});
	});

	// ---- manage members ----------------------------------------------------
	ManageBtn.addEventListener("click", async () => {
		const List = find_list(Select.value);
		if (!List) return;
		const IsOwner = List.owner_id === UserId;

		open_dialog(`${List.name}: members`, async (Root, show_error) => {
			const MemberList = el("ul", "", "member-list");
			Root.append(MemberList);

			async function render_members() {
				try {
					const Members = await fetch_list_members(List.id);
					MemberList.replaceChildren();
					for (const Member of Members) {
						const Row = el("li");
						Row.append(el("span", Member.display_name));
						if (Member.is_owner) Row.append(el("span", "Owner", "member-badge"));
						// Owner can remove others; the owner row itself is never removable.
						if (IsOwner && !Member.is_owner) {
							const Remove = el("button", "Remove", "btn btn-ghost btn-small");
							Remove.type = "button";
							Remove.addEventListener("click", async () => {
								try {
									await remove_list_member(List.id, Member.user_id);
									await render_members();
								} catch (Error) { show_error(Error.userMessage || "Could not remove member."); }
							});
							Row.append(Remove);
						}
						MemberList.append(Row);
					}
				} catch (Error) {
					show_error(Error.userMessage || "Could not load members.");
				}
			}
			await render_members();

			if (IsOwner) {
				// Add by username or email (resolved server-side, see add_list_member in the SQL).
				const Form = el("form", "", "list-form");
				const Input = el("input");
				Input.type = "text";
				Input.placeholder = "Username or email";
				Input.required = true;
				Input.setAttribute("aria-label", "Username or email");
				const Add = el("button", "Add member", "btn btn-primary");
				Add.type = "submit";
				Form.append(Input, Add);
				Form.addEventListener("submit", async (Event) => {
					Event.preventDefault();
					show_error("");
					try {
						await add_list_member(List.id, Input.value);
						Input.value = "";
						await render_members();
					} catch (Error) {
						show_error(Error.userMessage || "Could not add that user.");
					}
				});
				Root.append(Form);

				const Delete = el("button", "Delete this list", "btn btn-danger");
				Delete.type = "button";
				Delete.addEventListener("click", async () => {
					if (!confirm(`Delete "${List.name}" and all of its tasks for everyone?`)) return;
					try {
						await delete_list(List.id);
						Dialog.close();
						await reload_lists(PERSONAL);
						OnListChange();
					} catch (Error) { show_error(Error.userMessage || Error.message); }
				});
				Root.append(Delete);
			} else {
				// A member can leave (RLS lets a user delete only THEIR OWN membership row).
				const Leave = el("button", "Leave this list", "btn btn-danger");
				Leave.type = "button";
				Leave.addEventListener("click", async () => {
					if (!confirm(`Leave "${List.name}"?`)) return;
					try {
						await remove_list_member(List.id, UserId);
						Dialog.close();
						await reload_lists(PERSONAL);
						OnListChange();
					} catch (Error) { show_error(Error.userMessage || "Could not leave the list."); }
				});
				Root.append(Leave);
			}
		});
	});

	// ---- switching ---------------------------------------------------------
	Select.addEventListener("change", () => {
		apply_selection(Select.value);
		OnListChange();
	});

	// Initial load. Does NOT call OnListChange: script.js loads the first batch of tasks itself.
	await reload_lists();
	Select.value = Select.value || PERSONAL;
}
