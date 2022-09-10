window.addEventListener("load", function () {
    //set animation
    $('.card').css('animation', 'slideIn 0.25s forwards');

    //Highlight current page
    var url = window.location.href;
    $(".navigation-item").each(function () {
        if (url == (this.href)) {
            $(".navigation-item").removeClass("navigation-item-active");
            $(this).delay(100).addClass("navigation-item-active");
        }
    });


    //Ripple
    !(function (a) {
        a(".ripple-dark").mousedown(function (b) {
            var c = a(this);
            0 === c.find(".dark").length &&
                c.append("<span class='dark'></span>");
            var d = c.find(".dark");
            if ((d.removeClass("animate"), !d.height() && !d.width())) {
                var e = Math.max(c.outerWidth(), c.outerHeight());
                d.css({
                    height: e,
                    width: e
                });
            }
            var f = b.pageX - c.offset().left - d.width() / 2,
                g = b.pageY - c.offset().top - d.height() / 2;
            d.css({
                top: g + "px",
                left: f + "px"
            }).addClass("animate");
        });
    })(jQuery);
    !(function (a) {
        a(".ripple-light").mousedown(function (b) {
            var c = a(this);
            0 === c.find(".light").length &&
                c.append("<span class='light'></span>");
            var d = c.find(".light");
            if ((d.removeClass("animate"), !d.height() && !d.width())) {
                var e = Math.max(c.outerWidth(), c.outerHeight());
                d.css({
                    height: e,
                    width: e
                });
            }
            var f = b.pageX - c.offset().left - d.width() / 2,
                g = b.pageY - c.offset().top - d.height() / 2;
            d.css({
                top: g + "px",
                left: f + "px"
            }).addClass("animate");
        });
    })(jQuery);

    //Display & randomize load message
    function load() {
        $(".section").hide();
        $("#loading").show();
        var loadingLines = ['One sec...', 'Thinking...', 'Hold on...', 'Just a sec...', 'Just a moment...', 'Just a second...', 'Loading...', 'Working...'];
        var loadingLinesRandom = Math.round(Math.random() * (loadingLines.length - 1));
        $("#loadingLine").html(loadingLines[loadingLinesRandom]);
    }

    var clientSongOriginalName;
    var clientSongName;
    var songAlts2 = [];

    //Handle initial file upload
    $("#submissionForm").change(function () {
        load();
        var data = new FormData();
        var uploadedFile = $('#submissionForm input[type=file]')[0].files[0];
        data.append('uploadFile', uploadedFile);
        $.ajax({
            url: '/upload',
            method: 'POST',
            processData: false,
            contentType: false,
            data: data,
            enctype: 'multipart/form-data',
            success: function ({
                songReorganized,
                songAlts
            }) {
                preview(songReorganized);
                songAlts2 = [];
                songAlts2.push(songAlts);
                clientSongOriginalName = songReorganized.originalName;
                clientSongName = songReorganized.name;
            },
            error: function (data) {
                clientSongOriginalName = uploadedFile.name.split(".mp3")[0];
                end(false, data);
            },
        });
    });

    //Show preview screen
    function preview(song) {
        $(".section").hide();
        $("#preview").show();
        $("#songAlbumArt").attr('src', song.albumArt);
        $("#songName").html(song.name);
        $("#songArtist").html(song.artist);
        $("#songAlbum").html(song.album);
        if (song.genre) $("#songGenre").html(`${song.genre}`);
        if (song.track) $("#songTrack").html(`&bull; Track ${song.track}`);
    }

    //Handle initial confirmation button click, download file
    $("#confirmation").click(function () {
        load();
        var data = new FormData();
        data.append("originalName", clientSongOriginalName);
        data.append("name", clientSongName);
        data.append("confirmation", 1);
        $.ajax({
            url: '/confirmation',
            method: 'POST',
            data: data,
            processData: false,
            contentType: false,
            success: function (song) {
                window.location.href = 'download/' + clientSongName.replace(/[&?\/]/g, '_');
                end(true, song);
            },
            error: function (data) {
                end(false, data);
            }
        })
    })

    //Handle initial confirmation decline & error screen search button click
    $(document).on('click', '#decline, #searchButton', function () {
        if (songAlts2["0"] !== undefined) $("#searchBox").val(songAlts2["0"]["0"].name);
        else $("#searchBox").val($("#submissionForm")["0"]["0"].value.replace(/.mp3|C:\\fakepath\\/gi, ""));
        songSearchDisplay();
        formCheck();
    })

    //Handle search box entries
    $('#searchBox').keypress(function (e) {
        if (e.which == 13) {
            var data = new FormData();
            data.append('query', $('#searchBox').val());
            data.append('songToRemove', clientSongName);
            $.ajax({
                url: '/search',
                method: 'POST',
                processData: false,
                contentType: false,
                data: data,
                enctype: 'multipart/form-data',
                success: function ({
                    song,
                    songAlts
                }) {
                    songAlts2 = [];
                    songAlts2.push(songAlts);
                    songSearchDisplay();
                },
                error: function (data) {
                    songAlts2 = [];
                    songSearchDisplay();
                },
            });
        }
    });

    //Populate search screen list
    function songSearchDisplay() {
        $(".section").hide();
        $("#search").show();
        $("#search ul").empty();
        if (songAlts2.length === 0) {
            $("#search ul").append('<li><p><b>No results found</b></p></li><hr>')
        } else {
            for (var i = 0; i < songAlts2["0"].length; i++) {
                $("#search ul").append(`<li style="cursor:pointer;" id="${i}"><p><b>${songAlts2["0"][i].name}</b> by <b>${songAlts2["0"][i].artist}</b></p></li><hr>`);
            }
        }
        $("html, body").animate({
            scrollTop: 0
        });
    }

    //Handle search screen list click
    $(document).on('click', '#search ul li', function () {
        var num = $(this).attr('id');
        $("#songNameEdit").val(songAlts2["0"][num].name);
        $("#songArtistEdit").val(songAlts2["0"][num].artist);
        $("#songAlbumEdit").val(songAlts2["0"][num].album);
        if (songAlts2["0"][num].genre) $("#songGenreEdit").val(songAlts2["0"][num].genre);
        if (songAlts2["0"][num].track) $("#songTrackEdit").val(songAlts2["0"][num].track);
        $("#songAlbumArtEdit").val(songAlts2["0"][num].albumArt);
        $(".section").hide();
        $("#edit").show();
        $("html, body").animate({
            scrollTop: 0
        });
        
        var data = new FormData();
        data.append('name', clientSongName);
        $.ajax({
            url: '/removesession',
            method: 'POST',
            processData: false,
            contentType: false,
            data: data,
            enctype: 'multipart/form-data'
        });
    });

    //Handle editor input, check if info errors
    var error = false;
    $(document).on('click input focusin focusout', '#editData input, #search ul li, #manualButton', function () {
        setTimeout(function () {
            error = false;
            $('#songName2').html($("#songNameEdit").val());
            $('#songArtist2').html($('#songArtistEdit').val());
            $('#songAlbum2').html($('#songAlbumEdit').val());
            $('#songGenre2').html($('#songGenreEdit').val());
            if ($('#songTrackEdit').val()) {
                $('#songTrack2').html(`&bull; Track ${$('#songTrackEdit').val()}`);
            } else {
                $('#songTrack2').empty();
            }
            if ($('#songNameEdit').val().length === 0) {
                $('#songNameEdit').css("background", "rgba(255,0,0,0.25)");
                error = true;
            } else {
                $('#songNameEdit').css("background", "white");
            }
            if ($('#songArtistEdit').val().length === 0) {
                $('#songArtistEdit').css("background", "rgba(255,0,0,0.25)");
                error = true;
            } else {
                $('#songArtistEdit').css("background", "white");
            }
            if ($('#songAlbumEdit').val().length === 0) {
                $('#songAlbumEdit').css("background", "rgba(255,0,0,0.25)");
                error = true;
            } else {
                $('#songAlbumEdit').css("background", "white");
            }
            if ($('#songAlbumArtEdit').val().length === 0) {
                $('#songAlbumArt2').attr('src', '../no_album_art.jpg');
                $('#songAlbumArtEdit').css("background", "rgba(255,0,0,0.25)");
                error = true;
            } else {
                $('#songAlbumArtEdit').css("background", "white");
                $('#songAlbumArt2').attr('src', $('#songAlbumArtEdit').val()).on("error", function () {
                    $('#songAlbumArt2').attr('src', '../no_album_art.jpg');
                    $('#songAlbumArtEdit').css("background", "rgba(255,0,0,0.25)");
                    error = true;
                });
            }
        }, 250);
        formCheck();
    });

    //Handle secondary confirmation, download file
    $("#confirmation2").click(function () {
        if (error == true) {
            console.log(error);
            $("html, body").animate({
                scrollTop: 0
            });
            return false;
        }
        load();
        var data = new FormData();
        data.append("originalName", clientSongOriginalName);
        data.append("name", $("#songNameEdit").val());
        data.append("artist", $("#songArtistEdit").val());
        data.append("album", $("#songAlbumEdit").val());
        data.append("albumArt", $("#songAlbumArtEdit").val());
        data.append("confirmation", 2);
        if ($("#songGenreEdit").val()) data.append("genre", $("#songGenreEdit").val());
        if ($("#songTrackEdit").val()) data.append("track", $("#songTrackEdit").val());
    
        clientSongName = $("#songNameEdit").val();
        $.ajax({
            url: '/confirmation',
            method: 'POST',
            data: data,
            processData: false,
            contentType: false,
            success: function (song) {
                end(true, song);
                window.location.href = 'download/' + clientSongName.replace(/[&?\/]/g, '_');
            },
            error: function (data) {
                end(false, data);
            }
        })
    })

    //Handle no results button click, opens editor
    $(document).on('click', '#noSongResultsButton', function () {
        var data = new FormData();
        data.append('name', clientSongName);
        $.ajax({
            url: '/removesession',
            method: 'POST',
            processData: false,
            contentType: false,
            data: data,
            enctype: 'multipart/form-data'
        });
    });
    
    $(document).on('click', '#noSongResultsButton, #manualButton', function () {
        $(".section").hide();
        $("#edit").show();
        $("#songNameEdit").val($("#submissionForm")["0"]["0"].value.replace(/.mp3|C:\\fakepath\\/gi, ""));
        $("html, body").animate({
            scrollTop: 0
        });
        formCheck();
    });

    $('.form-section input, .form-section textarea').on('input focusin focusout', function () {
        formCheck();
    });

    //Handles form input style changes
    function formCheck() {
        setTimeout(function () {
            $(".form-section input").each(function () {
                if ($(this).val().length > 0 || $(this).is(":focus")) {
                    $(this).next().css('transform', 'translate(10px,10px)');
                } else {
                    $(this).next().css('transform', 'translate(10px,40px)');
                }
            });
        }, 10);
    }

    //Handles either ending error or success
    function end(status, data) {
        $('.section').hide();
        if (status === true) {
            $("#success").show();
            $("#songName1").text(data);
        } else {
            $("#error").show();
            $("#errorMessage").html(data.responseText);
            if (data.status == 404) $("#errorButtons").show();
        }
    }
});
