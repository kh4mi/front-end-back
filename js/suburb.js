/* suburb.js — suburb detail page. Reads the suburb from the URL: suburb.html?s=toowong */
(async function () {
  'use strict';
  const $ = (sel) => document.querySelector(sel);

  const slug = new URLSearchParams(window.location.search).get('s') || 'toowong';
  const data = await SM.init();
  const s = data.bySlug[slug];

  if (!s) {
    $('#suburbName').textContent = 'Suburb not found';
    $('#suburbSubtitle').innerHTML = 'We don\'t have that suburb yet. <a href="results.html">Browse suburbs</a>.';
    return;
  }

  initMap(s.name, s.slug, s);

  document.title = s.name + ' – suburb.ly';
  $('#suburbName').textContent = s.name;
  $('#suburbSubtitle').textContent = s.fit + '% fit · ' + s.kmCbd.toFixed(1) + ' km from Brisbane CBD · Postcode ' + s.postcode;

  // Score bars
  $('#bars').innerHTML = SM.FACTORS.map(function (f) {
    const v = s.scores[f.key];
    return (
      '<div class="bar' + (v === null ? ' bar--none' : '') + '" data-factor="' + f.key + '">' +
        '<span class="bar__label">' + SM.esc(f.short) + '</span>' +
        '<span class="bar__track" aria-hidden="true"><span class="bar__fill" style="--score:' + (v || 0) + '"></span></span>' +
        '<span class="bar__num">' + SM.scoreText(v) + '</span>' +
      '</div>'
    );
  }).join('');

  // Amenities: live park names from the Brisbane City Council dataset, plus straight-line distances
  const chips = [];
  const dests = ['uq', 'qut', 'cbd'].map((key) => SM.DESTINATIONS[key]);
  const mine = SM.destinationOf(SM.getPrefs()); // a place the visitor typed into the quiz
  if (mine && dests.indexOf(mine) === -1) dests.unshift(mine);
  dests.forEach(function (d) {
    chips.push('<li class="chip">' + SM.km(s, d).toFixed(1) + ' km to ' + SM.esc(d.label) + '</li>');
  });
  const names = Array.from(new Set(s.parkNames)).slice(0, 5);
  $('#amenities').innerHTML = chips.join('');
  // Council park names are all caps, so tidy them to Title Case for reading
  const tidy = (n) => n.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  $('#nearParks').innerHTML = names.length
    ? names.map((n) => '<li><span class="nearby__name">' + SM.esc(tidy(n)) + '</span></li>').join('')
    : '<li class="muted">No park names available.</li>';

  loadPlaces(s);

  const info = data.parkInfo;
  if (s.parksLive) {
    const how = info.method === 'radius' ? 'within 1.5 km of the suburb centre' : 'in ' + s.name;
    $('#amenityNote').textContent = s.parkCount + ' parks ' + how + ' in Brisbane City Council\'s park dataset' +
      (names.length ? ' (first ' + names.length + ' shown)' : '') + '. Stops from Translink SEQ GTFS. Shops, schools and hospitals from Google Places. Distances are straight-line from the suburb centre, not travel time.';
  } else if (!s.bcc) {
    $('#amenityNote').textContent = 'Parks show "No data" here because our park data comes from Brisbane City Council, which only covers its own suburbs. Stops from Translink SEQ GTFS. Shops, schools and hospitals from Google Places. Distances are straight-line from the suburb centre, not travel time.';
  } else {
    $('#amenityNote').textContent = 'Park names are unavailable because live park data could not be loaded. Stops from Translink SEQ GTFS. Shops, schools and hospitals from Google Places. Distances are straight-line from the suburb centre, not travel time.';
  }


  // Community snapshot and housing costs, from the ABS 2021 Census (data/suburbs.js)
  const c = s.census || {};
  const put = (id, v, fmt) => { $(id).textContent = v === null || v === undefined ? 'No data' : fmt(v); };
  put('#cPopulation', c.population, (v) => v.toLocaleString('en-AU') + ' people');
  put('#cMedianAge', c.medianAge, (v) => v + ' years');
  put('#cAgeGroup', c.topAgeGroup, (v) => v + ' years');
  put('#cOverseas', c.bornOverseas, (v) => v + '% of residents');
  put('#cHousehold', c.householdSize, (v) => v + ' people');
  put('#cIncome', c.householdIncome, (v) => SM.formatPrice(v) + ' per week');
  put('#censusRent', c.rent, (v) => SM.formatPrice(v) + ' per week');
  put('#censusMortgage', c.mortgage, (v) => SM.formatPrice(v) + ' per month');

  // Asking rents, from the rental listings snapshot
  const rent = SM.rentStats(s.slug);
  $('#medianRent').textContent = rent.median ? SM.formatPrice(rent.median) + ' per week' : 'No listings in the dataset';
  $('#rentCount').textContent = rent.count + (rent.count === 1 ? ' listing' : ' listings') + (rent.count && rent.count < 5 ? ' (small sample, treat as a rough guide)' : '');

  // Rentals link
  // Two copies of the button: top of the right column on wide screens, under the score bars on phones
  document.querySelectorAll('#rentalsLink, #rentalsLinkMobile').forEach(function (link) {
    link.href = 'rentals.html?suburb=' + encodeURIComponent(s.slug);
    link.innerHTML = 'View rentals in ' + SM.esc(s.name) + ' <span aria-hidden="true">→</span>';
  });

  // Save suburb (the button sits on the map header). Saved suburbs are listed on the results page.
  const saveBtn = document.querySelector('.hero-map__save');
  const label = saveBtn.querySelector('.hero-map__save-text');
  function paintSave() {
    const saved = SM.getSaved('Suburbs').indexOf(s.slug) >= 0;
    saveBtn.setAttribute('aria-pressed', String(saved));
    saveBtn.firstElementChild.textContent = saved ? '★' : '☆';
    label.textContent = saved ? 'Saved' : 'Save Suburb';
  }
  saveBtn.addEventListener('click', function () { SM.toggleSaved('Suburbs', s.slug); paintSave(); });
  paintSave();
})();

