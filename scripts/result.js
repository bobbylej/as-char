console.log(AS);
console.log(prefixes);

var map;
var markers = [];
var markerYou;
function initMap() {
  var bounds = new google.maps.LatLngBounds();
  map = new google.maps.Map(document.getElementById('map'), {
    center: {
      lat: AS.locations[0].lat,
      lng: AS.locations[0].lng
    },
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
      addMarker(host, p);
    }
  }

  let markersCoordinates = new Array();
  markers.forEach(marker => {
    markersCoordinates.push({
      lat: marker.getPosition().lat(),
      lng: marker.getPosition().lng()
    });
  });
  if(markers.length > 2) {
    markersCoordinates.push({
      lat: markers[0].getPosition().lat(),
      lng: markers[markers.length-1].getPosition().lng()
    });
  }
  let path = new google.maps.Polyline({
    path: markersCoordinates,
    geodesic: true,
    strokeColor: '#FF0000',
    strokeOpacity: 1.0,
    strokeWeight: 2
  });

  path.setMap(map);

  // Try HTML5 geolocation.
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      markerYou = new google.maps.Marker({
        position: {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        },
        map: map,
        label: 'Ty',
        title: 'Twoja pozycja'
      });
      fitBounds();
      countDistances();
    }, function() {
      handleLocationError(true, infoWindow, map.getCenter());
    });
  } else {
    // Browser doesn't support Geolocation
    handleLocationError(false, infoWindow, map.getCenter());
  }

  fitBounds();

  function fitBounds() {
    if (markerYou) {
      bounds.extend(markerYou.getPosition());
    }
    for (let i = 0; i < markers.length; i++) {
      bounds.extend(markers[i].getPosition());
    }
    map.fitBounds(bounds);
  }
}

function addMarker(host, prefixIndex) {
  for (let l = 0; l < host.locations.length; l++) {
    let location = host.locations[l];
    let wasAdded = false;
    for (let i = 0; i < markers.length; i++) {
      if (isSamePosition(markers[i].getPosition(), location)) {
        wasAdded = true;
        markers[i].setTitle(markers[i].getTitle() + ', ' + host.host);
        let label = markers[i].getLabel();
        if (label.indexOf(prefixIndex) == -1) {
          if (label.indexOf('AS') != -1) {
            label = label + `, ${prefixIndex}`;
          } else {
            label = label.replace(')', `, ${prefixIndex})`);
          }
          markers[i].setLabel(label);
        }
      }
    }
    if (!wasAdded) {
      markers.push(new google.maps.Marker({
        position: {
          lat: location.lat,
          lng: location.lng
        },
        label: `IP(${prefixIndex})`,
        map: map,
        title: host.host
      }));
    }
  }
}

function countDistances() {
  let yourPos = {
    lat: markerYou.getPosition().lat(),
    lng: markerYou.getPosition().lng()
  };
  markers.forEach(marker => {
    let markerPos = {
      lat: marker.getPosition().lat(),
      lng: marker.getPosition().lng()
    };
    let distance = getDistance(yourPos, markerPos);
    writeDistance(marker, distance);
  });
}

function writeDistance(marker, distance) {
  let ids = marker.getTitle().split(', ');
  ids.forEach(id => {
    document.getElementById(id).innerHTML = round2Decimal(distance) + ' km';
  })
}

function isSamePosition(googleLoc, loc) {
  return round2Decimal(googleLoc.lat()) == round2Decimal(loc.lat)
          && round2Decimal(googleLoc.lng()) == round2Decimal(loc.lng);
}

function round2Decimal(num) {
  return Math.round(num * 100) / 100;
}

function getDistance(pos1, pos2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(pos2.lat-pos1.lat);  // deg2rad below
  var dLon = deg2rad(pos2.lng-pos1.lng);
  var a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(pos1.lat)) * Math.cos(deg2rad(pos2.lat)) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ;
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

function handleLocationError(browserHasGeolocation, infoWindow, pos) {
  infoWindow.setPosition(pos);
  infoWindow.setContent(browserHasGeolocation ?
                        'Error: The Geolocation service failed.' :
                        'Error: Your browser doesn\'t support geolocation.');
}
