export function open_task_popup() {
	let TaskDialog = document.getElementById("task-dialog");
    const today = new Date();
    const formatted_date = today.toISOString().split('T')[0];
    TaskDialog.innerHTML = `
        <form method="dialog" id="taskForm">
            <input id="taskTitle" name="title" placeholder="Click->Type Here For Title" required> </input>
            <br>
            <label for="startDate">Creation Date: ${formatted_date}</label>
            <label for="dueDate">Due Date: 2026-05-05</label>
            <label for="priority">Priority:</label>
            <select id="priority" name="priority">
                <option value="Low">Low</option>
                <option value="Med" selected>Med</option>
                <option value="High">High</option>
            </select>
            <label for="tag">Tag:</label>
            <select id="tag" name="tag">
                <option value="School">School</option>
                <option value="Personal">Personal</option>
                <option value="Others">Others</option>
            </select>
            <br>
            <label id="dateToolTip">Dates are in the format (YYYY/MM/DD)!</label> (moser change this to be smaller and low opacity ty)
            <br>
            <label for="taskDescription">Description:</label>
            <br>
            <textarea id="taskDescription" name="description" placeholder="Click here to begin typing"></textarea>
            <br>
            

            <button type="submit">Add task</button>
            <button type="button" id="cancelTaskBtn">Cancel</button>
        </form>
    `;
	document.getElementById("cancelTaskBtn").addEventListener("click", () => TaskDialog.close());


	TaskDialog.showModal();
}