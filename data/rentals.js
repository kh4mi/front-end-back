/* ==========================================================================
   SAMPLE RENTAL LISTINGS
   !! These are made-up listings so the "Find a Rental" screens work. !!
   Addresses are fictional. To go live, replace this file's data with results
   from a listings API (see README.md, "Rental listings").
   Fields: suburb = slug from suburbs.js, price = $ per week.
   ========================================================================== */
window.SM = window.SM || {};
SM.RENTALS = [
  { id: 'r01', suburb: 'toowong',          street: '12 Sample Street',   type: 'Apartment', price: 520, beds: 2, baths: 1, cars: 1 },
  { id: 'r02', suburb: 'toowong',          street: '4/8 Example Road',   type: 'Unit',      price: 470, beds: 1, baths: 1, cars: 1 },
  { id: 'r03', suburb: 'st-lucia',         street: '27 Demo Avenue',     type: 'House',     price: 780, beds: 4, baths: 2, cars: 2 },
  { id: 'r04', suburb: 'st-lucia',         street: '9/15 Placeholder Pde', type: 'Apartment', price: 430, beds: 1, baths: 1, cars: 0 },
  { id: 'r05', suburb: 'west-end',         street: '31 Sample Lane',     type: 'Townhouse', price: 650, beds: 3, baths: 2, cars: 1 },
  { id: 'r06', suburb: 'south-brisbane',   street: '2204/40 Example Quay', type: 'Apartment', price: 690, beds: 2, baths: 2, cars: 1 },
  { id: 'r07', suburb: 'indooroopilly',    street: '18 Demo Terrace',    type: 'House',     price: 720, beds: 3, baths: 1, cars: 2 },
  { id: 'r08', suburb: 'kelvin-grove',     street: '6/22 Sample Close',  type: 'Unit',      price: 495, beds: 2, baths: 1, cars: 1 },
  { id: 'r09', suburb: 'nundah',           street: '55 Placeholder Rd',  type: 'House',     price: 610, beds: 3, baths: 1, cars: 1 },
  { id: 'r10', suburb: 'coorparoo',        street: '3/70 Example Street', type: 'Townhouse', price: 640, beds: 3, baths: 2, cars: 2 },
  { id: 'r11', suburb: 'chermside',        street: '14 Demo Court',      type: 'Apartment', price: 450, beds: 2, baths: 1, cars: 1 },
  { id: 'r12', suburb: 'annerley',         street: '90 Sample Parade',   type: 'House',     price: 560, beds: 2, baths: 1, cars: 1 },
  { id: 'r13', suburb: 'fortitude-valley', street: '1108/25 Example St', type: 'Apartment', price: 590, beds: 1, baths: 1, cars: 1 },
  { id: 'r14', suburb: 'sunnybank',        street: '7 Placeholder Place', type: 'House',    price: 540, beds: 3, baths: 2, cars: 2 }
];
