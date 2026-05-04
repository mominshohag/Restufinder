// Pre-defined areas with their center coordinates
// Organized as City → Area → { lat, lng }
const LOCATIONS = {
  Dhaka: {
    Uttara:        { lat: 23.8759, lng: 90.3795 },
    Mirpur:        { lat: 23.8223, lng: 90.3654 },
    Gulshan:       { lat: 23.7808, lng: 90.4142 },
    Banani:        { lat: 23.7937, lng: 90.4066 },
    Dhanmondi:     { lat: 23.7461, lng: 90.3742 },
    Mohammadpur:   { lat: 23.7647, lng: 90.3585 },
    Bashundhara:   { lat: 23.8161, lng: 90.4254 },
    Badda:         { lat: 23.7810, lng: 90.4330 },
    Rampura:       { lat: 23.7646, lng: 90.4249 },
    Mohakhali:     { lat: 23.7771, lng: 90.4026 },
    Tejgaon:       { lat: 23.7607, lng: 90.3922 },
    Motijheel:     { lat: 23.7330, lng: 90.4182 },
    Shyamoli:      { lat: 23.7715, lng: 90.3614 },
    'Old Dhaka':   { lat: 23.7104, lng: 90.4074 },
    Khilgaon:      { lat: 23.7488, lng: 90.4339 },
    Wari:          { lat: 23.7200, lng: 90.4100 },
    Narayanganj:   { lat: 23.6238, lng: 90.4997 },
    Gazipur:       { lat: 23.9999, lng: 90.4203 },
  },
  Chittagong: {
    'GEC Circle':  { lat: 22.3569, lng: 91.8341 },
    Agrabad:       { lat: 22.3300, lng: 91.8326 },
    Nasirabad:     { lat: 22.3700, lng: 91.8100 },
    Halishahar:    { lat: 22.3500, lng: 91.7900 },
    Khulshi:       { lat: 22.3750, lng: 91.8300 },
    Panchlaish:    { lat: 22.3650, lng: 91.8200 },
    'Oxygen More': { lat: 22.4050, lng: 91.8000 },
    Chawkbazar:    { lat: 22.3300, lng: 91.8400 },
  },
  Sylhet: {
    Zindabazar:         { lat: 24.8949, lng: 91.8687 },
    Ambarkhana:         { lat: 24.8900, lng: 91.8800 },
    'Shahjalal Upashahar': { lat: 24.9050, lng: 91.8550 },
    Shibganj:           { lat: 24.8800, lng: 91.8600 },
    Uposhohor:          { lat: 24.9000, lng: 91.8650 },
  },
  Rajshahi: {
    'Shaheb Bazar': { lat: 24.3636, lng: 88.6241 },
    Kazla:          { lat: 24.3700, lng: 88.6100 },
    Uposhohor:      { lat: 24.3800, lng: 88.6300 },
    Boalia:         { lat: 24.3600, lng: 88.6150 },
  },
  Khulna: {
    'Khulna City': { lat: 22.8456, lng: 89.5403 },
    Boyra:         { lat: 22.8600, lng: 89.5600 },
    Sonadanga:     { lat: 22.8350, lng: 89.5500 },
    Khalishpur:    { lat: 22.8200, lng: 89.5300 },
  },
  Comilla: {
    'Kandirpar':   { lat: 23.4607, lng: 91.1809 },
    'Tomsom Bridge': { lat: 23.4500, lng: 91.1700 },
    Chowddagram:   { lat: 23.3800, lng: 91.1500 },
  },
  'Cox\'s Bazar': {
    'Cox\'s Bazar Town': { lat: 21.4272, lng: 92.0058 },
    Kolatoli:            { lat: 21.4100, lng: 92.0050 },
    Sugandha:            { lat: 21.4300, lng: 92.0100 },
  },
};

export default LOCATIONS;
