var express = require('express');
var path = require('path');
var multer = require('multer');
var fs = require('fs');
var ffmetadata = require('ffmetadata');
var songSearch = require('song-search');
var api = require('genius-api');
var genius = new api(process.env.GENIUS);
var image_download = require('image-downloader');
require('dotenv').config();

var app = express();
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.set('port', (process.env.PORT || 3000));
app.listen(app.get('port'), function () {
    console.log('Server started on port ' + app.get('port'));
});

console.log(process.env.GENIUS, process.env.YOUTUBE);

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, '/public/index.html'));
})

app.get('/about', function (req, res) {
    res.sendFile(path.join(__dirname, '/public/about.html'));
})

var storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, '/tmp');
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
    disc: [],
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
    //Initial song search for either file upload or search term
    console.log(process.env.YOUTUBE);
    songSearch.search({
        search: searchTerm,
        limit: 20,
        itunesCountry: 'us',
        youtubeAPIKey: process.env.YOUTUBE,
    }, function (err, data) {
        if (err) {
            console.log(err);
            //If no song found, strip search term of excess & try again
            searchTerm = searchTerm.replace(/\d|-|lyric|lyrics|music video|mv|C:\\fakepath\\|\s*\(.*?\)\s*|\s*\[.*?\]\s*/gi, "");
            songSearch.search({
                search: searchTerm,
                limit: 20,
                itunesCountry: 'us',
                youtubeAPIKey: process.env.YOUTUBE,
            }, function (err, data) {
                if (err) {
                    console.log(err);
                    //If no song found, search genius for stripped search term
                    genius.search(searchTerm).then(function (data) {
                        if (data.hits.length == 0) {
                            res.status(404).send("No results found");
                        } else {
                            fetchData("genius", req, res, data, pushToSongArray);
                        }
                    }).catch(function (err) {
                        console.log(err);
                        res.status(500).send("Error searching databases");
                    });
                } else {
                    fetchData("yt", req, res, data, pushToSongArray);
                }
            });
        } else {
            fetchData("yt", req, res, data, pushToSongArray);
        }
    });
}

function fetchData(service, req, res, data, pushToSongArray) {
    var songAlts = [];
    var songReorganized;

    if (service == "yt") {
        //Remove old song data from song tracker
        if (pushToSongArray && song.name.length > 0) removeSession(data[0].title);

        //Push new song data to song tracker (ONLY if this is the first confirmation)
        if (pushToSongArray) addSession(data[0].title, data[0].artist, data[0].album, data[0].genre, data[0].trackNumber, data[0].discNumber, data[0].coverUrl);

        //Find index of the file to find
        var fileNum;
        for (let i = 0; i < song.name.length; i++) {
            if (song.name[i].toLowerCase().indexOf(data[0].title.toLowerCase()) > -1) {
                fileNum = i;
                break;
            }
        }

        //Reorganize song data for the client
        songReorganized = {
            originalName: fileName[fileNum],
            name: data[0].title,
            artist: data[0].artist,
            album: data[0].album,
            genre: data[0].genre,
            track: data[0].trackNumber,
            disc: data[0].discNumber,
            albumArt: data[0].coverUrl,
        }

        for (let i = 0; i < data.length; i++) {
            songAlts.push({
                "name": data[i].title,
                "artist": data[i].artist,
                "album": data[i].album,
                "genre": data[i].genre,
                "track": data[i].trackNumber,
                "disc": data[i].discNumber,
                "albumArt": data[i].coverUrl
            });
        }
    } else {
        //Remove old song data from song tracker
        if (pushToSongArray && song.name.length > 0) removeSession(data.hits[0].result.title);

        //Push new song data to song tracker (ONLY if this is the first confirmation)
        if (pushToSongArray) addSession(data.hits[0].result.title_with_featured, data.hits[0].result.primary_artist.name, data.hits[0].result.title, "", "", "", data.hits[0].result.header_image_url);

        //Find index of the file to find
        var fileNum;
        for (let i = 0; i < song.name.length; i++) {
            if (song.name[i].toLowerCase().indexOf(data.hits[0].result.title.toLowerCase()) > -1) {
                fileNum = i;
                break;
            }
        }

        //Reorganize song data for the client
        songReorganized = {
            originalName: fileName[fileNum],
            name: data.hits[0].result.title_with_featured,
            artist: data.hits[0].result.primary_artist.name,
            album: data.hits[0].result.title,
            albumArt: data.hits[0].result.header_image_url,
        }

        for (let i = 0; i < data.hits.length; i++) {
            songAlts.push({
                "name": data.hits[i].result.title_with_featured,
                "artist": data.hits[i].result.primary_artist.name,
                "album": data.hits[i].result.title,
                "albumArt": data.hits[i].result.header_image_url
            });
        }
    }

    res.status(200).send({
        songReorganized,
        songAlts
    });
}



