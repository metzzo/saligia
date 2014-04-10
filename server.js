var io = require('socket.io').listen(61553, { log: true }); // 61553

var fs = require('fs');
eval(fs.readFileSync('js/cards.js')+'');

function createMatch(name, count) {
  if (!!matches[name]) {
    return null;
  } else {
    var m = new Match(name, count);
    matches[name] = m;
    return m;
  }
}

var STATE_JOINING = 0;
var STATE_PLAYING = 1;

function Match(name, expectedPlayerCount) {
  this.expectedPlayerCount = expectedPlayerCount;
  
  this.players = [];
  this.currentPlayer = 0;
  this.process = [];
  this.doneCount = 0;
  this.name = name;
  this.state = STATE_JOINING;
  this.turnIncrement = 1;
  this.currentSegment = 0;
  this.executingSegmentIsExecuting = 0;
  
  var roundStart = []; // callback for round start
  var roundEnd = []; // callback for round end
  var roundPlayCard = []; // callback for playing a card
  
  roundStart.push(function() {
    console.log("ROUND START "+this.name+" ");
    var p = this.getCurrentPlayer()
    if (!p.skipDraw) {
      p.action_drawTop(1, p.doneExecuting);
    } else {
      console.log("Skip draw");
      p.skipDraw = false;
      p.doneExecuting();
    }
    
    this.updateAll();
  });
  
  roundPlayCard.push(function() {
    console.log("ROUND PLAY CARD "+this.name);
    
    this.updateAll();
  });
  
  roundEnd.push(function() {
    console.log("ROUND END "+this.name);
    
    setTimeout((function() {
      this.getCurrentPlayer().doneExecuting();
    }).bind(this), 0);
    
    this.updateAll();
  });
  
  this.segments = [
    {
      name: "start",
      actions: roundStart
    },
    {
      name: "card",
      actions: roundPlayCard
    },
    {
      name: "end",
      actions: roundEnd
    }
  ];
}

Match.prototype.getSegment = function(name) {
  name = name.toLowerCase();
  for (var i = 0; i < this.segments.length; i++) {
    if (this.segments[i].name.toLowerCase() == name) {
      return this.segments[i];
    }
  }
  throw "Unknown segment "+name
}

Match.prototype.executeSegment = function(increment) {
  if (this.executingSegmentIsExecuting == 0) {
    if (this.doneCount == 0) {
      
      var s = this.segments[this.currentSegment];
      var actions = s.actions;
      console.log("Do next Segment "+s.name+" segment "+this.currentSegment);
      
      this.updateAll();
      
      this.executingSegmentIsExecuting++;
      this.doneCount = 1;
      for (var i = actions.length-1; i >= 0 ; i--) {
      	actions[i].call(this);
    	}
    	this.executingSegmentIsExecuting--;
    } else {
      error("Not yet done :(");
    }
  } else {
    error("Currently executing :(");
  }
}

Match.prototype.updateAll = function() {
  this.iteratePlayers(function(pl) {
    pl.update();
	});
}

Match.prototype.iteratePlayers = function(cb) {
  if (!!cb) {
    for (var i = 0; i < this.players.length; i++) {
  		if (this.isCurrentlyActive(i)) {
    		cb(this.players[i], i);
  		}
  	}
	}
}
Match.prototype.startPlayer = function() {
	this.currentPlayer = 0;
	while (!this.isCurrentlyActive(this.currentPlayer)) {
		this.currentPlayer++;
	}
	return this.players[this.currentPlayer];
}

Match.prototype.isCurrentlyActive = function(pos) {
  return !!this.players[pos]; // && !!this.players[pos].active; 
}

Match.prototype.nextPlayer = function() {
	var pl = null;
	do {
	  if (!!pl) pl.skipNextTurn = false;
  	do {
  		this.currentPlayer = (this.currentPlayer + this.turnIncrement) % this.players.length;
  		if (this.currentPlayer < 0) this.currentPlayer = this.players.length + this.currentPlayer;
  		pl = this.players[this.currentPlayer];
  	} while(!this.isCurrentlyActive(this.currentPlayer));	
	} while (pl.skipNextTurn); // skip player if necessary
	
	console.log("Next player is "+pl.name);
	return pl;
}
Match.prototype.beginTurn = function() {
	console.log("Begin turn! "+this.currentPlayer);
	this.currentSegment = 0;
	this.executeSegment();
}
Match.prototype.findNextFreePlayerId = function() {
  for (var i = 0; i < this.players.length; i++) {
		if (!this.isCurrentlyActive(i)) {
			return i;
		}
	}
	var id = this.players.length;
	this.players.push(null);
	return id;
}
Match.prototype.getPlayerCount = function() {
  // TODO: optimize this
  var count = 0;
  this.iteratePlayers(function() {
    count++;
  })
  return count;
}
Match.prototype.getCurrentPlayer = function() {
  return this.players[this.currentPlayer];
}
Match.prototype.getPlayersExcept = function(exclude) {
  var pls = this.players.slice(0);
  for (var i = 0; i < exclude.length; i++) {
    pls.splice(pls.indexOf(exclude[i]), 1);
  }
  return pls;
}
Match.prototype.done_all = function() {
  this.iteratePlayers(function(player) {
    player.action_done();
  });
}
Match.prototype.start_newchain = function() {
  this.doneCount++;
}
Match.prototype.end_chain = function() {
  this.doneCount--;
}
Match.prototype.win = function(winner) {
  this.iteratePlayers(function(pl) {
    pl.winner = winner.id;
    pl.update();
  });
}


