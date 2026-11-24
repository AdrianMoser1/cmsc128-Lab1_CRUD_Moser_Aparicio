import { update_task } from "../dependencies/db_fetch.js";
import { delete_tasks } from "./delete_task.js";
import { render_task_completion } from "./task_shortview.js";
import { refresh_task_view } from "./task_tally.js";
import { show_toast } from "./toast.js";

export function setup_bulk_actions() {
	const TaskList = document.getElementById("taskList");
	const SelectVisible = document.getElementById("selectVisibleTasks");
	const SelectedCount = document.getElementById("selectedTaskCount");
	const CompleteButton = document.getElementById("completeSelectedBtn");
	const DeleteButton = document.getElementById("deleteSelectedBtn");
	const Actions = document.getElementById("bulkActions");
	let Updating = false;

	const selected_cards = () => [...TaskList.querySelectorAll(".task-select:checked")]
		.map((Checkbox) => Checkbox.closest(".task-card"));

	function update_toolbar() {
		const VisibleCheckboxes = [...TaskList.querySelectorAll(".task-card:not([hidden]) .task-select")];
		const SelectedCards = selected_cards();
		SelectVisible.disabled = TaskList.inert || !VisibleCheckboxes.length || Updating;
		SelectVisible.checked = VisibleCheckboxes.length > 0 &&
			VisibleCheckboxes.every((Checkbox) => Checkbox.checked);
		SelectVisible.indeterminate = VisibleCheckboxes.some((Checkbox) => Checkbox.checked) &&
			!SelectVisible.checked;
		SelectedCount.textContent = `${SelectedCards.length} selected`;
		SelectedCount.hidden = !SelectedCards.length;
		Actions.hidden = !SelectedCards.length;
		const HasBusyTask = SelectedCards.some((Card) => Card.hasAttribute("aria-busy"));
		CompleteButton.disabled = Updating || HasBusyTask || !SelectedCards.length ||
			SelectedCards.every((Card) => Card.taskData.completed);
		DeleteButton.disabled = Updating || HasBusyTask || !SelectedCards.length;
	}

	function clear_selection() {
		TaskList.querySelectorAll(".task-select:checked").forEach((Checkbox) => {
			Checkbox.checked = false;
		});
		update_toolbar();
	}

	function set_card_busy(Card, Busy) {
		if (Busy) Card.setAttribute("aria-busy", "true");
		else Card.removeAttribute("aria-busy");
		Card.querySelectorAll("button, input").forEach((Control) => {
			Control.disabled = Busy;
		});
	}

	SelectVisible.addEventListener("change", () => {
		TaskList.querySelectorAll(".task-card:not([hidden]) .task-select").forEach((Checkbox) => {
			Checkbox.checked = SelectVisible.checked;
		});
		update_toolbar();
	});

	TaskList.addEventListener("change", (Event) => {
		if (Event.target.matches(".task-select")) update_toolbar();
	});
	TaskList.addEventListener("taskviewchange", update_toolbar);
	TaskList.addEventListener("tasklistloading", clear_selection);

	for (const Id of ["filterTag", "showCompleted"]) {
		document.getElementById(Id).addEventListener("change", clear_selection);
	}

	CompleteButton.addEventListener("click", async () => {
		const Cards = selected_cards();
		const Tasks = Cards.map((Card) => Card.taskData).filter((Task) => !Task.completed);
		if (!Tasks.length || Updating) return;

		Updating = true;
		Cards.forEach((Card) => set_card_busy(Card, true));
		CompleteButton.setAttribute("aria-busy", "true");
		CompleteButton.textContent = "Completing...";
		update_toolbar();

		const Results = await Promise.allSettled(Tasks.map((Task) =>
			update_task(Task, { completed: true })
		));
		let Completed = 0;
		let Failed = 0;
		Results.forEach((Result, Index) => {
			const Task = Tasks[Index];
			if (Result.status === "fulfilled") {
				Task.completed = true;
				render_task_completion(Task);
				Task.shortview.querySelector(".task-select").checked = false;
				Completed += 1;
				return;
			}
			console.error(`Could not complete task "${Task.title}":`, Result.reason);
			Failed += 1;
		});

		Cards.forEach((Card) => set_card_busy(Card, false));
		Updating = false;
		CompleteButton.removeAttribute("aria-busy");
		CompleteButton.textContent = "Complete selected";
		refresh_task_view();

		if (Failed) {
			const SuccessMessage = Completed
				? `${Completed} task${Completed === 1 ? "" : "s"} completed; `
				: "";
			show_toast(`${SuccessMessage}${Failed} task${Failed === 1 ? "" : "s"} could not be completed.`, "error");
		} else {
			show_toast(`${Completed} task${Completed === 1 ? "" : "s"} completed.`);
		}
	});

	DeleteButton.addEventListener("click", async () => {
		if (Updating) return;
		const Tasks = selected_cards().map((Card) => Card.taskData);
		await delete_tasks(Tasks);
		update_toolbar();
	});

	update_toolbar();
}
