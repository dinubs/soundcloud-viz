var SoundCloudAudioSource = function(player) {
    var self = this;
    var analyser;
    var contextClass = (window.AudioContext || 
                          window.webkitAudioContext || 
                          window.mozAudioContext || 
                          window.oAudioContext || 
                          window.msAudioContext);
    var audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    var source = audioCtx.createMediaElementSource(player);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    var sampleAudioStream = function() {
        analyser.getByteFrequencyData(self.streamData);
        // calculate an overall volume value
        var total = 0;
        for (var i = 0; i < 80; i++) { // get the volume from the first 80 bins, else it gets too loud with treble
            total += self.streamData[i];
        }
        self.volume = total;
    };
    setInterval(sampleAudioStream, 20);
    // public properties and methods
    this.volume = 0;
    this.streamData = new Uint8Array(128);
    this.playStream = function(streamUrl) {
        // get the input stream from the audio element
        player.addEventListener('ended', function(){
            this.directStream('forward');
        });
        player.setAttribute('src', streamUrl);
        player.play();
    }
};
/**
 * The Visualizer object, after being instantiated, must be initialized with the init() method,
 * which takes an options object specifying the element to append the canvases to and the audiosource which will
 * provide the data to be visualized.
 */
var Visualizer = function() {
    var tileSize;
    var tiles = [];
    var stars = [];
    // canvas vars
    var bgCanvas;
    var bgCtx;
    var audioSource;

    var drawBg = function() {
        bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        var r, g, b, a;
        var val = audioSource.volume/1000;
        r = 200 + (Math.sin(val) + 1) * 28;
        g = val * 2;
        b = val * 8;
        a = Math.sin(val+3*Math.PI/2) + 1;
        bgCtx.beginPath();
        bgCtx.rect(0, 0, bgCanvas.width, bgCanvas.height);
        // create radial gradient
        // var grd = bgCtx.createRadialGradient(bgCanvas.width/2, bgCanvas.height/2, val, bgCanvas.width/2, bgCanvas.height/2, bgCanvas.width-Math.min(Math.pow(val, 2.7), bgCanvas.width - 20));
        // grd.addColorStop(0, 'rgba(0,0,0,0)');// centre is transparent black
        // grd.addColorStop(0.8, "rgba(" +
        //     255 + ", " +
        //     102 + ", " +
        //     0 + ", 0.4)"); // edges are orangish

        // bgCtx.fillStyle = grd;
        // bgCtx.fill();

        for (var i = 0; i < (128 - 44); i++) {
            // var bucket = Math.ceil(audioSource.streamData.length/tiles.length*this.num);
            // var val = Math.pow((audioSource.streamData[bucket]/255),2)*255;
            var xVal = i / (128 - 44);
            var yVal = (audioSource.streamData[i] / 255) * (window.innerHeight / 2);
            var w = 10;
            bgCtx.fillStyle = "#fff";
            bgCtx.fillRect(xVal * window.innerWidth,0,w,yVal);
            bgCtx.fillRect(xVal * window.innerWidth,window.innerHeight,w,-1 * yVal);
            // console.log(audioSource.streamData[0]);

        };

        
        /*
         // debug data
         bgCtx.font = "bold 30px sans-serif";
         bgCtx.fillStyle = 'grey';
         bgCtx.fillText("val: " + val, 30, 30);
         bgCtx.fillText("r: " + r , 30, 60);
         bgCtx.fillText("g: " + g , 30, 90);
         bgCtx.fillText("b: " + b , 30, 120);
         bgCtx.fillText("a: " + a , 30, 150);*/
    };

    this.resizeCanvas = function() {
            // resize the bg canvas
            bgCanvas.width = window.innerWidth;
            bgCanvas.height = window.innerHeight;


            drawBg();
    };

    var draw = function() {
        
        // requestAnimationFrame(draw);
    };

    this.init = function(options) {
        audioSource = options.audioSource;
        var container = document.getElementById(options.containerId);

        // background image layer
        bgCanvas = document.createElement('canvas');
        bgCtx = bgCanvas.getContext("2d");
        container.appendChild(bgCanvas);

        this.resizeCanvas();
        draw();


        setInterval(drawBg, 100);
        // resize the canvas to fill browser window dynamically
        window.addEventListener('resize', this.resizeCanvas, false);
    };
};