/* ------------------------------------------------------------------
   Nearby shops, schools and hospitals: Google Places API (New), "Nearby Search"
   https://developers.google.com/maps/documentation/places/web-service/nearby-search
   Asked only when someone opens a suburb page, then saved in the browser for a week,
   so each suburb costs at most one request per category per visitor per week.
   Only the suburb's centre point is sent to Google, nothing about the visitor.
   ------------------------------------------------------------------ */
var PLACE_GROUPS = [
	// rank "POPULARITY" finds the big centres people actually mean, rather than every small arcade next door
	{ el: "#nearMalls", layer: "malls", types: ["shopping_mall"], radius: 4000, rank: "POPULARITY", empty: "No shopping centres within 4 km." },
	{ el: "#nearShops", layer: "groceries", types: ["supermarket"], radius: 2000, rank: "DISTANCE", empty: "No supermarkets within 2 km." },
	{ el: "#nearSchools", layer: "schools", types: ["primary_school", "secondary_school"], radius: 2000, rank: "DISTANCE", empty: "No schools within 2 km." },
	{ el: "#nearHospitals", layer: "hospitals", types: ["hospital"], radius: 5000, rank: "DISTANCE", empty: "No hospitals within 5 km." }
];
var PLACES_CACHE_DAYS = 7;

function nearbyItem(name, km) {
	return '<li><span class="nearby__name">' + SM.esc(name) + '</span><span class="nearby__dist">' + km.toFixed(1) + ' km</span></li>';
}

