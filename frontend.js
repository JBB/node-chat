$(function () {
    "use strict";

    // for better performance - to avoid searching in DOM
    var content = $('#content');
    var input = $('#input');
    var button_div = $('#button-div');
    var next_tile = $('#next_bt');
    var draft_order = $('#draft_order');
    var status = $('#status');
    var randomize = $('#randomize');
    var randomize_divs = $('#randomizeDiv');
    var reset_draft = $('#reset_draft');
    var reset_divisions = $('#reset_divisions');
    var populateDivision = $('#populateDivision');
    var west_division = $('#west_division');
    var east_division = $('#east_division');
    var central_division = $('#central_division');

    //sequence initalized
    var sequence_part1 = false;

    // my color assigned by the server
    var myColor = false;
    // my name sent to the server
    var myName = false;

    // if user is running mozilla then use it's built-in WebSocket
    window.WebSocket = window.WebSocket || window.MozWebSocket;

    // if browser doesn't support WebSocket, just show some notification and exit
    if (!window.WebSocket) {
        content.html($('<p>', { text: 'Sorry, but your browser doesn\'t '
                                    + 'support WebSockets.'} ));
        input.hide();
        $('span').hide();
        return;
    }

    // open connection
    var connection = new WebSocket('ws://ec2-23-21-17-177.compute-1.amazonaws.com:1337');

    connection.onopen = function () {
        // first we want users to enter their names
        input.removeAttr('disabled');
        input.val('');
        status.text('Choose name:');
    };

    connection.onerror = function (error) {
        // just in there were some problems with conenction...
        content.html($('<p>', { text: 'Sorry, but there\'s some problem with your '
                                    + 'connection or the server is down.</p>' } ));
    };

    // most important part - incoming messages
    connection.onmessage = function (message) {
        // try to parse JSON message. Because we know that the server always returns
        // JSON this should work without any problem but we should make sure that
        // the massage is not chunked or otherwise damaged.
        try {
            var json = JSON.parse(message.data);
        } catch (e) {
            console.log('This doesn\'t look like a valid JSON: ', message.data);
            return;
        }

        // NOTE: if you're not sure about the JSON structure
        // check the server source code above
        if (json.type === 'color') { // first response from the server with user's color
            myColor = json.data;
            status.text(myName + ': ').css('color', myColor);
            input.removeAttr('disabled').focus();
            next_tile.removeAttr('disabled');
            //next_tile.prop("disabled", false);
            randomize.removeAttr('disabled');
            reset_draft.removeAttr('disabled');
            populateDivision.removeAttr('disabled');
            //next_tile.prop("disabled", false);
            randomize_divs.removeAttr('disabled');
            reset_divisions.removeAttr('disabled');
            // from now user can start sending messages
        } else if (json.type === 'history') { // entire message history
            // insert every single message to the chat window
            for (var i=0; i < json.data.length; i++) {
                addMessage(json.data[i].author, json.data[i].text,
                           json.data[i].color, new Date(json.data[i].time));
            }
        } else if (json.type === 'draft_history') { // entire draft history
            // insert every single team to the draft chart
            for (var i=0; i < json.data.length; i++) {
              addTile(json.data[i].name, json.data[i].imgsrc);
            }
        } else if (json.type === 'tile') { // it's a single tile
            next_tile.removeAttr('disabled'); // let the user pull another tile
            addTile(json.data.name, json.data.imgsrc);
        } else if (json.type === 'wipe') { // draft being reset
            draft_order.empty();
            //addMessage('admin', 'draft reset by admin',
            //           'black', new Date());
        } else if (json.type === 'division_history') { // entire draft history
            // insert every single team to the division 
            for (var i=0; i < json.data.length; i++) {
              addDivTeam(json.data[i].loc, json.data[i].imgsrc);
            }
        } else if (json.type === 'div_anchors') { // it's a single tile
            populateDivision.removeAttr('disabled'); // let the user pull another tile
            setupDivs(json);
        } else if (json.type === 'div_tile') { // it's a single tile
            populateDivision.removeAttr('disabled'); // let the user pull another tile
            addDivTeam(json.data.loc, json.data.imgsrc);
        } else if (json.type === 'wipe_divs') { // draft being reset
            west_division.empty();
            east_division.empty();
            central_division.empty();
        } else if (json.type === 'message') { // it's a single message
            input.removeAttr('disabled'); // let the user write another message
            addMessage(json.data.author, json.data.text,
                       json.data.color, new Date(json.data.time));
        } else {
            console.log('Hmm..., I\'ve never seen JSON like this: ', json);
        }
    };

    /**
     * Send mesage when user presses Enter key
     */
    input.keydown(function(e) {
        if (e.keyCode === 13) {
            var msg = $(this).val();
            if (!msg) {
                return;
            }
            // send the message as an ordinary text
            connection.send(msg);
            $(this).val('');
            // disable the input field to make the user wait until server
            // sends back response
            input.attr('disabled', 'disabled');

            // we know that the first message sent from a user their name
            if (myName === false) {
                myName = msg;
            }
        } else if ((e.keyCode === 17) && (myColor !== false)) { 
            sequence_part1 = true;
        } else if ((e.keyCode === 57) && (sequence_part1)) {
            // Show admin buttons ctl-9
            button_div.show();
        } else {
          sequence_part1 = false;
        }
    });

    /**
     * Send mesage when user presses 'Next tile' button
     */
    next_tile.click(function() {
        var msg = "next-tile";
        // send the message as an ordinary text
        connection.send(msg);
        // disable the input field to make the user wait until server
        // sends back response
        next_tile.attr('disabled', 'disabled');
        next_tile.attr('disabled','true');
    });

    /**
     * Send mesage when user presses 'Randomize' button
     */
    randomize.click(function() {
        var msg = "randomize-it";
        // send the message as an ordinary text
        connection.send(msg);
    });

    /**
     * Send mesage when user presses 'Reset' button
     */
    reset_draft.click(function() {
        var msg = "Reset-draft";
        // send the message as an ordinary text
        connection.send(msg);
        draft_order.empty();
        next_tile.removeAttr('disabled');
    });

    /**
     * Send mesage when user presses 'Add team to division' button
     */
    populateDivision.click(function() {
        var msg = "next-division-tile";
        // send the message as an ordinary text
        connection.send(msg);
        // disable the input field to make the user wait until server
        // sends back response
        populateDivision.attr('disabled', 'disabled');
        populateDivision.attr('disabled','true');
    });

    /**
     * Send mesage when user presses 'Randomize divisions' button
     */
    randomize_divs.click(function() {
        var msg = "randomize-divs";
        // send the message as an ordinary text
        connection.send(msg);
    });

    /**
     * Send mesage when user presses 'Reset divisions' button
     */
    reset_divisions.click(function() {
        var msg = "Reset-divisions";
        // send the message as an ordinary text
        connection.send(msg);
        west_division.empty();
        east_division.empty();
        central_division.empty();
        populateDivision.removeAttr('disabled');
    });

    /**
     * This method is optional. If the server wasn't able to respond to the
     * in 3 seconds then show some error message to notify the user that
     * something is wrong.
     */
    setInterval(function() {
        if (connection.readyState !== 1) {
            status.text('Error');
            input.attr('disabled', 'disabled').val('Unable to comminucate '
                                                 + 'with the WebSocket server.');
        } 
    }, 3000);

    /**
     * Add message to the chat window
     */
    function addMessage(author, message, color, dt) {
        content.append('<p><span style="color:' + color + '">' + author + '</span> @ ' +
             + (dt.getHours() < 10 ? '0' + dt.getHours() : dt.getHours()) + ':'
             + (dt.getMinutes() < 10 ? '0' + dt.getMinutes() : dt.getMinutes())
             + ': ' + message + '</p>');
        content.animate({ scrollTop: content.prop("scrollHeight") }, 0);
    }

    /**
     * Add tile to the draft order
     */
    function addTile(team, imgsrc) {
        draft_order.append('<span class="team">' + team + '<br><img src="' + imgsrc + '"></span>');
    }

    /**
     * Add tile to the divisions 
     */
    function addDivTeam(loc, imgsrc) {
      if (loc === 'east') {
          east_division.append('<br><img class="division" src="' + imgsrc + '">');
      } else if (loc === 'central') {
          central_division.append('<br><img class="division" src="' + imgsrc + '">');
      } else if (loc === 'west') {
          west_division.append('<br><img class="division" src="' + imgsrc + '">');
      }
    }

    /**
     * Add division anchors
     */
    function setupDivs(json) {
      for (var i=0; i < json.data.length; i++) {
        if (json.data[i].loc === 'east') {
          east_division.append('<br><img class="division" src="' + json.data[i].imgsrc + '">');
        } else if (json.data[i].loc === 'central') {
          central_division.append('<br><img class="division" src="' + json.data[i].imgsrc + '">');
        } else if (json.data[i].loc === 'west') {
          west_division.append('<br><img class="division" src="' + json.data[i].imgsrc + '">');
        }
      }
    }

});