function ServerPlayer(match, socket, id) {
	this.id = id;
	this.socket = socket;
	this.name = "Unknown";
	this.deck = [];
	this.hand = [];
	this.registered = [];
	this.active = true; // whether this user is active
	this.match = match;
	this.skipNextTurn = false;
	this.skipDraw = false;
	this.action = "";
	this.actionParams = { };
	this.selectable = false;
	this.stateId = 0;
	this.objects = [];
	this.actionStack = []; // stack for buffering the actions.
	this.winner = null; // who has won?
	this.execcard = ""; // currently executing card
	this.execeff = ""; // currently executing eff
	this.currentlyUsedCard = null; // which card is used
	
	this.lastSent = null;
}

ServerPlayer.prototype.register = function(data) {
  this.name = data.name;
	this.deck = cards.slice(0).concat(cards.slice(0));
	shuffleArray(this.deck);
	this.drawStartingHand();
	this.active = true;
}

ServerPlayer.prototype.reregister = function(socket, data) {
  this.registered = [];
  this.active = true;
  this.socket = socket;
  this.lastSent = null;
  this.stateId = 0;
}

ServerPlayer.prototype.update = function() {
  // TODO: Send only delta
	var d = this.serialize();
	if (this.lastSent != d) {
	  this.lastSent = d;
	  this.stateId++;
	  d.state.stateId = this.stateId;
	  
  	this.match.iteratePlayers(function(p) {
  	  p.socket.emit('update_player', d);
  	});
	}
	
	// win condition
	if (this.hand.length == 0 && this.match.doneCount == 0) { // no chain is resolving and i have no cards in hand => i won
  	this.match.win(this);
	}
}


ServerPlayer.prototype.serialize = function() {
	var tmpDeck = [];
	for (var i = 0; i < this.deck.length; i++) {
		tmpDeck.push(this.deck[i].name);
	}
	var tmpHand = [];
	for (var i = 0; i < this.hand.length; i++) {
		tmpHand.push(this.hand[i].name);
	}
	
	
	return {
		id: this.id,
		name: this.name,
		deck: tmpDeck,
		hand: tmpHand,
		objects: this.objects,
		winner: this.winner,
		state: {
  		segment: this.match.segments[this.match.currentSegment].name,
  		skipNextTurn: this.skipNextTurn,
  		currentPlayer: this.match.getCurrentPlayer().id,
  		selectable: this.selectable,
  		currentlyUsedCard: this.currentlyUsedCard
		},
		action: {
  		action: this.action,
  		actionParams: this.actionParams,
  		execCard: this.execcard,
  		execEff: this.execeff
		}
	};
}

ServerPlayer.prototype.drawStartingHand = function() {
	for (var i = 0; i < 4; i++) {
	 	this.drawTopCard();
	}
}

ServerPlayer.prototype.drawTopCard = function() {
	var card = this.deck.pop();
	if (!card) {
  	throw "Deck is empty!";
	}
	this.hand.push(card);
	return card;
}

ServerPlayer.prototype.queryCardFromDeck = function(name) {
  name = name.toLowerCase();
	for (var i = 0; i < this.deck.length; i++) {
		if (this.deck[i].name.toLowerCase() == name) {
			return this.deck[i];
		}
	}
	return null;
}

ServerPlayer.prototype.removeCardFromDeck = function(card) {
  var i = this.deck.indexOf(card);
	if (i != -1) this.deck.splice(i, 1);
}

