import { confirm_action } from "./confirm_action.js";
import {
	FOCUS_MINUTE_MS,
	extend_focus_timer,
	get_focus_timer,
	get_remaining_ms,
	pause_focus_timer,
	read_focus_timer,
	reset_focus_timer,
	resume_focus_timer,
	set_focus_timer_duration,
	start_focus_timer
} from "./focus_timer_state.js";

const ToggleLabels = {
	ready: "Start",
	running: "Pause",
	paused: "Resume",
	complete: "More time"
};
const SessionMessages = {
	ready: "Choose 1–120 minutes, then start when you’re ready.",
	running: "One task at a time. Reset to change the duration.",
	paused: "Resume when you’re ready, or reset to change the duration.",
	complete: "Good work. Add more time or take a short break."
};

export function setup_focus_timer(UserId) {
	const TaskList = document.getElementById("taskList");
	const Panel = document.getElementById("focusTimer");
	const Heading = document.getElementById("focusTimerHeading");
	const TaskTitle = document.getElementById("focusTimerTask");
	const Controls = document.getElementById("focusTimerControls");
	const Duration = document.getElementById("focusTimerDuration");
	const Clock = document.getElementById("focusTimerClock");
	const Toggle = document.getElementById("focusTimerToggle");
	const Reset = document.getElementById("focusTimerReset");
	const Close = document.getElementById("focusTimerClose");
	const Message = document.getElementById("focusTimerMessage");
	const CompletionDialog = document.getElementById("focusCompletionDialog");
	const CompletionForm = document.getElementById("focusCompletionForm");
	const CompletionTask = document.getElementById("focusCompletionTask");
	const MoreMinutes = document.getElementById("focusCompletionMinutes");
	const Finish = document.getElementById("finishFocusBtn");
	const StorageKey = `todo_aoi_focus_timer:${UserId}`;
	let CanSave = true;
	let State = load_timer();
	let Tick = null;
	let CompletionOffered = false;

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
		sync_duration();
		render_timer();
	}

	function sync_duration() {
		if (State) Duration.value = String(State.durationMs / FOCUS_MINUTE_MS);
	}

	function render_timer() {
		const Now = Date.now();
		State = get_focus_timer(State, Now);
		if (State?.status !== "complete") {
			CompletionOffered = false;
			if (CompletionDialog.open) CompletionDialog.close();
		}
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
		if (Clock.textContent !== Time) Clock.textContent = Time;
		const Progress = String(1 - Remaining * 1000 / State.intervalMs);
		if (Panel.style.getPropertyValue("--focus-progress") !== Progress) {
			Panel.style.setProperty("--focus-progress", Progress);
		}
		if (Toggle.textContent !== ToggleLabels[State.status]) Toggle.textContent = ToggleLabels[State.status];
		if (Message.textContent !== Status) Message.textContent = Status;
		Duration.disabled = State.status !== "ready";
		Reset.disabled = State.status === "ready";
		offer_completion();
	}

	function offer_completion(Reopen = false) {
		if (State?.status !== "complete" || (CompletionOffered && !Reopen) ||
			document.hidden || document.querySelector("dialog[open]")) return;

		CompletionTask.textContent = State.taskTitle;
		MoreMinutes.value = MoreMinutes.defaultValue;
		CompletionDialog.showModal();
		CompletionOffered = true;
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
		Heading.focus();
	});

	Duration.addEventListener("change", () => {
		const Next = set_focus_timer_duration(State, Duration.valueAsNumber);
		if (Next !== State) save_timer(Next);
	});

	Controls.addEventListener("submit", (Event) => {
		Event.preventDefault();
		const Now = Date.now();
		const Current = get_focus_timer(State, Now);
		if (!Current) return;
		if (State.status === "running") {
			save_timer(pause_focus_timer(Current, Now));
			return;
		}
		if (Current.status === "paused") {
			save_timer(resume_focus_timer(Current, Now));
			return;
		}
		if (Current.status === "complete") {
			offer_completion(true);
			return;
		}
		if (!Duration.reportValidity()) return;
		const Ready = set_focus_timer_duration(Current, Duration.valueAsNumber);
		save_timer(resume_focus_timer(Ready, Now));
	});

	Reset.addEventListener("click", async () => {
		if (!await confirm_change("Reset focus timer?", "This will return the timer to your chosen duration.", "Reset timer")) return;
		save_timer(reset_focus_timer(State));
		Heading.focus();
	});

	function finish_timer() {
		const TaskId = State?.taskId;
		save_timer(null);
		focus_task_card(TaskId);
	}

	Close.addEventListener("click", async () => {
		if (!await confirm_change("End this focus session?", "Your current timer progress will be cleared.", "End session")) return;
		finish_timer();
	});

	CompletionForm.addEventListener("submit", (Event) => {
		Event.preventDefault();
		const Next = extend_focus_timer(State, MoreMinutes.valueAsNumber);
		if (Next === State) return;
		save_timer(Next);
		Toggle.focus();
	});

	Finish.addEventListener("click", () => {
		if (State?.status === "complete") finish_timer();
	});

	document.addEventListener("close", () => offer_completion(), true);

	TaskList.addEventListener("taskviewchange", () => {
		if (!State) return;
		const Card = [...TaskList.querySelectorAll(".task-card")].find((Item) => Item.dataset.taskId === State.taskId);
		const Title = Card?.taskData?.title;
		if (Title && Title !== State.taskTitle) save_timer({ ...State, taskTitle: Title });
	});

	function dismiss_deleted_task() {
		const FocusWasInPanel = CompletionDialog.open || Panel.contains(document.activeElement);
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
		sync_duration();
		render_timer();
	});
	document.addEventListener("visibilitychange", () => {
		if (!document.hidden) render_timer();
	});
	sync_duration();
	render_timer();
}
