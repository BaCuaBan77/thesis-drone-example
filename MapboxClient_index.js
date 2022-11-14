window.mapboxgl.accessToken = 'token';
var videoStyle = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      url: 'mapbox://mapbox.satellite',
      tileSize: 256,
    },
    video: {
      type: 'video',
      urls: ['./drone-footage.mp4'],
      coordinates: [
        [27.255869, 61.682161],
        [27.25692, 61.682351],
        [27.257105, 61.682122],
        [27.25611, 61.681934],
      ],
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': 'rgb(4,7,14)',
      },
    },
    {
      id: 'satellite',
      type: 'raster',
      source: 'satellite',
    },
    {
      id: 'image',
      type: 'raster',
      source: 'video',
      paint: {
        'raster-fade-duration': 0,
      },
    },
  ],
};

var map = new mapboxgl.Map({
  container: 'map',
  minZoom: 14,
  zoom: 15,
  center: [27.25611, 61.681934],
  bearing: -20,
  style: videoStyle,
});

var playingVideo = true;

var websocket = new WebSocket('ws://172.20.10.4:38301');
websocket.onmessage = function (event) {
  console.log(event.data);
  const degToRad = Math.PI / 180;
  const radToDeg = 180 / Math.PI;
  var allData = event.data.split(',');
  var lat = allData[0] * degToRad;
  var lon = allData[1] * degToRad;
  var alt = allData[2] * 1;
  var yawValue = allData[3] * 1;

  // Const to convert Degree to Radians

  //Angle of Camera view in tan
  const angleOfCamera = 0.7071875;

  // Radius of Earth
  const R = 6371;

  var droneSource = map.getSource('video');
  if (
    lat &&
    lon &&
    alt &&
    yawValue &&
    lat.toString() !== 'NaN' &&
    lon.toString() !== 'NaN' &&
    alt.toString() !== 'NaN' &&
    yawValue.toString() !== 'NaN'
  ) {
    // distance from center to edges in kilometers
    var distanceFromLocation = (alt * angleOfCamera) / 1000;

    // Bearing of edges
    var bearingEdge1 = (yawValue - 60) * degToRad;
    var bearingEdge2 = (yawValue + 60) * degToRad;
    var bearingEdge3 = (yawValue + 120) * degToRad;
    var bearingEdge4 = (yawValue - 120) * degToRad;

    // Lat of edges
    var latEdge1 =
      radToDeg *
      Math.asin(
        Math.sin(lat) * Math.cos(distanceFromLocation / R) +
          Math.cos(lat) *
            Math.sin(distanceFromLocation / R) *
            Math.cos(bearingEdge1)
      );
    var latEdge2 =
      radToDeg *
      Math.asin(
        Math.sin(lat) * Math.cos(distanceFromLocation / R) +
          Math.cos(lat) *
            Math.sin(distanceFromLocation / R) *
            Math.cos(bearingEdge2)
      );
    var latEdge3 =
      radToDeg *
      Math.asin(
        Math.sin(lat) * Math.cos(distanceFromLocation / R) +
          Math.cos(lat) *
            Math.sin(distanceFromLocation / R) *
            Math.cos(bearingEdge3)
      );
    var latEdge4 =
      radToDeg *
      Math.asin(
        Math.sin(lat) * Math.cos(distanceFromLocation / R) +
          Math.cos(lat) *
            Math.sin(distanceFromLocation / R) *
            Math.cos(bearingEdge4)
      );

    // Lon of edges
    var lonEdge1 =
      lon +
      Math.atan2(
        Math.sin(bearingEdge1) *
          Math.sin(distanceFromLocation / R) *
          Math.cos(lat),
        Math.cos(distanceFromLocation / R) -
          Math.sin(lat) * Math.sin(latEdge1 * degToRad)
      );
    var lonEdge2 =
      lon +
      Math.atan2(
        Math.sin(bearingEdge2) *
          Math.sin(distanceFromLocation / R) *
          Math.cos(lat),
        Math.cos(distanceFromLocation / R) -
          Math.sin(lat) * Math.sin(latEdge2 * degToRad)
      );
    var lonEdge3 =
      lon +
      Math.atan2(
        Math.sin(bearingEdge3) *
          Math.sin(distanceFromLocation / R) *
          Math.cos(lat),
        Math.cos(distanceFromLocation / R) -
          Math.sin(lat) * Math.sin(latEdge3 * degToRad)
      );
    var lonEdge4 =
      lon +
      Math.atan2(
        Math.sin(bearingEdge4) *
          Math.sin(distanceFromLocation / R) *
          Math.cos(lat),
        Math.cos(distanceFromLocation / R) -
          Math.sin(lat) * Math.sin(latEdge4 * degToRad)
      );
    console.log(
      'lat edges: ' +
        latEdge1 +
        ', ' +
        latEdge2 +
        ', ' +
        latEdge3 +
        ', ' +
        latEdge4 +
        ', '
    );

    console.log(
      'lon edges: ' +
        lonEdge1 +
        ', ' +
        lonEdge2 +
        ', ' +
        lonEdge3 +
        ', ' +
        lonEdge4 +
        ', '
    );

    droneSource.setCoordinates([
      [lonEdge1 * radToDeg, latEdge1],
      [lonEdge2 * radToDeg, latEdge2],
      [lonEdge3 * radToDeg, latEdge3],
      [lonEdge4 * radToDeg, latEdge4],
    ]);
  }
};

map.on('click', function () {
  playStream();

  //playingVideo = !playingVideo;

  //let video = map.getSource("video").video;

  //if (playingVideo) map.getSource("video").play();
  //else map.getSource("video").pause();
});

function playStream() {
  const pc = new RTCPeerConnection({
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  });

  pc.onaddstream = function (event) {
    console.debug('onaddstream');
    addRemoteVideo(event.stream);
  };

  pc.onremovestream = function (event) {
    console.debug('onremovestream');
    removeRemoteVideo();
  };

  pc.createOffer({
    offerToReceiveVideo: true,
    offerToReceiveAudio: false,
  })
    .then(function (offer) {
      console.debug('createOffer sucess', offer);

      pc.setLocalDescription(offer);

      axios
        .post('http://172.20.10.3:4001/watch/live', {
          offer: offer.sdp,
        })
        .then(function (response) {
          console.log(response.data);
          let answerStr = response.data.answer;
          let answer = new RTCSessionDescription({
            type: 'answer',
            sdp: answerStr,
          });

          pc.setRemoteDescription(
            answer,
            function () {
              console.log('setRemoteDescription');
            },
            function (error) {
              console.log('setRemoteDescription', error);
            }
          );
        })
        .catch(function (error) {
          console.log(error);
        });
    })
    .catch(function (error) {
      console.error('error', error);
    });
}

function addRemoteVideo(stream) {
  let element = map.getSource('video').video;
  //element.width = 1280;
  //element.height = 720;
  //element.setAttribute("playsinline", true);
  //element.setAttribute("autoplay", true);
  element.srcObject = stream;
  //element.controls = false;
}
