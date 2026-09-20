(function () {
	var hero = document.getElementById("hero-map");
	if (!hero) return;

	var mapEl = document.getElementById("map");
	var openBtn = hero.querySelector(".hero-map__open");
	var closeBtn = hero.querySelector(".hero-map__close");
	var saveBtn = hero.querySelector(".hero-map__save");

	function setExpanded(expanded) {
		hero.classList.toggle("is-expanded", expanded);
		openBtn.hidden = expanded;
		closeBtn.hidden = !expanded;
		openBtn.setAttribute("aria-expanded", String(expanded));

		// While collapsed the map is a preview: keep it out of the tab order
		// so keyboard users reach the "explore" button instead.
		mapEl.inert = !expanded;

		if (expanded) {
			closeBtn.focus();
		} else if (document.activeElement === closeBtn) {
			openBtn.focus();
		}
	}

	openBtn.addEventListener("click", function () { setExpanded(true); });
	closeBtn.addEventListener("click", function () { setExpanded(false); });

	document.addEventListener("keydown", function (e) {
		if (e.key === "Escape" && hero.classList.contains("is-expanded")) {
			setExpanded(false);
		}
	});

	// Leaflet needs to know when its container changes size, otherwise tiles
	// stay cut off after the height animation. myMap is created asynchronously
	// (after stops.txt loads), so checks for it each time.
	new ResizeObserver(function () {
		if (typeof myMap !== "undefined" && myMap) {
			myMap.invalidateSize();
		}
	}).observe(mapEl);

	// Save Suburb toggle (NEED TO HOOK SAVED LINK HERE)
	saveBtn.addEventListener("click", function () {
		var saved = saveBtn.getAttribute("aria-pressed") !== "true";
		saveBtn.setAttribute("aria-pressed", String(saved));
		saveBtn.firstElementChild.textContent = saved ? "★" : "☆";
		saveBtn.querySelector(".hero-map__save-text").textContent = saved ? "Saved" : "Save Suburb";
	});

	setExpanded(false);
})();