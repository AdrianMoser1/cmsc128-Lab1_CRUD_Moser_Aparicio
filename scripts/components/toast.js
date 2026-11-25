let ToastTimer;
let RemovalTimer;

export function show_toast(Message, Kind = "success") {
	let Toast = document.querySelector(".toast");
	if (!Toast) {
		Toast = document.createElement("div");
		Toast.className = "toast";
		Toast.setAttribute("aria-atomic", "true");
		document.body.appendChild(Toast);
	}

	clearTimeout(ToastTimer);
	clearTimeout(RemovalTimer);
	Toast.textContent = Message;
	Toast.className = `toast is-${Kind}`;
	Toast.setAttribute("role", Kind === "error" ? "alert" : "status");
	requestAnimationFrame(() => Toast.classList.add("is-visible"));

	ToastTimer = setTimeout(() => {
		Toast.classList.remove("is-visible");
		RemovalTimer = setTimeout(() => Toast.remove(), 220);
	}, 1000);
}