ServerPlayer.prototype.drawSpecificCardFromDeck = function(card) {
	this.removeCardFromDeck(card);
	this.hand.push(card);
}
ServerPlayer.prototype.queryCardFromHand = function(card) {
  card = card.toLowerCase();
  
	for (var i = 0; i < this.hand.length; i++) {
		if (this.hand[i].name.toLowerCase() == card) return this.hand[i];
	}
	return null;
}
ServerPlayer.prototype.discard = function(card) {
  var c = this.hand.indexOf(card);
  if (c != -1) {
  	this.hand.splice(c, 1);
  	this.deck.splice(0,0,card);
  	return c;
	}
}

ServerPlayer.prototype.removeCardFromHand = function(card) {
  var c = this.hand.indexOf(card);
  if (c != -1) {
    this.hand.splice(c, 1);
    return c;
  }
}

ServerPlayer.prototype.addCardToHand = function(card) {
  this.hand.push(card);
}

ServerPlayer.prototype.action_do = function(done) {
	var id = this.match.process.length;
	this.match.process.push(done);
	return id;
}

ServerPlayer.prototype.action_done = function() {
  setTimeout((function() { // ensure that others have started execution
    this.update();
    this.doneExecuting();
  }).bind(this), 0);
}

ServerPlayer.prototype.setAction = function(action, params) {
  this.action = action;
  this.actionParams = params;
  if (!this.action || this.action.length == 0) this.resetExecuting();
}

ServerPlayer.prototype.setExecuting = function(card, eff) {
  console.log("Set Executing Info "+card+": "+eff);
  if (typeof card != 'undefined') this.execcard = card;
  if (typeof eff != 'undefined') this.execeff = eff;
  this.update();
}
ServerPlayer.prototype.resetExecuting = function() {
  console.log("Reset Executing Info");
  this.execcard = "";
  this.execeff = "";
  this.update();
}

// object
ServerPlayer.prototype.placeObject = function(card, done) {
  this.action_drawTop(card.level, done);
  
  var obj = {
    owner: this.id,
    card: card.name,
    placed: true
  };
  
  this.objects.push(obj);
  return obj;
}

ServerPlayer.prototype.getOtherObjects = function() {
  var objs = [ ];
  this.match.iteratePlayers((function(pl) {
    if (pl != this) {
		  for (var i = 0; i < pl.objects.length; i++) {
			  objs.push(pl.objects[i]);
		  }
	  }
  }).bind(this));
  return objs;
}

ServerPlayer.prototype.deleteObject = function(obj) {
  this.objects.splice(this.objects.indexOf(obj), 1);
  obj.placed = false;
}

// actions
ServerPlayer.prototype.prepareDone = function(done) {
  this.match.start_newchain();
  
  return (function() {
  	this.match.end_chain();
  	
  	// remove from actionStack
  	this.actionStack.splice(0, 1);
  	
  	done.apply(this, Array.prototype.slice.call(arguments));
  	
  	if (this.match.doneCount == 0 && this.actionStack.length > 0) {
    	this.execNextAction();
  	}
	}).bind(this);
}

ServerPlayer.prototype.pushAction = function(func) {
  // TODO: may cause problems
  //this.actionStack.push(func);
  //if (this.actionStack.length == 1) {
  //this.execNextAction();
  //} else {
  //  console.log("Delay next action");
  //}
  func();
}

ServerPlayer.prototype.execNextAction = function() {
  /*if (this.actionStack.length > 0) {
    console.log("Exec next action!");
    this.actionStack[0]();
  } else {
    console.log("No next action to execute");
  }*/
}

ServerPlayer.prototype.action_discard = function(count, done) {
  this.pushAction((function() {
  	console.log(this.name+": Action discard "+count+" card(s)");
  	
  	done = this.prepareDone(done);
  	
  	if (count > 0) {
    	var id = this.action_do(done);
    	this.setAction('discard', {
    	  pid: id,
    	  count: count,
    	  discards: []
      });
    	this.update();
  	} else {
    	done.call(this, []);
  	}
	}).bind(this));
}

ServerPlayer.prototype.action_discardall = function(done) {
  this.pushAction((function() {
    done = this.prepareDone(done);
    
    var cards = [];
    while (this.hand.length > 0) {
      cards.push(this.discard(this.hand[0]));
    }
    
    setTimeout((function() {
      this.update();
      done.call(this, cards);
    }).bind(this), 0);
  }).bind(this));
}

ServerPlayer.prototype.action_drawTop = function(count, done) {
  this.pushAction((function() {
  	console.log(this.name+": Action draw "+count+" card(s)");
  	
  	done = this.prepareDone(done);
  	
  	var cards = [];
  	for (var i = 0; i < count; i++) {
  		cards.push(this.drawTopCard());
  	}
  	
  	setTimeout((function() {
    	this.update();
    	done.call(this, cards);
  	}).bind(this), 0);
	}).bind(this));
}

