// function iterateRoutes(routesArray) {
// 	console.log("Routes returned: " + routesArray.length);
// 	routesArray.forEach(route => {
// 		var routeId = route["route_id"];
// 		var routeName = route["route_long_name"] || route["route_short_name"];
// 		if (routeId && routeName) {
// 			$("#records").append(
// 				$('<section class="record">').append(
// 					$('<h2>').text(routeName),
// 					$('<span>').text("Route ID: " + routeId),
// 				)
// 			);
// 		}
// 	});
// }

// $(document).ready(function() {
// 	var data = {};
// 	/*
// 	* Connecting to datasets on data.qld.gov.au
// 	* Base URL searches the datastore for the specified data resource (resource_id)
// 	* You will need the resource_id for the dataset you want to access
// 	*/
// 	const apiURL = "https://www.data.qld.gov.au/api/3/action/datastore_search";
// 	const requestParams = {
// 		resource_id: "9eaeeceb-e8e3-49a1-928a-4df76b059c2d",
// 		limit: 100,
// 		q: "queensland"
// 	}
// 	const queryString = new URLSearchParams(requestParams).toString(); //slightly convoluted way to construct the URL but can avoid typos
// 	const fullURL = apiURL + "?" + queryString;
// 	console.log("URL: " + fullURL);

// 	fetch(fullURL)
// 		.then(response => response.json())
// 		.then(data => iterateRecords(data))
// 		.catch(error => console.error("Error fetching data:", error));
// });

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

  document.title = s.name + ' – suburb.ly';
  $('#suburbName').textContent = s.name;
  $('#suburbSubtitle').textContent = s.fit + '% fit · ' + s.kmCbd.toFixed(1) + ' km from Brisbane CBD · Postcode ' + s.postcode;

  // Score bars
  $('#bars').innerHTML = SM.FACTORS.map(function (f) {
    const v = s.scores[f.key];
    return (
      '<div class="bar" data-factor="' + f.key + '">' +
        '<span class="bar__label"><span aria-hidden="true">' + f.emoji + '</span> ' + SM.esc(f.short) + '</span>' +
        '<span class="bar__track" aria-hidden="true"><span class="bar__fill" style="--score:' + v + '"></span></span>' +
        '<span class="bar__num">' + v + '/10</span>' +
      '</div>'
    );
  }).join('');

  // Amenities: live park names from the Brisbane City Council dataset, plus straight-line distances
  const chips = [];
  const dests = ['uq', 'qut', 'cbd'];
  dests.forEach(function (key) {
    const d = SM.DESTINATIONS[key];
    chips.push('<li class="chip">' + SM.km(s, d).toFixed(1) + ' km to ' + SM.esc(d.label) + '</li>');
  });
  const names = Array.from(new Set(s.parkNames)).slice(0, 10);
  names.forEach((n) => chips.push('<li class="chip">' + SM.icon('pin') + SM.esc(n) + '</li>'));
  $('#amenities').innerHTML = chips.join('');

  const info = data.parkInfo;
  if (s.parksLive) {
    const how = info.method === 'radius' ? 'within 1.5 km of the suburb centre' : 'in ' + s.name;
    $('#amenityNote').textContent = s.parkCount + ' parks ' + how + ' in Brisbane City Council\'s park dataset' +
      (names.length ? ' (first ' + names.length + ' shown)' : '') + '. Distances are straight-line, not travel time.';
  } else {
    $('#amenityNote').textContent = 'Park names are unavailable because live park data could not be loaded. Distances are straight-line, not travel time.';
  }

  $('#dataNotes').innerHTML = '<div class="notice notice--info">' + SM.dataNotes(info).map((t) => '<p>' + SM.esc(t) + '</p>').join('') + '</div>';

  // Rentals link
  const link = $('#rentalsLink');
  link.href = 'rentals.html?suburb=' + encodeURIComponent(s.slug);
  link.innerHTML = 'View rentals in ' + SM.esc(s.name) + ' <span aria-hidden="true">→</span>';

  // Save suburb
  const saveBtn = $('#saveBtn');
  const label = $('#saveLabel');
  function paintSave() {
    const saved = SM.getSaved('Suburbs').indexOf(s.slug) >= 0;
    saveBtn.setAttribute('aria-pressed', String(saved));
    label.textContent = saved ? 'Saved' : 'Save Suburb';
  }
  saveBtn.addEventListener('click', function () { SM.toggleSaved('Suburbs', s.slug); paintSave(); });
  paintSave();

  
})();