async function fetchPlaces(s, group) {
	var cacheKey = "places.v1." + s.slug + "." + group.types.join("+");
	var cached = SM.store.get(cacheKey, null);
	if (cached && Date.now() - cached.at < PLACES_CACHE_DAYS * 864e5) return cached.places;

	var res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Goog-Api-Key": SM.GOOGLE_MAPS_KEY,
			"X-Goog-FieldMask": "places.displayName,places.location" // only ask for (and pay for) what we show
		},
		body: JSON.stringify({
			includedPrimaryTypes: group.types, // primary type only, so a petrol station that sells milk isn't a "supermarket"
			maxResultCount: 5,
			rankPreference: group.rank,
			locationRestriction: { circle: { center: { latitude: s.lat, longitude: s.lng }, radius: group.radius } }
		})
	});
	if (!res.ok) throw new Error("Places HTTP " + res.status);
	var json = await res.json();
	var places = (json.places || []).map(p => ({ name: p.displayName.text, lat: p.location.latitude, lng: p.location.longitude }));
	SM.store.set(cacheKey, { at: Date.now(), places: places });
	return places;
}

function loadPlaces(s) {
	PLACE_GROUPS.forEach(group => {
		var el = document.querySelector(group.el);
		if (!SM.GOOGLE_MAPS_KEY) { el.innerHTML = '<li class="muted">Not connected (no Google key set).</li>'; return; }
		fetchPlaces(s, group)
			.then(places => {
				places.forEach(p => addPoint(group.layer, p.lat, p.lng, "<strong>" + SM.esc(p.name) + "</strong>", p.name)); // same places on the map
				el.innerHTML = places.length
					? places.map(p => ({ name: p.name, km: SM.km(s, p) })).sort((a, b) => a.km - b.km)
						.map(p => nearbyItem(p.name, p.km)).join("")
					: '<li class="muted">' + group.empty + '</li>';
			})
			.catch(err => {
				console.warn("[SM] Google Places unavailable:", err);
				el.innerHTML = '<li class="muted">Couldn\'t load right now.</li>';
			});
	});
}

/* ------------------------------------------------------------------
   Trains, ferries and buses near the suburb, from Translink's GTFS stops (data/stops.txt).
   Stations and ferry terminals are the "parent" stops (location_type 1); their platforms
   are left out so each station is listed once. Bus stops are counted within walking distance.
   ------------------------------------------------------------------ */
var TRAIN_KM = 3, FERRY_KM = 3, BUS_WALK_KM = 0.8;

function renderTransport(slug) {
	var s = SM.SUBURBS.find(x => x.slug === slug);
	var el = document.getElementById("nearTransport");
	if (!s || !el) return;
	if (!allStops.length) { el.innerHTML = '<li class="muted">Translink stop data could not be loaded.</li>'; return; }

	var trains = [], ferries = [], busStops = 0;
	allStops.forEach(stop => {
		var p = { lat: parseFloat(stop.stop_lat), lng: parseFloat(stop.stop_lon) };
		if (isNaN(p.lat) || isNaN(p.lng)) return;
		var name = (stop.stop_name || "").trim();
		var km = SM.km(s, p);
		if (String(stop.location_type).trim() === "1") {
			if (/ferry terminal/i.test(name)) { if (km <= FERRY_KM) ferries.push({ name: name, km: km }); }
			// Translink gives train stations ids ending in "sta" (place_tarsta); bus interchanges are also called "station", so the id is what tells them apart
			else if (/^place_.*sta$/.test(stop.stop_id)) { if (km <= TRAIN_KM) trains.push({ name: name, km: km }); }
		} else if (!stop.parent_station && km <= BUS_WALK_KM && !/ferry terminal|station/i.test(name)) {
			busStops += 1;
		}
	});
	var byKm = (a, b) => a.km - b.km;
	trains.sort(byKm); ferries.sort(byKm);

	var items = [];
	trains.slice(0, 3).forEach(t => items.push(nearbyItem("🚄 " + t.name, t.km)));
	ferries.slice(0, 2).forEach(f => items.push(nearbyItem("🛥️ " + f.name, f.km)));
	items.push('<li><span class="nearby__name">🚌 ' + busStops + ' stops within ' + (BUS_WALK_KM * 1000) + ' m</span></li>');
	if (!trains.length) items.unshift('<li class="muted">No train station within ' + TRAIN_KM + ' km.</li>');
	el.innerHTML = items.join("");
}

var allStops = []; // keeps full dataset in memory once loaded
var myMap; // keeps a reference to clear old markers between searches
var currentBoundary = null; // tracks the suburb outline so we can remove it between searches

