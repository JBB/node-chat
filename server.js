// http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/
"use strict";

// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'node-chat';

// Port where we'll run the websocket server
var webSocketsServerPort = 1337;

// websocket and http servers
var webSocketServer = require('websocket').server;
var http = require('http');

/**
 * Global variables
 */
// latest 100 messages
var history = [ ];
// list of currently connected clients (users)
var clients = [ ];

/**
 * Helper function for escaping input strings
 */
function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Array with some colors
var colors = [ 'red', 'green', 'blue', 'pink', 'purple', 'orange', 'plum', 'yellow', 'brown', 'black', 'magenta' ];
// ... in random order
colors.sort(function(a,b) { return Math.random() > 0.5; } );

// Array with SpoonyG teams
var draft_history = [ ];
var max_teams = 12;
var count = max_teams; //number of teams drafting
var dir = "spoonyg-images/";
var team_images;
var number_colors = 11;
var color_count = 0;

reset_draft();

function reset_draft() {
  draft_history = [];
  team_images = ['baggers.gif', 'jammers.jpg', 'madness.gif', 'chung.jpg', 'kidz.jpg', 'picciottos.jpg', 'oilers.gif', 'shoptaw.jpg', 'chibolas.gif', 'ongbak.jpg', 'powerball.jpg', 'squid.gif'];
  var d = new Date();
  var secs = d.getSeconds();
  secs += 900;
  var i = 0;
  for(i=0;i<secs;i++) {
    team_images.sort(function(a,b) { return Math.random() > 0.5; } );
  }
}

/**
 * HTTP server
 */
var server = http.createServer(function(request, response) {
    // Not important for us. We're writing WebSocket server, not HTTP server
});
server.listen(webSocketsServerPort, function() {
    console.log((new Date()) + " Server is listening on port " + webSocketsServerPort);
});

/**
 * WebSocket server
 */
var wsServer = new webSocketServer({
    // WebSocket server is tied to a HTTP server. To be honest I don't understand why.
    httpServer: server
});

// This callback function is called every time someone
// tries to connect to the WebSocket server
wsServer.on('request', function(request) {
    console.log((new Date()) + ' Connection from origin ' + request.origin + '.');

    // accept connection - you should check 'request.origin' to make sure that
    // client is connecting from your website
    // (http://en.wikipedia.org/wiki/Same_origin_policy)
    // JBB - todo. Make sure we are checking this appropriately
    var connection = request.accept(null, request.origin);
    console.log(request.origin); 
    // we need to know client index to remove them on 'close' event
    var index = clients.push(connection) - 1;
    var userName = false;
    var userColor = false;

    console.log((new Date()) + ' Connection accepted.');

    // send back chat history
    if (history.length > 0) {
        connection.sendUTF(JSON.stringify( { type: 'history', data: history} ));
    }
    // send history of tiles too
    if (draft_history.length > 0) {
        connection.sendUTF(JSON.stringify( { type: 'draft_history', data: draft_history} ));
    }
    // user sent some message
    connection.on('message', function(message) {
        if (message.type === 'utf8') { // accept only text
            if (userName === false) { // first message sent by user is their name
                // remember user name
                userName = htmlEntities(message.utf8Data);
                // get random color and send it back to the user
                //userColor = colors.shift();
                userColor = colors[color_count];
                color_count++;
                if (color_count > number_colors) { color_count = 0; }
                connection.sendUTF(JSON.stringify({ type:'color', data: userColor }));
                console.log((new Date()) + ' User is known as: ' + userName
                            + ' with ' + userColor + ' color.');

            } else if (message.utf8Data === 'next-tile') { 
                if (count > 0) {
                  var obj = {
                     name:  count,
                     imgsrc: dir + team_images.shift()
                  };
                  draft_history.push(obj);
                  count--;
                  
                  // broadcast message to all connected clients
                  var json = JSON.stringify({ type:'tile', data: obj });
                  for (var i=0; i < clients.length; i++) {
                      clients[i].sendUTF(json);
                  }
                }
            } else if (message.utf8Data === 'Reset-draft') { 
                reset_draft();
                count = max_teams;
                // broadcast message to all connected clients
                var json = JSON.stringify({ type:'wipe' });
                for (var i=0; i < clients.length; i++) {
                    clients[i].sendUTF(json);
                }
                record_history("admin reset draft",userName,userColor);
            } else if (message.utf8Data === 'randomize-it') { 
                team_images.sort(function(a,b) { return Math.random() > 0.5; } );
            } else { // log and broadcast the message
                console.log((new Date()) + ' Received Message from '
                            + userName + ': ' + message.utf8Data);
                
                
                
                // we want to keep history of all sent messages
                record_history(
                               htmlEntities(message.utf8Data),
                               userName,
                               userColor);
                /*var obj = {
                    time: (new Date()).getTime(),
                    text: htmlEntities(message.utf8Data),
                    author: userName,
                    color: userColor
                };
                history.push(obj);
                history = history.slice(-100);

                // broadcast message to all connected clients
                var json = JSON.stringify({ type:'message', data: obj });
                for (var i=0; i < clients.length; i++) {
                    clients[i].sendUTF(json);
                }
                */
            }
        }
    });

    // user disconnected
    connection.on('close', function(connection) {
        if (userName !== false && userColor !== false) {
            console.log((new Date()) + " Peer "
                + connection.remoteAddress + " disconnected.");
            // remove user from the list of connected clients
            clients.splice(index, 1);
            // push back user's color to be reused by another user
            colors.push(userColor);
        }
    });

});

function record_history(msg,user,color) {
  // we want to keep history of all sent messages
  var obj = {
      time: (new Date()).getTime(),
      text: msg,
      author: user,
      color: color
  };
  history.push(obj);
  history = history.slice(-100);
                // broadcast message to all connected clients
  var json = JSON.stringify({ type:'message', data: obj });
  for (var i=0; i < clients.length; i++) {
      clients[i].sendUTF(json);
  }
}