/**
 * Makes a request to the Soundcloud API and returns the JSON data.
 */
var SoundcloudLoader = function(player,uiUpdater) {
    var self = this;
    var client_id = "df0fc74bb9715f17a6045e82a061cabe"; // to get an ID go to http://developers.soundcloud.com/
    this.sound = {};
    this.streamUrl = "";
    this.errorMessage = "";
    this.player = player;
    this.uiUpdater = uiUpdater;

    /**
     * Loads the JSON stream data object from the URL of the track (as given in the location bar of the browser when browsing Soundcloud),
     * and on success it calls the callback passed to it (for example, used to then send the stream_url to the audiosource object).
     * @param track_url
     * @param callback
     */
    this.loadStream = function(track_url, successCallback, errorCallback) {
        SC.initialize({
            client_id: client_id
        });
        SC.get('/resolve', { url: track_url }, function(sound) {
            if (sound.errors) {
                self.errorMessage = "";
                for (var i = 0; i < sound.errors.length; i++) {
                    self.errorMessage += sound.errors[i].error_message + '<br>';
                }
                self.errorMessage += 'Make sure the URL has the correct format: https://soundcloud.com/user/title-of-the-track';
                errorCallback();
            } else {

                if(sound.kind=="playlist"){
                    self.sound = sound;
                    self.streamPlaylistIndex = 0;
                    self.streamUrl = function(){
                        return sound.tracks[self.streamPlaylistIndex].stream_url + '?client_id=' + client_id;
                    }
                    successCallback();
                }else{
                    self.sound = sound;
                    self.streamUrl = function(){ return sound.stream_url + '?client_id=' + client_id; };
                    successCallback();
                }
            }
        });
    };


    this.directStream = function(direction){
        if(direction=='toggle'){
            if (this.player.paused) {
                this.player.play();
            } else {
                this.player.pause();
            }
        }
        else if(this.sound.kind=="playlist"){
            if(direction=='coasting') {
                this.streamPlaylistIndex++;
            }else if(direction=='forward') {
                if(this.streamPlaylistIndex>=this.sound.track_count-1) this.streamPlaylistIndex = 0;
                else this.streamPlaylistIndex++;
            }else{
                if(this.streamPlaylistIndex<=0) this.streamPlaylistIndex = this.sound.track_count-1;
                else this.streamPlaylistIndex--;
            }
            if(this.streamPlaylistIndex>=0 && this.streamPlaylistIndex<=this.sound.track_count-1) {
               this.player.setAttribute('src',this.streamUrl());
               this.uiUpdater.update(this);
               this.player.play();
            }
        }
    }


};

/**
 * Class to update the UI when a new sound is loaded
 * @constructor
 */