/* ------------------------------------------------------------------
   Map layers and key (legend)
   Every category is its own Leaflet layer group, switched on and off with the checkboxes
   in the collapsible key at the bottom right. Bus, train and ferry sit under one
   "Transportation" box that ticks or unticks all three, but each can also be ticked alone.
   ------------------------------------------------------------------ */
var MAP_LAYERS = [
	{ key: "rentals",   label: "Rental listings",  on: true },
	{ key: "bus",       label: "Bus stops",        icon: "🚌", on: false, parent: "transport" },
	{ key: "train",     label: "Train stations",   icon: "🚄", on: true,  parent: "transport" },
	{ key: "ferry",     label: "Ferry terminals",  icon: "🛥️", on: false, parent: "transport" },
	{ key: "malls",     label: "Shopping centres", icon: "🛍️", on: true },
	{ key: "parks",     label: "Parks",            icon: "🌳", on: false },
	{ key: "groceries", label: "Grocery stores",   icon: "🛒", on: false },
	{ key: "schools",   label: "Schools",          icon: "🏫", on: true },
	{ key: "hospitals", label: "Hospitals",        icon: "🏥", on: true }
];
var NEAR_STATION_KM = 1; // stations and terminals just outside the boundary still count
var layerGroups = {};
var RENTAL_PIN_SVG = '<svg viewBox="0 0 24 34" aria-hidden="true" focusable="false"><path d="M12 33S2 19.5 2 12a10 10 0 0 1 20 0c0 7.5-10 21-10 21z"/><circle cx="12" cy="12" r="4"/></svg>';

function layerGroup(key) {
	if (!layerGroups[key]) layerGroups[key] = L.layerGroup();
	return layerGroups[key];
}

function addPoint(key, lat, lng, popupHTML, title) {
	var def = MAP_LAYERS.find(l => l.key === key);
	var icon = L.divIcon({ className: "emoji-pin", html: "<span>" + def.icon + "</span>", iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -16] });
	L.marker([lat, lng], { icon: icon, alt: def.label + ": " + title })
		.bindTooltip(popupHTML, { direction: "top", offset: [0, -14] }) // info on hover
		.bindPopup(popupHTML) // and on tap, for touch screens
		.addTo(layerGroup(key));
}

function addMapKey() {
	var control = L.control({ position: "bottomright" });
	control.onAdd = function () {
		var div = L.DomUtil.create("div", "map-key");
		L.DomEvent.disableClickPropagation(div);
		L.DomEvent.disableScrollPropagation(div);
		var row = (l, child) =>
			'<label class="map-key__row' + (child ? " map-key__row--child" : "") + '">' +
				'<input type="checkbox" data-layer="' + l.key + '"' + (l.on ? " checked" : "") + '>' +
				'<span class="map-key__icon' + (l.key === "rentals" ? " map-key__icon--rental" : "") + '" aria-hidden="true">' + (l.key === "rentals" ? RENTAL_PIN_SVG : l.icon) + "</span>" +
				l.label +
			"</label>";
		var transport = MAP_LAYERS.filter(l => l.parent === "transport");
		div.innerHTML =
			'<details><summary>Map key</summary><div class="map-key__body">' +
				row(MAP_LAYERS[0]) +
				'<label class="map-key__row"><input type="checkbox" data-layer="transport"><span class="map-key__icon" aria-hidden="true"></span>Transportation</label>' +
				transport.map(l => row(l, true)).join("") +
				MAP_LAYERS.filter(l => !l.parent && l.key !== "rentals").map(l => row(l)).join("") +
				'<p class="map-key__note">Shops, schools and hospitals: Google Places</p>' +
			"</div></details>";
		div.addEventListener("change", function (e) {
			var key = e.target.dataset.layer;
			if (key === "transport") {
				div.querySelectorAll(".map-key__row--child input").forEach(box => { box.checked = e.target.checked; });
			}
			syncLayers(div);
		});
		return div;
	};
	control.addTo(myMap);
	syncLayers(control.getContainer());

	// The key starts collapsed while the map is a small preview, and opens when the map is expanded
	var hero = document.getElementById("hero-map");
	var details = control.getContainer().querySelector("details");
	if (hero) {
		new MutationObserver(() => { details.open = hero.classList.contains("is-expanded"); })
			.observe(hero, { attributes: true, attributeFilter: ["class"] });
	}
}

