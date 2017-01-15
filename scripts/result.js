console.log(AS);
console.log(prefixes);
var map;
function initMap() {
  var markers = [];//some array
  var bounds = new google.maps.LatLngBounds();
  map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: AS.locations[0].lat, lng: AS.locations[0].lng},
    zoom: 8,
    scrollwheel: false
  });

  AS.locations.forEach(location => {
    markers.push(new google.maps.Marker({
      position: {
        lat: location.lat,
        lng: location.lng
      },
      label: 'AS',
      map: map,
      title: AS.resource
    }));
  })

  for(let p = 0; p < prefixes.length; p++) {
    let prefix = prefixes[p];
    for(let h = 0; h < prefix.hosts.length; h++) {
      let host = prefix.hosts[h];
      host.locations.forEach(location => {
        if (location.lat != AS.locations[0].lat && location.lng != AS.locations[0].lng) {
          markers.push(new google.maps.Marker({
            position: {
              lat: location.lat,
              lng: location.lng
            },
            label: `P${p}H${h}`,
            map: map,
            title: host.host
          }));
        }
      })
    }
  }

  fitBounds();

  var infoWindow = new google.maps.InfoWindow({map: map});

  // Try HTML5 geolocation.
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      markers.push(new google.maps.Marker({
        position: {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        },
        map: map,
        label: 'Ja',
        title: 'Twoja pozycja'
      }));

      fitBounds();
    }, function() {
      handleLocationError(true, infoWindow, map.getCenter());
    });
  } else {
    // Browser doesn't support Geolocation
    handleLocationError(false, infoWindow, map.getCenter());
  }

  function fitBounds() {
    for (let i = 0; i < markers.length; i++) {
      bounds.extend(markers[i].getPosition());
    }
    map.fitBounds(bounds);
  }
}

function handleLocationError(browserHasGeolocation, infoWindow, pos) {
  infoWindow.setPosition(pos);
  infoWindow.setContent(browserHasGeolocation ?
                        'Error: The Geolocation service failed.' :
                        'Error: Your browser doesn\'t support geolocation.');
}