var allStops = []; // keeps full dataset in memory once loaded
var myMap; // keeps a reference to clear old markers between searches
var currentMarkers = []; // tracks markers so we can remove them on each new search
var currentBoundary = null; // tracks the suburb outline so we can remove it between searches

$(document).ready(function() {
	/*
	* This is a local copy of stops.txt, extracted from Translink's
	* GTFS zip (https://gtfsrt.api.translink.com.au/GTFS/SEQ_GTFS.zip).
	* Fetching it locally avoids the CORS restriction on Translink's server.
	*/
	fetch("data/stops.txt")
		.then(response => {
			if (!response.ok) {
				throw new Error("Failed to fetch routes.txt: " + response.status);
			}
			return response.text();
		})
		.then(routesCsvText => {
			var parsed = Papa.parse(routesCsvText, {
				header: true,
				skipEmptyLines: true
			});
			allStops = parsed.data; //stores full unfiltered dataset

			setupMap(); //creates empty map, ready for searches
			// var suburb = "Toowong"; // suburb
			// var filteredStops = parsed.data.filter(stop => {
			// 	return stop["stop_name"] && stop["stop_name"].toLowerCase().includes(suburb.toLowerCase());
			// })
			// iterateRoutes(filteredStops);
		})
		.catch(error => console.error("Error fetching GTFS data:", error));

	$("#search-button").on("click", function() {
		var suburb = $("#suburb-input").val().trim();
		if (suburb) {
			runSearch(suburb);
		}
	});

	//triggers search when pressing enter
	$("#suburb-input").on("keypress", function(e) {
		if (e.which === 13) {
			$("#search-button").click();
		}
	});
});

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

function runSearch(suburb) {
	currentMarkers.forEach(marker => myMap.removeLayer(marker));
	currentMarkers = [];

	// Remove the previous suburb outline, if one exists
	if (currentBoundary) {
		myMap.removeLayer(currentBoundary);
		currentBoundary = null;
	}

	var boundaryURL = "https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/suburb-boundaries/records?where=suburb_name=%22" + encodeURIComponent(suburb.toUpperCase()) + "%22";

	fetch(boundaryURL)
		.then(response => response.json())
		.then(data => {
			if (!data.results || data.results.length === 0) {
				alert("No boundary found for \"" + suburb + "\"");
				return;
			}

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

			// Filter stops using point-in-polygon
			var filteredStops = allStops.filter(stop => {
				var lat = parseFloat(stop["stop_lat"]);
				var lon = parseFloat(stop["stop_lon"]);
				if (isNaN(lat) || isNaN(lon)) return false;

				var point = turf.point([lon, lat]);
				return turf.booleanPointInPolygon(point, suburbShape);
			});

			console.log("Stops inside \"" + suburb + "\" boundary: " + filteredStops.length);

			var markerCoords = [];
			filteredStops.forEach(stop => {
				var lat = parseFloat(stop["stop_lat"]);
				var lon = parseFloat(stop["stop_lon"]);
				var marker = L.marker([lat, lon]).addTo(myMap);
				var popupText = "<strong>" + stop["stop_name"] + "</strong><br />" + (stop["stop_desc"] || "");
				marker.bindPopup(L.popup({ content: popupText, className: "mapUp" }));
				currentMarkers.push(marker);
				markerCoords.push([lat, lon]);
			});

			// Fit the map to the suburb boundary itself, rather than just the stops
			// This way it zooms to the whole suburb even if it has 0 or 1 stops
			myMap.fitBounds(currentBoundary.getBounds(), { padding: [10, 10] });

			if (markerCoords.length === 0) {
				alert("No stops found inside \"" + suburb + "\"");
			}
		})
		.catch(error => console.error("Error fetching suburb boundary:", error));
}