ServerPlayer.prototype.action_selectPlayer = function(possiblePlayers, done) {
  this.pushAction((function() {
    console.log(this.name+": Action select Player");
    done = this.prepareDone(done);
    
    if (possiblePlayers.length == 1) {
      console.log("But just one possible player!");
      
      setTimeout((function() {
      	this.update();
      	done.call(this, possiblePlayers[0]);
    	}).bind(this), 0);
    } else {
      var pls = [];
      for (var i = 0; i < possiblePlayers.length;i++) {
        pls.push(possiblePlayers[i].id);
        possiblePlayers[i].selectable = true;
      }
      var id = this.action_do(done);
      this.setAction('selectplayer', {
        pid: id,
        players: pls
      });
      this.update();
    }
  }).bind(this));
}

ServerPlayer.prototype.action_swapCard = function(target, done) {
  this.pushAction((function() {
    console.log("Swap card");
    done = this.prepareDone(done);
    
    if (target == this) {
      error("Cannot swap with myself a card");
      return;
    }
    
    var id = this.action_do(done);
    this.setAction('swapcard', {
      pid: id,
      target: target.id,
      card: null
    });
    this.update();
    
    id = target.action_do(done);
    target.setAction('swapcard', {
      pid: id,
      target: this.id,
      card: null
    });
    target.update();
  }).bind(this));
}

ServerPlayer.prototype.action_execcard = function(playingCard) {
  this.currentlyUsedCard = playingCard.name;
  
  this.match.iteratePlayers((function(pl) {
    if (pl != this) {
      this.match.start_newchain();
    }
    var state = {
  	  match: this.match,
  	  player: pl,
  	  starter: this
    };
  	console.log("Executing card "+playingCard.name+" for player " + pl.name);
  	playingCard.use(state);
  }).bind(this));
};

ServerPlayer.prototype.doneExecuting = function() {
  setTimeout((function() {
    this.match.end_chain();
    this.resetExecuting();
    this.currentlyUsedCard = null;
    
    console.log("Count "+this.match.doneCount);
    if (this.actionStack.length == 0) {
    	if (this.match.doneCount == 0) {
    	  this.setAction('', { });
    	  this.update();
    	  
    	  this.match.currentSegment++;
        if (this.match.currentSegment >= this.match.segments.length) {
          this.match.nextPlayer();
          this.match.beginTurn();
        } else {
    	    this.match.executeSegment(true);
    	  }
      }
    } else {
      this.execNextAction();
    }
  }).bind(this), 0);
};

var matches = { }; // object containing all currently running matches

