export function open_task_popup(Task = null) {
	let TaskDialog = document.getElementById("task-dialog");
    const uid = Task ? Task.uid : crypto.randomUUID();
    TaskDialog.taskToEdit = Task;
    const today = new Date();
    const formatted_date = today.toISOString().split('T')[0];
    TaskDialog.innerHTML = `
        <form method="dialog" id="taskForm">
            <input type="hidden" name="uid" value="${uid}">
            <input id="taskTitle" name="title" placeholder="Click->Type Here For Title" value="${Task?.title || ""}" required>
            <br>
            <label for="startDate">Start Date: ${Task?.start_date || formatted_date}</label>
            <input type="hidden" id="startDate" name="start_date" value="${Task?.start_date || formatted_date}">
            <label for="dueDate">Due Date: </label>
            <input type="date" id="dueDate" name="due_date" value="${Task?.due_date || ""}">
            <label for="priority">Priority:</label>
            <select id="priority" name="priority">
                <option value="Low" ${Task?.priority === "Low" ? "selected" : ""}>Low</option>
                <option value="Med" ${!Task || Task.priority === "Med" ? "selected" : ""}>Med</option>
                <option value="High" ${Task?.priority === "High" ? "selected" : ""}>High</option>
            </select>
            <label for="tag">Tag:</label>
            <select id="tag" name="tag">
                <option value="School" ${!Task || Task.tag === "School" ? "selected" : ""}>School</option>
                <option value="Personal" ${Task?.tag === "Personal" ? "selected" : ""}>Personal</option>
                <option value="Others" ${Task?.tag === "Others" ? "selected" : ""}>Others</option>
            </select>
            <br>
            <small id="dateToolTip">Dates are in the format (YYYY/MM/DD)!</small> (moser change this to be smaller and low opacity ty)
            <br>
            <label for="taskDescription">Description:</label>
            <br>
            <textarea id="taskDescription" name="description" placeholder="Click here to begin typing">${Task?.description || ""}</textarea>
            <br>
            <button type="submit">Add task</button>
            <button type="button" id="cancelTaskBtn">Cancel</button>
        </form>
    `;
	document.getElementById("cancelTaskBtn").addEventListener("click", () => TaskDialog.close());


	TaskDialog.showModal();
}