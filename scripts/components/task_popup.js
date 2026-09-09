export function open_task_popup(Task = null) {
	let TaskDialog = document.getElementById("task-dialog");
    const uid = Task?.uid || "";
    TaskDialog.taskToEdit = Task;
    const today = new Date();
    const formatted_date = today.toISOString().split('T')[0];
    TaskDialog.innerHTML = `
        <form method="dialog" id="taskForm">
            <input type="hidden" name="uid" value="${uid}">
            <div class="popup-title-row">
                <input class="popup-title" id="taskTitle" name="title" placeholder="Title" value="${Task?.title || ""}" required>
                <label class="popup-check" title="Mark task complete">
                    <input type="checkbox" name="completed" ${Task?.completed ? "checked" : ""}>
                    <span aria-hidden="true">✓</span>
                </label>
            </div>

            <div class="popup-meta">
                <div class="popup-field">
                    <label for="startDate">Start date</label>
                    <input type="hidden" id="startDate" name="start_date" value="${Task?.start_date || formatted_date}">
                    <output>${Task?.start_date || formatted_date}</output>
                </div>
                <div class="popup-field">
                    <label for="dueDate">Due date</label>
                    <input type="date" id="dueDate" name="due_date" value="${Task?.due_date || ""}" required>
                </div>
                <div class="popup-field">
                    <label for="dueTime">Due time</label>
                    <input type="time" id="dueTime" name="due_time" value="${Task?.due_time || ""}" required>
                </div>
                <div class="popup-field">
                    <label for="priority">Priority</label>
                    <select id="priority" name="priority">
                        <option value="Low" ${Task?.priority === "Low" ? "selected" : ""}>Low</option>
                        <option value="Med" ${!Task || Task.priority === "Med" ? "selected" : ""}>Med</option>
                        <option value="High" ${Task?.priority === "High" ? "selected" : ""}>High</option>
                    </select>
                </div>
                <div class="popup-field">
                    <label for="tag">Tag</label>
                    <select id="tag" name="tag">
                        <option value="School" ${!Task || Task.tag === "School" ? "selected" : ""}>School</option>
                        <option value="Personal" ${Task?.tag === "Personal" ? "selected" : ""}>Personal</option>
                        <option value="Others" ${!Task || Task.tag === "Other" || Task.tag === "Others" ? "selected" : ""}>Others</option>
                    </select>
                </div>
            </div>

            <div class="popup-field popup-description">
                <label for="taskDescription">Description</label>
                <textarea id="taskDescription" name="description" placeholder="Description">${Task?.description || ""}</textarea>
            </div>

            <div class="dialog-actions">
                <button type="button" id="cancelTaskBtn">Cancel</button>
                <button type="submit">${Task ? "Apply Edits" : "Add Task"}</button>
            </div>
        </form>
    `;
	document.getElementById("cancelTaskBtn").addEventListener("click", () => TaskDialog.close());


	TaskDialog.showModal();
}