app.post('/confirmation', upload.single('song'), function (req, res) {
    //ONLY if this is the second confirmation, push new song data to song tracker
    if (req.body.confirmation == 2) {
        addSession(req.body.name, req.body.artist, req.body.album, req.body.genre, req.body.track, req.body.disc, req.body.albumArt);
        
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
        var dataImage = {
            attachments: [`/tmp/${song.name[indexNum]}.jpg`],
        }
        var dataMeta = {
            title: song.name[indexNum],
            artist: song.artist[indexNum],
            album: song.album[indexNum],
        }
        if (song.genre[indexNum] != "") dataMeta.genre = song.genre[indexNum];
        if (song.track[indexNum] != "") dataMeta.track = song.track[indexNum];
        if (song.disc[indexNum] != "") dataMeta.disc = song.disc[indexNum];
        var finalFileLocation = `/tmp/${dataMeta.title.replace(/[&?\/]/g, '_')}.mp3`;

        //Begin process of appending meta data to the file
        //Download image
        image_download.image({
                url: song.albumArt[indexNum],
                dest: `/tmp/${song.name[indexNum]}.jpg`,
            })
            .then(({
                filename,
                image
            }) => {
                //Rename file
                fs.rename(`/tmp/${fileFull[fileIndexNum]}`, finalFileLocation, function (err) {
                    if (err) {
                        console.log(err);
                        res.status(500).send("An error has occurred while renaming the file");
                        removeSession(req.body.name);
                        removeFileSession(req.body.originalName);
                        return;
                    }
                    //Attempt to find renamed file again
                    ffmetadata.read(finalFileLocation, function (err) {
                        if (err) {
                            console.log(err);
                            res.status(500).send("An error has occurred while locating the file");
                            removeSession(req.body.name);
                            removeFileSession(req.body.originalName);
                            return;
                        }
                        //Write meta data to the file
                        ffmetadata.write(finalFileLocation, dataMeta, function (err) {
                            if (err) {
                                console.log(err);
                                res.status(500).send("An error has occurred while writing the info to the file");
                                removeSession(req.body.name);
                                removeFileSession(req.body.originalName);
                                return;
                            }
                            //Write album art to file
                            ffmetadata.write(finalFileLocation, {}, dataImage, function (err) {
                                if (err) {
                                    console.log(err);
                                    res.status(500).send("An error has occurred while writing the album art to the file");
                                    removeSession(req.body.name);
                                    removeFileSession(req.body.originalName);
                                    return;
                                }

                                //Open up the download link for this client and attempt to download the file when they visit the link
                                app.get('/download/:songName', (req, res) => {
                                    res.download(`/tmp/${req.params.songName}.mp3`);
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
                });
            }).catch((err) => {
                console.log(err);
                res.status(500).send("An error occurred while downloading the album art to the server");
                //removeFileFromSessionArray(indexNum, fileIndexNum);
                return;
            });
      }
});

function addSession(name, artist, album, genre, track, disc, albumArt) {
    song.name.push(name);
    song.artist.push(artist);
    song.album.push(album);
    if (genre != "" && genre != null && genre != undefined) song.genre.push(genre);
    else song.genre.push("");
    if (track != "" && track != null && track != undefined) song.track.push(track);
    else song.track.push("");
    if (disc != "" && disc != null && disc != undefined) song.disc.push(disc);
    else song.disc.push("");
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
            song.disc.splice(i, 1);
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