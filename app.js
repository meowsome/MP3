var express = require('express');
var path = require('path');
var multer = require('multer');
var fs = require('fs');
var Genius  = require('genius-lyrics');
require('dotenv').config();
var Client = new Genius.Client(process.env.GENIUS);
var image_download = require('image-downloader');
var NodeID3 = require('node-id3');

var app = express();
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.set('port', (process.env.PORT || 3000));
app.listen(app.get('port'), function () {
    console.log('Server started on port ' + app.get('port'));
});

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, '/public/index.html'));
})

app.get('/about', function (req, res) {
    res.sendFile(path.join(__dirname, '/public/about.html'));
})

var storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, process.env.SAVEFOLDER);
    },
    filename: function (req, file, callback) {
        callback(null, file.originalname);
    }
});

var upload = multer({
    storage: storage,
    limits: {
        fileSize: 25000000
    }
});

//Note: All these will contain data from multiple sessions
var fileFull = [];
var fileName = [];
var song = {
    name: [],
    artist: [],
    album: [],
    genre: [],
    track: [],
    albumArt: []
};

app.post('/upload', upload.single('uploadFile'), function (req, res, next) {
    if (req.file == "undefined" || req.file == undefined) {
        console.log("No file detected");
        res.status(500).send("No file detected, please try again.");
    } else if (!req.file.filename.includes("mp3")) {
        res.status(500).send("File must have a .mp3 extension, please try again.")
    } else {
        fileName.push(req.file.filename.replace(/.mp3/gi, ""));
        fileFull.push(req.file.filename);
        search(req, res, req.file.filename.replace(/.mp3/gi, ""), true);
    }
});

app.post('/search', upload.single('query'), function (req, res) {
    search(req, res, req.body.query, false);
});

app.post('/removesession', upload.single('name'), function (req, res) {
    removeSession(req.body.name);
});

function search(req, res, searchTerm, pushToSongArray) {
    //If no song found, search genius for stripped search term
    Client.songs.search(searchTerm).then(async function (data) {
        if (data.length == 0) {
            res.status(404).send("No results found");
        } else {
            data = await fetchAllData(data);
            
            fetchData("genius", req, res, data, pushToSongArray);
        }
    }).catch(function (err) {
        console.log(err);
        res.status(500).send("Error searching databases");
    });
}

function fetchData(service, req, res, data, pushToSongArray) {
    var songAlts = [];
    var songReorganized;

    //Remove old song data from song tracker
    if (pushToSongArray && song.name.length > 0) removeSession(data[0].title);

    //Push new song data to song tracker (ONLY if this is the first confirmation)
    if (pushToSongArray) addSession(data[0].featuredTitle, data[0]._raw.primary_artist.name, data[0].album.name, "", "", data[0]._raw.header_image_url);

    //Find index of the file to find
    var fileNum;
    for (let i = 0; i < song.name.length; i++) {
        let originalName = clearCharas(song.name[i]);
        let newName = clearCharas(data[0].title);
        if (originalName.toLowerCase().indexOf(newName.toLowerCase()) > -1) {
            fileNum = i;
            break;
        }
    }

    //Reorganize song data for the client
    songReorganized = {
        originalName: fileName[fileNum],
        name: data[0].featuredTitle,
        artist: data[0]._raw.primary_artist.name,
        album: data[0].album.name,
        albumArt: data[0]._raw.header_image_url,
    }

    for (let i = 0; i < data.length; i++) {
        songAlts.push({
            "name": data[i].featuredTitle,
            "artist": data[i]._raw.primary_artist.name,
            "album": data[i].title,
            "albumArt": data[i]._raw.header_image_url
        });
    }

    res.status(200).send({
        songReorganized,
        songAlts
    });
}