var UiUpdater = function() {
    var controlPanel = document.getElementById('controlPanel');
    var trackInfoPanel = document.getElementById('trackInfoPanel');
    var infoImage = document.getElementById('infoImage');
    var infoArtist = document.getElementById('infoArtist');
    var infoTrack = document.getElementById('infoTrack');
    var messageBox = document.getElementById('messageBox');

    this.clearInfoPanel = function() {
        // first clear the current contents
        infoArtist.innerHTML = "";
        infoTrack.innerHTML = "";
        trackInfoPanel.className = 'hidden';
    };
    this.update = function(loader) {
        // update the track and artist into in the controlPanel
        var artistLink = document.createElement('a');
        artistLink.setAttribute('href', loader.sound.user.permalink_url);
        artistLink.innerHTML = loader.sound.user.username;
        var trackLink = document.createElement('a');
        trackLink.setAttribute('href', loader.sound.permalink_url);

        if(loader.sound.kind=="playlist"){
            trackLink.innerHTML = "<p>" + loader.sound.tracks[loader.streamPlaylistIndex].title + "</p>" + "<p>"+loader.sound.title+"</p>";
        }else{
            trackLink.innerHTML = loader.sound.title;
        }

        var image = loader.sound.artwork_url ? loader.sound.artwork_url : loader.sound.user.avatar_url; // if no track artwork exists, use the user's avatar.
        infoImage.setAttribute('src', image);

        infoArtist.innerHTML = '';
        infoArtist.appendChild(artistLink);

        infoTrack.innerHTML = '';
        infoTrack.appendChild(trackLink);
        document.title = loader.sound.tracks[loader.streamPlaylistIndex].title

        // display the track info panel
        trackInfoPanel.className = '';

        // add a hash to the URL so it can be shared or saved
        var trackToken = loader.sound.permalink_url.substr(22);
    };
    this.toggleControlPanel = function() {
        if (controlPanel.className.indexOf('hidden') === 0) {
            controlPanel.className = '';
        } else {
            controlPanel.className = 'hidden';
        }
    };
    this.displayMessage = function(title, message) {
        messageBox.innerHTML = ''; // reset the contents

        var titleElement = document.createElement('h3');
        titleElement.innerHTML = title;
        document.title = title;

        var messageElement = document.createElement('p');
        messageElement.innerHTML = message;

        var closeButton = document.createElement('a');
        closeButton.setAttribute('href', '#');
        closeButton.innerHTML = 'close';
        closeButton.addEventListener('click', function(e) {
            e.preventDefault();
            messageBox.className = 'hidden';
        });

        messageBox.className = '';
        // stick them into the container div
        messageBox.appendChild(titleElement);
        messageBox.appendChild(messageElement);
        messageBox.appendChild(closeButton);
    };
};

window.onload = function init() {

    var visualizer = new Visualizer();
    var player =  document.getElementById('player');
    var uiUpdater = new UiUpdater();
    var loader = new SoundcloudLoader(player,uiUpdater);

    var audioSource = new SoundCloudAudioSource(player);
    var form = document.getElementById('form');
    var loadAndUpdate = function(trackUrl) {
        loader.loadStream(trackUrl,
            function() {
                uiUpdater.clearInfoPanel();
                audioSource.playStream(loader.streamUrl());
                uiUpdater.update(loader);
                setTimeout(uiUpdater.toggleControlPanel, 3000); // auto-hide the control panel
            },
            function() {
                uiUpdater.displayMessage("Error", loader.errorMessage);
            });
    };

    visualizer.init({
        containerId: 'visualizer',
        audioSource: audioSource
    });


    uiUpdater.toggleControlPanel();
    // on load, check to see if there is a track token in the URL, and if so, load that automatically
    if (window.location.hash) {
        var trackUrl = 'https://soundcloud.com/radcircle/sets/radcircle-january-2013-top-13';
        loadAndUpdate(trackUrl);
    }

    var toggleButton = document.getElementById('toggleButton')
    toggleButton.addEventListener('click', function(e) {
        e.preventDefault();
        uiUpdater.toggleControlPanel();
    });

    window.addEventListener("keydown", keyControls, false);
     
    function keyControls(e) {
        switch(e.keyCode) {
            case 32:
                // spacebar pressed
                loader.directStream('toggle');
                break;
            case 37:
                // left key pressed
                loader.directStream('backward');
                break;
            case 39:
                // right key pressed
                loader.directStream('forward');
                break;
        }   
    }
    var trackUrl = 'https://soundcloud.com/radcircle/sets/radcircle-january-2013-top-13';
    loadAndUpdate(trackUrl);
};