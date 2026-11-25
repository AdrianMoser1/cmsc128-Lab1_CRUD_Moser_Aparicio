import { set_active_list_id } from "./active_list.js";
import {
	fetch_lists, create_list, delete_list,
	add_list_member, fetch_list_members, remove_list_member
} from "../dependencies/db_lists.js";
import { show_toast } from "./toast.js";
import { confirm_action } from "./confirm_action.js";

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
	const SharedIcon = document.getElementById("listSharedIcon");
	const PersonalIcon = document.getElementById("listPersonalIcon");
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

	function close_on_backdrop_click(TargetDialog, Event) {
		if (Event.target !== TargetDialog) return;
		const Bounds = TargetDialog.getBoundingClientRect();
		if (
			Event.clientX < Bounds.left || Event.clientX > Bounds.right ||
			Event.clientY < Bounds.top || Event.clientY > Bounds.bottom
		) TargetDialog.close();
	}

	// ---- selection ---------------------------------------------------------
	// Rebuilds the dropdown from the server's answer. RLS guarantees `Lists` only contains
	// lists I own or was added to.
	function render_options(SelectedValue) {
		Select.replaceChildren(new Option("Personal", PERSONAL));

		const Owned = Lists.filter((List) => List.owner_id === UserId);
		const Shared = Lists.filter((List) => List.owner_id !== UserId);
		for (const [Label, Group] of [["My created lists", Owned], ["Shared with me", Shared]]) {
			if (!Group.length) continue;
			const OptGroup = document.createElement("optgroup");
			OptGroup.label = Label;
			Group.forEach((List) => {
				OptGroup.appendChild(new Option(List.name, List.id));
			});
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
		PersonalIcon.hidden = Valid !== PERSONAL;
		SharedIcon.hidden = Valid === PERSONAL;
		try { localStorage.setItem(StorageKey, Valid); } catch { /* storage blocked: not critical */ }
		return Valid;
	}

	function notify_list_change() {
		document.getElementById("taskList").dispatchEvent(new Event("activelistchange"));
		OnListChange();
	}

	async function reload_lists(PreferredValue) {
		Select.disabled = true;
		Select.replaceChildren(new Option("Loading lists...", ""));
		try {
			Lists = await fetch_lists();
		} catch (Error) {
			// e.g. migration not run yet: degrade to Personal-only instead of breaking the page
			console.error("Could not load lists:", Error);
			show_toast("Collaborative lists could not be loaded. Your personal list is still available.", "error");
			Lists = [];
		}
		if (Lists.length) {
			Lists = await Promise.all(Lists.map(async (List) => {
				if (List.owner_id !== UserId) return { ...List, member_count: 2 };
				try {
					const Members = await fetch_list_members(List.id);
					return { ...List, member_count: Members.length };
				} catch (Error) {
					console.error(`Could not load members for list "${List.name}":`, Error);
					return { ...List, member_count: 0 };
				}
			}));
		}
		let Saved = null;
		try { Saved = localStorage.getItem(StorageKey); } catch { /* ignore */ }
		const Wanted = PreferredValue ?? Saved ?? PERSONAL;
		render_options(PERSONAL);
		const Selected = apply_selection(Wanted);
		Select.disabled = false;
		return Selected;
	}

	Dialog.addEventListener("click", (Event) => close_on_backdrop_click(Dialog, Event));

	function close_dialog_button() {
		const Button = el("button", "", "dialog-close");
		Button.type = "button";
		Button.setAttribute("aria-label", "Close dialog");
		Button.innerHTML = `
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
				<path d="m18 6-12 12M6 6l12 12"></path>
			</svg>
		`;
		return Button;
	}

	// ---- dialog ------------------------------------------------------------
	async function open_dialog(Title, Build) {
		const Heading = el("div", "", "dialog-heading");
		const HeadingTitle = el("h2", Title);
		HeadingTitle.id = "listDialogTitle";
		Heading.append(HeadingTitle);
		const CloseButton = close_dialog_button();
		CloseButton.addEventListener("click", () => Dialog.close());
		Heading.append(CloseButton);
		Dialog.setAttribute("aria-labelledby", HeadingTitle.id);
		Dialog.replaceChildren(Heading);
		const ErrorBox = el("p", "", "field-error dialog-error");
		ErrorBox.setAttribute("role", "alert");
		ErrorBox.hidden = true;
		const show_error = (Message) => {
			ErrorBox.textContent = Message || "";
			ErrorBox.hidden = !Message;
		};
		const BuildPromise = Build(Dialog, show_error);
		Dialog.append(ErrorBox);
		Dialog.showModal();
		await BuildPromise;
		Dialog.append(ErrorBox);
	}

	// ---- create a list -----------------------------------------------------
	NewListBtn.addEventListener("click", () => {
		open_dialog("Create a New List", (Root, show_error) => {
			Root.append(el(
				"p",
				"Your personal list is private to only you, but any new lists can have members added to share with.",
				"list-informer"
			));
			const Form = el("form", "", "list-form");
			const Label = el("label", "List name", "list-field-label");
			const Input = el("input");
			Input.id = "newListName";
			Input.type = "text";
			Input.maxLength = 60;
			Input.placeholder = "e.g. Group project";
			Input.required = true;
			Label.htmlFor = Input.id;
			const Submit = el("button", "Create", "btn btn-primary");
			Submit.type = "submit";
			Form.append(Label, Input, Submit);

			Form.addEventListener("submit", async (Event) => {
				Event.preventDefault();
				if (!Input.value.trim()) return show_error("Give your list a name.");
				Submit.disabled = true;
				Input.disabled = true;
				Submit.setAttribute("aria-busy", "true");
				Submit.textContent = "Creating...";
				try {
					const Created = await create_list(Input.value);
					Dialog.close();
					await reload_lists(Created.id);
					notify_list_change();
					show_toast("List created.");
				} catch (Error) {
					console.error(Error);
					show_error(Error.userMessage || "Could not create the list.");
					Submit.disabled = false;
					Input.disabled = false;
					Submit.removeAttribute("aria-busy");
					Submit.textContent = "Create";
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
			const Loading = el("p", "Loading members...", "list-informer");
			MemberList.setAttribute("aria-busy", "true");
			Root.append(Loading, MemberList);

			async function render_members() {
				try {
					const Members = await fetch_list_members(List.id);
					Loading.remove();
					MemberList.removeAttribute("aria-busy");
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
								Remove.disabled = true;
								Remove.setAttribute("aria-busy", "true");
								Remove.textContent = "Removing...";
								show_error("");
								try {
									await remove_list_member(List.id, Member.user_id);
									Row.remove();
								} catch (Error) {
									show_error(Error.userMessage || "Could not remove member.");
									Remove.disabled = false;
									Remove.removeAttribute("aria-busy");
									Remove.textContent = "Remove";
								}
							});
							Row.append(Remove);
						}
						MemberList.append(Row);
					}
				} catch (Error) {
					Loading.remove();
					MemberList.removeAttribute("aria-busy");
					show_error(Error.userMessage || "Could not load members.");
				}
			}
			await render_members();

			if (IsOwner) {
				// Add by username or email (resolved server-side, see add_list_member in the SQL).
				const Form = el("form", "", "list-form");
				const Label = el("label", "Member username or email", "list-field-label");
				const Input = el("input");
				Input.id = "memberIdentifier";
				Input.type = "text";
				Input.placeholder = "Username or email";
				Input.required = true;
				Label.htmlFor = Input.id;
				const Add = el("button", "Add member", "btn btn-primary");
				Add.type = "submit";
				Form.append(Label, Input, Add);
				Form.addEventListener("submit", async (Event) => {
					Event.preventDefault();
					show_error("");
					Add.disabled = true;
					Input.disabled = true;
					Add.setAttribute("aria-busy", "true");
					Add.textContent = "Adding...";
					try {
						await add_list_member(List.id, Input.value);
						Input.value = "";
						await render_members();
					} catch (Error) {
						show_error(Error.userMessage || "Could not add that user.");
					} finally {
						Add.disabled = false;
						Input.disabled = false;
						Add.removeAttribute("aria-busy");
						Add.textContent = "Add member";
					}
				});
				Root.append(Form);

				const Delete = el("button", "Delete this list", "btn btn-danger");
				Delete.type = "button";
				Delete.addEventListener("click", async () => {
					if (!await confirm_action(
						"Delete this list?",
						`Delete "${List.name}" and all of its tasks for everyone?`,
						"Delete list"
					)) return;
					Delete.disabled = true;
					Delete.setAttribute("aria-busy", "true");
					Delete.textContent = "Deleting...";
					try {
						await delete_list(List.id);
						document.getElementById("taskList").dispatchEvent(new CustomEvent("listdeleted", { detail: String(List.id) }));
						Dialog.close();
						await reload_lists(PERSONAL);
						notify_list_change();
						show_toast("List deleted.");
					} catch (Error) {
						show_error(Error.userMessage || "Could not delete the list. Please try again.");
						Delete.disabled = false;
						Delete.removeAttribute("aria-busy");
						Delete.textContent = "Delete this list";
					}
				});
				Root.append(Delete);
			} else {
				// A member can leave (RLS lets a user delete only THEIR OWN membership row).
				const Leave = el("button", "Leave this list", "btn btn-danger");
				Leave.type = "button";
				Leave.addEventListener("click", async () => {
					if (!await confirm_action(
						"Leave this list?",
						`Leave "${List.name}"?`,
						"Leave list"
					)) return;
					Leave.disabled = true;
					Leave.setAttribute("aria-busy", "true");
					Leave.textContent = "Leaving...";
					try {
						await remove_list_member(List.id, UserId);
						Dialog.close();
						await reload_lists(PERSONAL);
						notify_list_change();
						show_toast("You left the list.");
					} catch (Error) {
						show_error(Error.userMessage || "Could not leave the list.");
						Leave.disabled = false;
						Leave.removeAttribute("aria-busy");
						Leave.textContent = "Leave this list";
					}
				});
				Root.append(Leave);
			}
		});
	});

	// ---- switching ---------------------------------------------------------
	Select.addEventListener("change", () => {
		apply_selection(Select.value);
		notify_list_change();
	});

	// Initial load. Does NOT call OnListChange: script.js loads the first batch of tasks itself.
	await reload_lists();
	Select.value = Select.value || PERSONAL;
}