app.post('/confirmation', upload.single('song'), function (req, res) {
    //ONLY if this is the second confirmation, push new song data to song tracker
    if (req.body.confirmation == 2) {
        addSession(req.body.name, req.body.artist, req.body.album, req.body.genre, req.body.track, req.body.albumArt);
        
        finishUp();
    } else {
        finishUp();
    }

    function finishUp() {
        //Get index that will be used to find the current client's song later on (both for song array and file arrays)
        var indexNum;
        for (let i = 0; i < song.name.length; i++) {
            if (song.name[i].toLowerCase().indexOf(req.body.name.toLowerCase()) > -1) {
                indexNum = i;
                break;
            }
        }
        var fileIndexNum;
        for (let i = 0; i < fileName.length; i++) {
            if (fileName[i].toLowerCase().indexOf(req.body.originalName.toLowerCase()) > -1) {
                fileIndexNum = i;
                break;
            }
        }

        //Prepare final data to be used later on in appending the data to the file
        var dataMeta = {
            title: song.name[indexNum],
            artist: song.artist[indexNum],
            album: song.album[indexNum],
            APIC: `${process.env.SAVEFOLDER}/${song.name[indexNum]}.jpg`
        }
        if (song.genre[indexNum] != "") dataMeta.genre = song.genre[indexNum];
        if (song.track[indexNum] != "") dataMeta.trackNumber = song.track[indexNum];
        var finalFileLocation = `${process.env.SAVEFOLDER}/${dataMeta.title.replace(/[&?\/]/g, '_')}.mp3`;

        //Begin process of appending meta data to the file
        //Download image
        image_download.image({
                url: song.albumArt[indexNum],
                dest: `${process.env.SAVEFOLDER}/${song.name[indexNum]}.jpg`,
            })
            .then(({
                filename,
                image
            }) => {
                //Rename file
                fs.rename(`${process.env.SAVEFOLDER}/${fileFull[fileIndexNum]}`, finalFileLocation, function (err) {
                    if (err) {
                        console.log(err);
                        res.status(500).send("An error has occurred while renaming the file");
                        removeSession(req.body.name);
                        removeFileSession(req.body.originalName);
                        return;
                    }
                    //Attempt to find renamed file again
                    NodeID3.read(finalFileLocation, function (err) {
                        if (err) {
                            console.log(err);
                            res.status(500).send("An error has occurred while locating the file");
                            removeSession(req.body.name);
                            removeFileSession(req.body.originalName);
                            return;
                        }
                        //Write meta data to the file
                        NodeID3.write(dataMeta, finalFileLocation, function (err) {
                            if (err) {
                                console.log(err);
                                res.status(500).send("An error has occurred while writing the info to the file");
                                removeSession(req.body.name);
                                removeFileSession(req.body.originalName);
                                return;
                            }

                            //Open up the download link for this client and attempt to download the file when they visit the link
                            app.get('/download/:songName', (req, res) => {
                                res.download(`${process.env.SAVEFOLDER}/${req.params.songName}.mp3`);
                            });

                            //Tell the client it's okay to go to the download link now
                            res.status(200).send(dataMeta.title);

                            //Wait 1 second and then remove song from song tracker array and file arrays
                            setTimeout(function () {
                                removeSession(req.body.name);

                                removeFileSession(req.body.originalName);
                            }, 1000);
                        });
                    });
                });
            }).catch((err) => {
                console.log(err);
                res.status(500).send("An error occurred while downloading the album art to the server");
                //removeFileFromSessionArray(indexNum, fileIndexNum);
                return;
            });
      }
});

function addSession(name, artist, album, genre, track, albumArt) {
    song.name.push(name);
    song.artist.push(artist);
    song.album.push(album);
    if (genre != "" && genre != null && genre != undefined) song.genre.push(genre);
    else song.genre.push("");
    if (track != "" && track != null && track != undefined) song.track.push(track);
    else song.track.push("");
    song.albumArt.push(albumArt);
}

function removeSession(comparisonString) {
    for (let i = 0; i < song.name.length; i++) {
        if (song.name[i].toLowerCase().indexOf(comparisonString.toLowerCase()) > -1) {
            song.name.splice(i, 1);
            song.artist.splice(i, 1);
            song.album.splice(i, 1);
            song.genre.splice(i, 1);
            song.track.splice(i, 1);
            song.albumArt.splice(i, 1);
            break;
        }
    }
}

function removeFileSession(comparisonString) {
    for (let i = 0; i < fileName.length; i++) {
        if (fileName[i].toLowerCase().indexOf(comparisonString.toLowerCase()) > -1) {
            fileName.splice(i, 1);
            fileFull.splice(i, 1);
            break;
        }
    }
}

function clearCharas(text) {
  return text.replace(/[\W_]+/g,"");
}

async function fetchAllData(data) {
    var data = await data.map(async song => await song.fetch()); // Fetch all song details
    return Promise.all(data);
}