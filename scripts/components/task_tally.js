export function render_task_tally() {
	const Tally = document.getElementById("taskTally");
	if (!Tally) return;

	const Tasks = [...document.querySelectorAll(".task-card")].filter((TaskCard) =>
		!TaskCard.hidden && TaskCard.dataset.completed !== "true"
	);
	const CountBy = (Attribute, Value) => Tasks.filter((TaskCard) =>
		TaskCard.querySelector(Attribute)?.textContent.trim() === Value
	).length;

	Tally.innerHTML = `
		<div class="summary-stat summary-total">
			<span class="summary-number">${Tasks.length}</span>
			<span class="summary-label">Tasks left</span>
		</div>
		<div class="summary-group" aria-label="Tasks by priority">
			<span class="summary-group-label">Priority</span>
			<div class="summary-group-items">
				${summary_item("Low", CountBy(".badge", "Low"), "low")}
				${summary_item("Med", CountBy(".badge", "Med"), "med")}
				${summary_item("High", CountBy(".badge", "High"), "high")}
			</div>
		</div>
		<div class="summary-group" aria-label="Tasks by tag">
			<span class="summary-group-label">Tag</span>
			<div class="summary-group-items">
				${summary_item("School", CountBy(".badge-tag", "School"))}
				${summary_item("Personal", CountBy(".badge-tag", "Personal"))}
				${summary_item("Others", CountBy(".badge-tag", "Others"))}
			</div>
		</div>
	`;
}

function summary_item(Label, Count, ClassName = "") {
	return `
		<span class="summary-item ${ClassName}">
			<span class="summary-item-count">${Count}</span>
			<span>${Label}</span>
		</span>
	`;
}

export function setup_task_view() {
	document.getElementById("filterTag")?.addEventListener("change", refresh_task_view);
	document.getElementById("filterPriority")?.addEventListener("change", refresh_task_view);
	document.getElementById("sortTasks")?.addEventListener("change", refresh_task_view);
	document.getElementById("showCompleted")?.addEventListener("change", refresh_task_view);
	refresh_task_view();
}

export function refresh_task_view() {
	const TaskList = document.getElementById("taskList");
	const SelectedTag = document.getElementById("filterTag")?.value || "All";
	const SelectedPriority = document.getElementById("filterPriority")?.value || "All";
	const SortBy = document.getElementById("sortTasks")?.value || "priority";
	const ShowCompleted = document.getElementById("showCompleted")?.checked || false;
	if (!TaskList) return;

	const TaskCards = [...TaskList.querySelectorAll(".task-card")];
	TaskCards.forEach((TaskCard) => {
		const TagHidden = SelectedTag !== "All" && TaskCard.dataset.tag !== SelectedTag;
		const PriorityHidden = SelectedPriority !== "All" && TaskCard.dataset.priority !== SelectedPriority;
		const CompletedHidden = !ShowCompleted && TaskCard.dataset.completed === "true";
		TaskCard.hidden = TagHidden || PriorityHidden || CompletedHidden;
	});

	const PriorityRank = { High: 0, Med: 1, Low: 2 };
	TaskCards.sort((First, Second) => {
		if (SortBy === "priority") {
			return (PriorityRank[First.dataset.priority] ?? 1) - (PriorityRank[Second.dataset.priority] ?? 1);
		}
		if (SortBy === "tag") {
			return (First.dataset.tag || "").localeCompare(Second.dataset.tag || "");
		}
		const FirstValue = First.dataset[SortBy] || "9999-12-31";
		const SecondValue = Second.dataset[SortBy] || "9999-12-31";
		return FirstValue.localeCompare(SecondValue);
	});
	TaskCards.forEach((TaskCard) => TaskList.appendChild(TaskCard));
	render_task_tally();
}