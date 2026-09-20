/* ==========================================================================
   SUBURB LIST
   lat/lng are approximate suburb centres (used for the map and distances).

   !! PLACEHOLDER SCORES !!
   The `sample` numbers (1–10) are made-up values so the demo works before the
   real datasets are connected. They are NOT real ratings of these suburbs.
   Replace them as each dataset comes online:
     afford    -> ABS Census housing costs (+ SEIFA)
     transport -> Translink GTFS
     safety    -> QPS crime statistics
     parks     -> already replaced by live Brisbane City Council data (see app.js)
   ========================================================================== */
window.SM = window.SM || {};
SM.SUBURBS = [
  { slug: 'toowong',          name: 'Toowong',          postcode: '4066', lat: -27.4845, lng: 152.9873, sample: { afford: 8, transport: 9,  safety: 8, parks: 7 } },
  { slug: 'st-lucia',         name: 'St Lucia',         postcode: '4067', lat: -27.4977, lng: 153.0137, sample: { afford: 6, transport: 7,  safety: 8, parks: 8 } },
  { slug: 'indooroopilly',    name: 'Indooroopilly',    postcode: '4068', lat: -27.5000, lng: 152.9740, sample: { afford: 5, transport: 8,  safety: 7, parks: 6 } },
  { slug: 'taringa',          name: 'Taringa',          postcode: '4068', lat: -27.4930, lng: 152.9820, sample: { afford: 7, transport: 7,  safety: 8, parks: 6 } },
  { slug: 'west-end',         name: 'West End',         postcode: '4101', lat: -27.4815, lng: 153.0090, sample: { afford: 5, transport: 8,  safety: 6, parks: 7 } },
  { slug: 'south-brisbane',   name: 'South Brisbane',   postcode: '4101', lat: -27.4808, lng: 153.0176, sample: { afford: 4, transport: 9,  safety: 6, parks: 8 } },
  { slug: 'kangaroo-point',   name: 'Kangaroo Point',   postcode: '4169', lat: -27.4735, lng: 153.0344, sample: { afford: 5, transport: 7,  safety: 7, parks: 7 } },
  { slug: 'fortitude-valley', name: 'Fortitude Valley', postcode: '4006', lat: -27.4570, lng: 153.0350, sample: { afford: 4, transport: 10, safety: 5, parks: 5 } },
  { slug: 'new-farm',         name: 'New Farm',         postcode: '4005', lat: -27.4680, lng: 153.0475, sample: { afford: 3, transport: 8,  safety: 7, parks: 9 } },
  { slug: 'paddington',       name: 'Paddington',       postcode: '4064', lat: -27.4595, lng: 152.9990, sample: { afford: 4, transport: 8,  safety: 7, parks: 5 } },
  { slug: 'milton',           name: 'Milton',           postcode: '4064', lat: -27.4700, lng: 153.0010, sample: { afford: 5, transport: 9,  safety: 7, parks: 5 } },
  { slug: 'kelvin-grove',     name: 'Kelvin Grove',     postcode: '4059', lat: -27.4490, lng: 153.0130, sample: { afford: 6, transport: 8,  safety: 7, parks: 6 } },
  { slug: 'woolloongabba',    name: 'Woolloongabba',    postcode: '4102', lat: -27.4890, lng: 153.0350, sample: { afford: 6, transport: 9,  safety: 6, parks: 4 } },
  { slug: 'annerley',         name: 'Annerley',         postcode: '4103', lat: -27.5090, lng: 153.0330, sample: { afford: 7, transport: 7,  safety: 6, parks: 5 } },
  { slug: 'coorparoo',        name: 'Coorparoo',        postcode: '4151', lat: -27.4990, lng: 153.0550, sample: { afford: 6, transport: 7,  safety: 8, parks: 6 } },
  { slug: 'chermside',        name: 'Chermside',        postcode: '4032', lat: -27.3860, lng: 153.0330, sample: { afford: 6, transport: 8,  safety: 6, parks: 6 } },
  { slug: 'nundah',           name: 'Nundah',           postcode: '4012', lat: -27.4030, lng: 153.0600, sample: { afford: 6, transport: 8,  safety: 7, parks: 6 } },
  { slug: 'sunnybank',        name: 'Sunnybank',        postcode: '4109', lat: -27.5780, lng: 153.0570, sample: { afford: 7, transport: 6,  safety: 7, parks: 5 } },
  { slug: 'mount-gravatt',    name: 'Mount Gravatt',    postcode: '4122', lat: -27.5400, lng: 153.0800, sample: { afford: 7, transport: 6,  safety: 7, parks: 6 } },
  { slug: 'carindale',        name: 'Carindale',        postcode: '4152', lat: -27.5040, lng: 153.1000, sample: { afford: 6, transport: 5,  safety: 8, parks: 7 } }
];
