import { confirm_action } from "./confirm_action.js";
import {
	FOCUS_DURATION_MS,
	get_focus_timer,
	get_remaining_ms,
	pause_focus_timer,
	read_focus_timer,
	reset_focus_timer,
	resume_focus_timer,
	start_focus_timer
} from "./focus_timer_state.js";

const ToggleLabels = {
	ready: "Start",
	running: "Pause",
	paused: "Resume",
	complete: "Start again"
};
const SessionMessages = {
	ready: "Start when you’re ready to give this task your attention.",
	running: "One task at a time. You can pause whenever you need.",
	paused: "Take your time. Pick up where you left off.",
	complete: "Good work. Take a short break before your next session."
};

export function setup_focus_timer(UserId) {
	const TaskList = document.getElementById("taskList");
	const Panel = document.getElementById("focusTimer");
	const TaskTitle = document.getElementById("focusTimerTask");
	const Clock = document.getElementById("focusTimerClock");
	const Toggle = document.getElementById("focusTimerToggle");
	const Reset = document.getElementById("focusTimerReset");
	const Close = document.getElementById("focusTimerClose");
	const Message = document.getElementById("focusTimerMessage");
	const StorageKey = `todo_aoi_focus_timer:${UserId}`;
	let CanSave = true;
	let State = load_timer();
	let Tick = null;

	function load_timer() {
		try {
			return read_focus_timer(localStorage.getItem(StorageKey));
		} catch {
			CanSave = false;
			return null;
		}
	}

	function save_timer(Next) {
		State = Next;
		try {
			if (State) localStorage.setItem(StorageKey, JSON.stringify(State));
			else localStorage.removeItem(StorageKey);
			CanSave = true;
		} catch {
			CanSave = false;
		}
		render_timer();
	}

	function render_timer() {
		const Now = Date.now();
		State = get_focus_timer(State, Now);
		const Running = State?.status === "running";
		if (Running && Tick === null) Tick = window.setInterval(render_timer, 250);
		if (!Running && Tick !== null) {
			window.clearInterval(Tick);
			Tick = null;
		}
		Panel.hidden = !State;
		if (!State) return;

		const Remaining = Math.ceil(get_remaining_ms(State, Now) / 1000);
		const Time = `${Math.floor(Remaining / 60)}:${String(Remaining % 60).padStart(2, "0")}`;
		const Status = SessionMessages[State.status] + (CanSave ? "" : " This timer cannot be saved in this browser.");
		if (Panel.dataset.state !== State.status) Panel.dataset.state = State.status;
		if (TaskTitle.textContent !== State.taskTitle) TaskTitle.textContent = State.taskTitle;
		if (Clock.textContent !== Time) {
			Clock.textContent = Time;
			Panel.style.setProperty("--focus-progress", String(1 - Remaining * 1000 / FOCUS_DURATION_MS));
		}
		if (Toggle.textContent !== ToggleLabels[State.status]) Toggle.textContent = ToggleLabels[State.status];
		if (Message.textContent !== Status) Message.textContent = Status;
		Reset.disabled = State.status === "ready";
	}

	async function confirm_change(Title, Description, Action) {
		const Before = get_focus_timer(State);
		if (Before?.status !== "running" && Before?.status !== "paused") return true;
		const Confirmed = await confirm_action(Title, Description, Action);
		return Confirmed && State === Before;
	}

	function focus_task_card(TaskId) {
		const Card = [...TaskList.querySelectorAll(".task-card:not([hidden])")]
			.find((Item) => Item.dataset.taskId === TaskId);
		const Control = Card?.querySelector(".task-focus-btn") || document.getElementById("listSelect");
		Control.focus();
	}

	TaskList.addEventListener("click", async (Event) => {
		const Button = Event.target.closest(".task-focus-btn");
		if (!Button) return;
		const Task = Button.closest(".task-card").taskData;
		const Next = start_focus_timer(Task);
		if (!Next) return;
		if (Next.taskId !== State?.taskId) {
			if (!await confirm_change(
				"Switch focus task?",
				"Switching will end your current focus session.",
				"Switch task"
			)) return;
			save_timer(reset_focus_timer(Next));
		}
		Toggle.focus();
	});

	Toggle.addEventListener("click", () => {
		const Now = Date.now();
		const Current = get_focus_timer(State, Now);
		if (!Current) return;
		if (Current.status === "running") save_timer(pause_focus_timer(Current, Now));
		else {
			const Ready = Current.status === "complete" ? reset_focus_timer(Current) : Current;
			save_timer(resume_focus_timer(Ready, Now));
		}
	});

	Reset.addEventListener("click", async () => {
		if (!await confirm_change("Reset focus timer?", "This will return the timer to 25 minutes.", "Reset timer")) return;
		save_timer(reset_focus_timer(State));
		Toggle.focus();
	});

	Close.addEventListener("click", async () => {
		if (!await confirm_change("End this focus session?", "Your current timer progress will be cleared.", "End session")) return;
		const TaskId = State?.taskId;
		save_timer(null);
		focus_task_card(TaskId);
	});

	TaskList.addEventListener("taskviewchange", () => {
		if (!State) return;
		const Card = [...TaskList.querySelectorAll(".task-card")].find((Item) => Item.dataset.taskId === State.taskId);
		const Title = Card?.taskData?.title;
		if (Title && Title !== State.taskTitle) save_timer({ ...State, taskTitle: Title });
	});

	function dismiss_deleted_task() {
		const FocusWasInPanel = Panel.contains(document.activeElement);
		save_timer(null);
		if (FocusWasInPanel) focus_task_card();
	}

	TaskList.addEventListener("tasksdeleted", (Event) => {
		if (State && Event.detail.includes(State.taskId)) dismiss_deleted_task();
	});
	TaskList.addEventListener("listdeleted", (Event) => {
		if (State?.listId === Event.detail) dismiss_deleted_task();
	});
	TaskList.addEventListener("activelistchange", () => {
		if (State) save_timer(null);
	});

	window.addEventListener("storage", (Event) => {
		if (Event.key !== StorageKey && Event.key !== null) return;
		State = load_timer();
		render_timer();
	});
	document.addEventListener("visibilitychange", () => {
		if (!document.hidden) render_timer();
	});
	render_timer();
}
