export function open_task_popup(Task = null) {
	let TaskDialog = document.getElementById("task-dialog");
    TaskDialog.taskToEdit = Task;
    const today = new Date();
    const formatted_date = today.toISOString().split('T')[0];
    TaskDialog.setAttribute("aria-label", Task ? "Edit task" : "Add task");
    TaskDialog.innerHTML = `
        <form method="dialog" id="taskForm">
            <input type="hidden" name="uid">
            <div class="popup-title-row">
                <div class="popup-title-field">
                    <label class="popup-title-label" for="taskTitle">
                        <span>Task title</span>
                        <span class="title-edit-hint" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16z"></path>
                            </svg>
                            Rename
                        </span>
                    </label>
                    <input class="popup-title" id="taskTitle" name="title" required autofocus>
                </div>
                <label class="popup-check" title="${Task?.completed ? "Mark task incomplete" : "Mark task complete"}">
                    <input type="checkbox" name="completed" aria-label="${Task?.completed ? "Mark task incomplete" : "Mark task complete"}" ${Task?.completed ? "checked" : ""}>
                    <span aria-hidden="true">✓</span>
                </label>
            </div>

            <div class="popup-meta">
                <div class="popup-field">
                    <label for="startDate">Start date</label>
                    <input type="hidden" id="startDate" name="start_date">
                    <output></output>
                </div>
                <div class="popup-field">
                    <label for="dueDate">Due date</label>
                    <input type="date" id="dueDate" name="due_date">
                </div>
                <div class="popup-field">
                    <label for="dueTime">Due time</label>
                    <input type="time" id="dueTime" name="due_time">
                </div>
                <div class="popup-field">
                    <label for="priority">Priority</label>
                    <select id="priority" name="priority">
                        <option value="Low">Low</option>
                        <option value="Med">Med</option>
                        <option value="High">High</option>
                    </select>
                </div>
                <div class="popup-field">
                    <label for="tag">Tag</label>
                    <select id="tag" name="tag">
                        <option value="School">School</option>
                        <option value="Personal">Personal</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
            </div>

            <div class="popup-field popup-description">
                <label for="taskDescription">Description</label>
                <textarea id="taskDescription" name="description" placeholder="Description"></textarea>
            </div>

            <p class="field-error" id="taskSaveError" role="alert" hidden></p>

            <div class="dialog-actions">
                <button type="button" id="cancelTaskBtn">Cancel</button>
                <button type="submit">${Task ? "Apply Edits" : "Add task"}</button>
            </div>
        </form>
    `;
	const Form = TaskDialog.querySelector("#taskForm");
	const StartDate = Task?.start_date || formatted_date;
	Form.elements.uid.value = Task?.uid || Task?.id || "";
	Form.elements.title.value = Task?.title || "";
	Form.elements.start_date.value = StartDate;
	Form.querySelector("output").textContent = StartDate;
	Form.elements.due_date.value = Task?.due_date || "";
	Form.elements.due_time.value = Task?.due_time || "";
	Form.elements.priority.value = Task?.priority || "Med";
	Form.elements.tag.value = Task?.tag === "Others" ? "Other" : Task?.tag || "School";
	Form.elements.completed.checked = Boolean(Task?.completed);
	Form.elements.description.value = Task?.description || "";
	document.getElementById("cancelTaskBtn").addEventListener("click", () => TaskDialog.close());


	TaskDialog.showModal();
}