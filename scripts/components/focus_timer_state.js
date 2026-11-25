export const FOCUS_MINUTE_MS = 60 * 1000;
export const FOCUS_DURATION_MS = 25 * FOCUS_MINUTE_MS;

export function read_focus_timer(Raw, Now = Date.now()) {
	let Saved;
	try {
		Saved = JSON.parse(Raw);
	} catch {
		return null;
	}

	if (!Saved) return null;
	const { status, remainingMs, endsAt, durationMs = FOCUS_DURATION_MS } = Saved;
	const TaskId = normalize_id(Saved.taskId);
	const ListId = normalize_id(Saved.listId);
	const TaskTitle = normalize_title(Saved.taskTitle);

	if (TaskId === null || (Saved.listId != null && ListId === null)) return null;
	if (!["running", "paused", "ready", "complete"].includes(status)) return null;
	if (!Number.isSafeInteger(durationMs) || !valid_minutes(durationMs / FOCUS_MINUTE_MS)) return null;
	if (!Number.isSafeInteger(remainingMs) || remainingMs < 0 || remainingMs > durationMs) return null;
	if ((remainingMs === 0) !== (status === "complete")) return null;
	if (status === "ready" && remainingMs !== durationMs) return null;
	if (status === "running" && (!Number.isSafeInteger(endsAt) || endsAt <= 0)) return null;
	if (status !== "running" && endsAt !== null) return null;

	return get_focus_timer({ taskId: TaskId, taskTitle: TaskTitle, listId: ListId, status, durationMs, remainingMs, endsAt }, Now);
}

export function start_focus_timer(Task, Now = Date.now()) {
	const TaskId = normalize_id(Task?.id ?? Task?.uid);
	if (TaskId === null) return null;

	return {
		taskId: TaskId,
		taskTitle: normalize_title(Task.title),
		listId: normalize_id(Task.list_id),
		status: "running",
		durationMs: FOCUS_DURATION_MS,
		remainingMs: FOCUS_DURATION_MS,
		endsAt: Now + FOCUS_DURATION_MS
	};
}

export function get_remaining_ms(State, Now = Date.now()) {
	if (State?.status !== "running") return State?.remainingMs ?? 0;
	return Math.max(0, Math.min(State.remainingMs, State.endsAt - Now));
}

export function get_focus_timer(State, Now = Date.now()) {
	if (State?.status !== "running" || get_remaining_ms(State, Now) > 0) return State;
	return { ...State, status: "complete", remainingMs: 0, endsAt: null };
}

export function pause_focus_timer(State, Now = Date.now()) {
	const Current = get_focus_timer(State, Now);
	if (Current?.status !== "running") return Current;
	return { ...Current, status: "paused", remainingMs: get_remaining_ms(Current, Now), endsAt: null };
}

export function resume_focus_timer(State, Now = Date.now()) {
	const Current = get_focus_timer(State, Now);
	if (Current?.status !== "paused" && Current?.status !== "ready") return Current;
	return { ...Current, status: "running", endsAt: Now + Current.remainingMs };
}

export function reset_focus_timer(State) {
	if (!State) return null;
	return { ...State, status: "ready", remainingMs: State.durationMs, endsAt: null };
}

export function set_focus_timer_duration(State, Minutes) {
	if ((State?.status !== "ready" && State?.status !== "complete") || !valid_minutes(Minutes)) return State;
	const Duration = Minutes * FOCUS_MINUTE_MS;
	if (Duration === State.durationMs) return State;
	return reset_focus_timer({ ...State, durationMs: Duration });
}

function valid_minutes(Minutes) {
	return Number.isInteger(Minutes) && Minutes >= 1 && Minutes <= 120;
}

function normalize_id(Value) {
	if (Number.isSafeInteger(Value)) return String(Value);
	return typeof Value === "string" ? Value.trim() || null : null;
}

function normalize_title(Value) {
	return (typeof Value === "string" && Value.trim()) || "Untitled task";
}