// Show the ticked layers, hide the rest, and set the Transportation box to ticked, unticked or "some"
function syncLayers(div) {
	MAP_LAYERS.forEach(l => {
		var box = div.querySelector('input[data-layer="' + l.key + '"]');
		if (box.checked) layerGroup(l.key).addTo(myMap); else myMap.removeLayer(layerGroup(l.key));
	});
	var kids = Array.from(div.querySelectorAll(".map-key__row--child input"));
	var parent = div.querySelector('input[data-layer="transport"]');
	var ticked = kids.filter(k => k.checked).length;
	parent.checked = ticked === kids.length;
	parent.indeterminate = ticked > 0 && ticked < kids.length;
}

// Sorts Translink stops into bus stops, train stations and ferry terminals for the map
function addTransportMarkers(stops, s, isInside) {
	var ferriesSeen = {};
	stops.forEach(stop => {
		var lat = parseFloat(stop.stop_lat), lng = parseFloat(stop.stop_lon);
		if (isNaN(lat) || isNaN(lng)) return;
		var name = (stop.stop_name || "").trim();
		var near = isInside(lat, lng) || SM.km(s, { lat: lat, lng: lng }) <= NEAR_STATION_KM;
		var popup = "<strong>" + SM.esc(name) + "</strong>" + (stop.stop_desc ? "<br>" + SM.esc(stop.stop_desc) : "");
		if (/^place_.*sta$/.test(stop.stop_id)) { // train station (its platforms are skipped below)
			if (near) addPoint("train", lat, lng, popup, name);
		} else if (/ferry terminal/i.test(name)) {
			var terminal = name.replace(/\s*(stop|platform|berth).*$/i, "");
			if (near && !ferriesSeen[terminal]) { ferriesSeen[terminal] = true; addPoint("ferry", lat, lng, "<strong>" + SM.esc(terminal) + "</strong>", terminal); }
		} else if (String(stop.location_type).trim() !== "1" && !/sta$/.test(stop.parent_station || "") && isInside(lat, lng)) {
			addPoint("bus", lat, lng, popup, name);
		}
	});
}

// Only the parks listed under "Nearby amenities" (the first 10 names), not every park record
function addParkMarkers(s) {
	var tidy = n => n.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
	var listed = Array.from(new Set(s.parkNames)).slice(0, 10);
	listed.forEach(name => {
		var p = (s.parkPoints || []).find(pt => pt.name === name);
		if (p) addPoint("parks", p.lat, p.lng, "<strong>" + SM.esc(tidy(name)) + "</strong>", tidy(name));
	});
}

function initMap(suburbName, slug, s) {
	/*
	* This is a local copy of stops.txt, extracted from Translink's
	* GTFS zip (https$(document).ready(://gtfsrt.api.translink.com.au/GTFS/SEQ_GTFS.zip).
	* Fetching it locally avoids the CORS restriction on Translink's server.
	*/
	return fetch("data/stops.txt")
		.then(response => {
			if (!response.ok) {
				throw new Error("Failed to fetch routes.txt: " + response.status);
			}
			return response.text();
		})
		.then(csvText => {
			allStops = Papa.parse(csvText, {
				header: true,
				skipEmptyLines: true
			}).data;

			setupMap();                  // create the map
			addRentalMarkers(slug);      // red pins for rentals in this suburb
			addParkMarkers(s);           // park locations from the Council parks data
			addMapKey();                 // the key with the layer checkboxes
			renderTransport(slug);       // trains, ferries and buses list
			return runSearch(suburbName, s); // draw the suburb + stops
		})
		.catch(error => {
			console.error("Error setting up map:", error);
			renderTransport(slug); // shows "could not be loaded" instead of "Loading…"
		});

};

