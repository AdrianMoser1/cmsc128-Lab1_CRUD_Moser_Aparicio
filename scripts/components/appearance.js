(() => {
	const StorageKey = "todo_aoi_appearance";
	const Themes = new Set(["sage", "ocean", "clay", "olive", "cacao"]);
	let StorageError = false;
	let Preferences = { theme: "sage", dark: false };

	try {
		const Saved = localStorage.getItem(StorageKey);
		if (Saved) {
			const Parsed = JSON.parse(Saved);
			Preferences = {
				theme: Themes.has(Parsed?.theme) ? Parsed.theme : "sage",
				dark: Parsed?.dark === true
			};
		}
	} catch (Error) {
		console.error("Could not read appearance preferences:", Error);
		StorageError = true;
	}

	function apply_preferences() {
		document.documentElement.dataset.theme = Preferences.theme;
		document.documentElement.dataset.mode = Preferences.dark ? "dark" : "light";
	}

	function initialize_controls() {
		const Settings = document.getElementById("appearanceSettings");
		if (!Settings) return;

		const Status = document.getElementById("appearanceStatus");
		const ThemeOptions = [...Settings.querySelectorAll('input[name="theme"]')];
		const DarkMode = document.getElementById("darkModeToggle");
		ThemeOptions.forEach((Option) => {
			Option.checked = Option.value === Preferences.theme;
			Option.addEventListener("change", () => {
				if (!Option.checked) return;
				Preferences.theme = Option.value;
				save_preferences(Status);
			});
		});
		DarkMode.checked = Preferences.dark;
		DarkMode.addEventListener("change", () => {
			Preferences.dark = DarkMode.checked;
			save_preferences(Status);
		});

		if (StorageError) {
			Status.textContent = "Saved appearance preferences could not be read; defaults are in use.";
			Status.hidden = false;
		}
	}

	function save_preferences(Status) {
		apply_preferences();
		try {
			localStorage.setItem(StorageKey, JSON.stringify(Preferences));
			Status.hidden = true;
			Status.textContent = "";
		} catch (Error) {
			console.error("Could not save appearance preferences:", Error);
			Status.textContent = "This appearance is active for now, but could not be saved.";
			Status.hidden = false;
		}
	}

	apply_preferences();
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initialize_controls, { once: true });
	} else {
		initialize_controls();
	}
})();