// LOBBY

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
  console.log("new connection");
  
  // Lobby
  
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

  
  // Game
	var myPlayer;
	var match;
	
	function error(err) {
		console.log("ERROR: "+err+" from "+(!!myPlayer ? myPlayer.name : "Unknown"));
		if (!!match) {
  		match.iteratePlayers(function(pl) {
    		pl.socket.emit('error', { msg: err+" from "+(!!myPlayer ? myPlayer.name : "Unknown") });
  		});
		}
	}
		
	socket.on('register_me', function (data) {
	  if (!data) {
	    error("Invalid data");
      return;
	  }
	  
	  if (!data.match) {
	    error("Match is missing");
	    return;
    } else {
      match = matches[data.match];
      if (!match) {
        // match does not exist => create match
        match = createMatch(data.match, data.count);
      }
    }
    
    if (!data.name) {
      error("Name is missing");
      return;
    }
    
    var myId;
    var reregister = false;
	  if (!!data.oldId && match.state == STATE_PLAYING) {
  	  myId = data.oldId;
  	  if (!!match.players[myId] && !match.players[myId].active) {
    	   match.players[myId].reregister(socket, data);
    	   reregister = true;
    	   console.log("Reregistering success!");
  	  } else {
  	    try {
    	    error("Reregistering failed, because I do not know you! "+(!!match.players[myId])+" "+(!match.players[myId].active)+" my old id was "+myId);
    	  } catch(ex) { }
    	  return;
  	  }
	  } else if (match.state == STATE_JOINING) {
	    myId = match.findNextFreePlayerId();
  	  match.players[myId] = new ServerPlayer(match, socket, myId);
  	  
  		match.players[myId].register(data);
	  } else {
  	  error("New player cannot join if not in STATE_JOINING");
  	  return;
	  }
	  
	  myPlayer = match.players[myId];
		console.log("Server: Register player " +data.name+" my id: "+myId);
		
		match.iteratePlayers(function(pl1, i) {
		  var result = [];
  		match.iteratePlayers(function(pl2, j) {
    		var d = pl2.serialize();
				d.itsMe = pl1.id == pl2.id;
				d.reregister = reregister;
				
				// already registered?
				var already = pl1.registered.indexOf(j) != -1;
				
				if (!already) {
					result.push(d);
					pl1.registered.push(j);
				}
  		});
  		if (result.length > 0) {
    		pl1.socket.emit('register_player',  {
      		players: result
    		});
  		}
		});
		
		if (!reregister && match.players.length == match.expectedPlayerCount && match.state == STATE_JOINING) {
		  console.log("Begin game!");
		  match.state = STATE_PLAYING;
			match.startPlayer();
      match.beginTurn();
		} else {
  		match.updateAll();
		}
	});
	
	socket.on('request_usecard', function(data) {
	 if (!data) {
	    error("Invalid data");
	    return;
	  }
	  
		var playingCard = myPlayer.queryCardFromHand(data.card);
		
		if (!!playingCard) {
			myPlayer.discard(playingCard);
			myPlayer.update();
			myPlayer.action_execcard(playingCard);
		} else {
			error("You don't have this card in your hand");
		}
	});
	
	
	socket.on('response_actiondiscard', function (data) {
	  if (!data) {
      error("Invalid data");
      return;
	  }
	  if (!myPlayer) return;
	  
		console.log("Response to discard "+myPlayer.name);
		
		if (!!myPlayer.actionParams && !!myPlayer.actionParams.discards) {
  		var c = myPlayer.queryCardFromHand(data.discard);
  		if (!!c) {
  			myPlayer.discard(c);
  		} else {
  			error("Card does not exist "+d[i]);
  		}
  		
      myPlayer.actionParams.discards.push(c);
      
      console.log("Discard count "+myPlayer.actionParams.count+" current "+myPlayer.actionParams.discards.length);
      if (myPlayer.actionParams.discards.length == myPlayer.actionParams.count) {
        var d = myPlayer.actionParams.discards;
    		// reset action
    		myPlayer.setAction('', { });
    		myPlayer.update();
    		
    		myPlayer.match.process[data.pid].call(myPlayer, d);
  		} else {
    		myPlayer.update();
  		}
		}
	});
	
	socket.on('response_actionselectplayer', function(data) {
	  if (!data) {
	    error("Invalid data");
      return;
	  }
	  
  	console.log("Response to Select Player "+myPlayer.name);
		var player = match.players[data.player];
		if (player.selectable) {
		  match.iteratePlayers(function(pl) {
  		  pl.selectable = false;
		  });
		  
  		// reset action
  		myPlayer.setAction('', { });
  		myPlayer.update();
  		
  		myPlayer.match.process[data.pid].call(myPlayer, player);
		} else {
  		error("someone cheated :(");
		}
	});
	
	socket.on('response_actionswap', function(data) {
	  if (!data) {
      error("Invalid data");
      return;
	  }
	  
  	console.log("Response to Swap Card");
  	myPlayer.actionParams.card = myPlayer.queryCardFromHand(data.card);
  	
  	var pl1 = myPlayer;
    var pl2 = myPlayer.match.players[myPlayer.actionParams.target];
    
    var card1 = pl1.actionParams.card;
    var card2 = pl2.actionParams.card;
  	
  	if (!!card1 && !!card2) {
      // swap cards
      console.log("Start swapping");
      
      pl1.removeCardFromHand(card1);
      pl2.removeCardFromHand(card2);
      
      pl1.addCardToHand(card2);
      pl2.addCardToHand(card1);
      
      pl1.update();
      pl2.update();
      
      myPlayer.match.process[data.pid].call(myPlayer, {
        pl1: {
          card: card2,
          pl: pl1
        },
        pl2: {
          card: card1,
          pl: pl2
        }
      });
    }
	});
	
	socket.on('disconnect', function(data) {
	  if (!!match && !!myPlayer) {
  	  match.iteratePlayers(function(pl, i) {
  	    pl.registered.splice(pl.registered.indexOf(myPlayer.id), 1);
    	  if (i != myPlayer.id) {
  				pl.socket.emit('unregister_player', match.players[myPlayer.id].serialize() );
  			}
  	  });
		}
		
		if (!!myPlayer) myPlayer.active = false;
		
		// LOBBY
	  leaveRoom(socket);
	  
	  var index;
	  if ((index = lobby_subscriptions.indexOf(socket)) != -1) {
	    console.log("Splice away "+index);
  	  lobby_subscriptions.splice(index, 1);
	  }
	});
});

function shuffleArray(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}