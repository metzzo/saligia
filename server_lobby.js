var io = require('socket.io').listen(61553, { log: true }); 

function Room(params) {
  this.name = params.name;
  this.pw = params.pw;
  this.peers = { };
}


Room.prototype.join = function(socket, isHost) {
  // has this socket already joined?
  if (!this.peers[socket.id]) {
    var peer = {
      socket: socket,
      name: "Anonymer Spieler",
      host: !!isHost
    }
    
    this.peers[socket.id] = peer;
    return peer;
  } else {
    return null;
  }
};

Room.prototype.serialize = function() {
  var newPeers = [];
  for (var key in this.peers) {
    var peer = this.peers[key];
    newPeers.push({
      id: key,
      name: peer.name,
      host: peer.host
    });
  }
  
  return {
    name: this.name,
    peers: newPeers
  };
};

Room.prototype.updatePeer = function(newPeer) {
  var peer = this.peers[newPeer.id];
  if (!!peer) {
    this.peers[newPeer.id] = {
      socket: peer.socket,
      name: newPeer.name,
      host: peer.host
    }
    
    var serializedRoom = this.serialize();
    for (var key in this.peers) {
      if (key != newPeer.id) {
        var tmp = this.peers[key];
        tmp.socket.emit('response_updateroom', serializedRoom);
      }
    }
  }
};

Room.prototype.kickPeer = function(peer) {
  if (this.peers[peer] && !this.peers[peer].host) {
    delete this.peers[peer];
    this.update();
  }
}

Room.prototype.update = function() {
  var serializedRoom = this.serialize();
  
  for (var i = 0; i < lobby_subscriptions.length; i++) {
    lobby_subscriptions[i].emit('response_updateroom', serializedRoom);
  }
};


var rooms = [ ]; // array containing all currently open rooms (where you can join to)
var lobby_subscriptions = [ ];

var currentGameId = 0;

io.sockets.on('connection', function (socket) {
  var error = function(err) {
		console.log("ERROR: "+err);
	};
  
  
  var joinFunc;
	
	var serializeAllRooms = function() {
  	// TODO: cache this value
	  var newRooms = [ ];
	  for (var i = 0; i < rooms.length; i++) {
  	  newRooms.push(rooms[i].serialize());
	  }
	  return newRooms;
	};
	
	var broadcastRooms = function() {
  	var newRooms = serializeAllRooms();
  	console.log("ROOM count "+newRooms.length);
  	for (var i = 0; i < lobby_subscriptions.length; i++) {
  	  var s = lobby_subscriptions[i];
  	  if (!s.disconnected) {
  	    s.emit('response_lobbylist', newRooms);
  	  }
  	}
	};
	
	var leaveRoom = function(socket) {
	  console.log("LEAVE ROOM");
  	for (var i = 0; i < rooms.length; i++) {
	    var room =  rooms[i];
  	  if (!!room.peers[socket.id]) {
  	    var peer = room.peers[socket.id];
    	  delete room.peers[socket.id];
    	  
    	  if (peer.host || Object.keys(room.peers).length == 0) {
    	    console.log("Host Leave");
    	    var oldPeers = room.peers;
    	    room.peers = { };
    	    var serializedRoom = room.serialize();
    	    // update all the other
    	    for (var key in oldPeers) {
            var p = oldPeers[key];
            if (p != peer) {
              p.socket.emit('response_updateroom', serializedRoom);
            }
          }
      	  
      	  rooms.splice(i, 1); // delete it from rooms
          broadcastRooms();
    	  }
    	  
    	  room.update();
  	  }
	  }
	};
	
	var getRoom = function(name) {
  	for (var i = 0; i < rooms.length; i++) {
    	var r = rooms[i];
    	if (r.name == name) {
      	return r;
      	break;
    	}
  	}
  	return null;
	};
	
	socket.on('request_leaveroom', function(data) {
  	leaveRoom(socket);
	});
	
	socket.on('request_lobbylist', function(data) {
  	socket.emit('response_lobbylist', serializeAllRooms());
  	
  	lobby_subscriptions.push(socket);
	});
	
	socket.on('request_host', function(data) {
  	var room = new Room(data);
  	rooms.push(room);
  	
  	// additionally send join to host
  	joinFunc(data);
	});
	
	socket.on('request_join', joinFunc = function(data) {
  	// please give me the room
  	var room = getRoom(data.name);
  	
  	if (!!room) {
  	  if (!room.pw || room.pw == data.pw) {
  	    room.join(socket, Object.keys(room.peers).length == 0 ? true : false); // checks internally if already joined
  	    
  	    room.update();
  	    
      	socket.emit('response_join', {
      	  room: room.serialize(),
      	  me: socket.id,
      	 });
    	} else {
      	socket.emit('response_join', { error: true});
    	}
  	} else {
    	// room does not exist :(
    	error("Room "+data.name+" does not exist.");
  	}
	});
	
	socket.on('request_updatepeer', function(data) {
  	var room = getRoom(data.room);
  	if (!!room) {
    	room.updatePeer(data.peer);
  	}
	});
	
	socket.on('request_kickpeer', function(data) {
  	var room = getRoom(data.room);
  	if (!!room) {
    	room.kickPeer(data.peer);
  	}
	});
  
  socket.on('request_startgame', function(data) {
    // check if valid
    var room = getRoom(data.room);
  	if (!!room) {
    	var attrCount = Object.keys(room.peers).length;
    	if (attrCount > 0) {
    	  // start it bitch
    	  currentGameId++;
    	  
      	for (var key in room.peers) {
        	var peer = room.peers[key];
        	peer.socket.emit('response_startgame', {
          	gameId: currentGameId
        	});
      	}
      	
    	} else {
      	socket.emit('response_startgame', {
        	error: true
      	});
    	}
  	}
  });
  
  socket.on('disconnect', function(data) {
	  // lobby
	  leaveRoom(socket);
	  
	  var index;
	  if ((index = lobby_subscriptions.indexOf(socket)) != -1) {
	    console.log("Splice away "+index);
  	  lobby_subscriptions.splice(index, 1);
	  }
	});
});