function setupMap() {
	// Setup the map as per the Leaflet instructions:
	// https://leafletjs.com/examples/quick-start/
	myMap = L.map("map", {
		zoomSnap: 0.1,
		zoomDelta: 0.5
	}).setView([-27, 153], 8);
	L.tileLayer("https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoibG9ybnNtYWMiLCJhIjoiY21mMjFxNDFyMDV6ODJtb290ZWQ5YzgxNyJ9.TtqqzkNfg6upLfJkVkPSjQ", 
	{
	  attribution: 'Map data © <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
	  maxZoom: 18,
	  id: 'mapbox/streets-v11', //style of map to return
	  tileSize: 512, //size in pixels of returned tiles - either 256 or 512 - the larger the tile, the less calls needed to render the map
	  zoomOffset: -1,
	 }).addTo(myMap);

		// re-measure once everything (CSS, custom elements, fonts) has finished loading
	window.addEventListener('load', () => myMap.invalidateSize());

	// and whenever the map container changes size
	new ResizeObserver(() => myMap.invalidateSize())
		.observe(document.getElementById('map'));
};

// Rental listings from data/rentals.js, drawn as red pins
function addRentalMarkers(slug) {
	var icon = L.divIcon({ className: "rental-pin", html: RENTAL_PIN_SVG, iconSize: [26, 36], iconAnchor: [13, 35], popupAnchor: [0, -32] });
	SM.RENTALS.filter(l => l.slug === slug).forEach(l => {
		var info = "<strong>" + SM.formatPrice(l.price) + "/wk</strong> · " + SM.esc(l.type) + "<br>" + SM.esc(l.street) + "<br>" +
			l.beds + " bed · " + l.baths + " bath · " + l.cars + " car";
		L.marker([l.lat, l.lng], { icon: icon, alt: "Rental: " + SM.formatPrice(l.price) + "/wk, " + l.street, zIndexOffset: 500 })
			.addTo(layerGroup("rentals"))
			.bindTooltip(info, { direction: "top", offset: [0, -30] })
			.bindPopup(info + "<br><a href=\"rentals.html?suburb=" + slug + "\">See rentals here</a>");
	});
}

function runSearch(suburb, s) {
	["bus", "train", "ferry"].forEach(k => layerGroup(k).clearLayers());

	// Remove the previous suburb outline, if one exists
	if (currentBoundary) {
		myMap.removeLayer(currentBoundary);
		currentBoundary = null;
	}

	var boundaryURL = "https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/suburb-boundaries/records?where=suburb_name=%22" + encodeURIComponent(suburb.toUpperCase()) + "%22";

	// The Council only has outlines for its own suburbs, so elsewhere in Queensland go straight to the circle below
	return (s.bcc ? fetch(boundaryURL).then(response => response.json()) : Promise.resolve({ results: [] }))
		.then(data => {
			if (!data.results || data.results.length === 0) throw new Error("No boundary found for " + suburb);

			var suburbShape = data.results[0].geo_shape;

			// Draw the suburb outline on the map
			currentBoundary = L.geoJSON(suburbShape, {
				style: {
					color: "#08f",
					weight: 2,
					fillColor: "#08f",
					fillOpacity: 0.1
				}
			}).addTo(myMap);

			// Stops inside the suburb, using point-in-polygon
			addTransportMarkers(allStops, s, (lat, lon) => turf.booleanPointInPolygon(turf.point([lon, lat]), suburbShape));

			// Fit the map to the suburb boundary itself, rather than just the stops
			// This way it zooms to the whole suburb even if it has 0 or 1 stops
			myMap.fitBounds(currentBoundary.getBounds(), { padding: [5, 5] });
		})
		.catch(error => {
			// No boundary (outside Brisbane City Council, or the Council site is down): use a 1.5 km circle around the suburb centre instead
			if (s.bcc) console.error("Error fetching suburb boundary:", error);
			addTransportMarkers(allStops, s, (lat, lon) => SM.km(s, { lat: lat, lng: lon }) <= 1.5);
			myMap.setView([s.lat, s.lng], 14);
		});
}

