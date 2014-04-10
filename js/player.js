var STATE_IDLE = 0;
var STATE_DISCARDING = 1;
var STATE_PLAYCARD = 2;
var STATE_SELECTINGPLAYER = 3;
var STATE_SWAPPING = 4;

var SEGMENT_CARD1 = "card";
var SEGMENT_NONE = "";
var SEGMENT_START = "start";

var CARD_WIDTH = 40;
var CARD_HEIGHT = 50;
var CARD_MARGIN = 2;
var TABLE_RADIUS = 200;

function Player(name, id) {
	this.name 		= name;
	this.deck 		= null;
	this.id 		  = id;
	this.hand 		= [];
	this.x			  = 0;
	this.y			  = 0;
	this.done		  = null; // was soll ausgeführt werden, wenn die aktuelle aktion fertig ist
  this.msg		  = [];
	this.executing= false; // is an effect currently active
	this.segment  = SEGMENT_NONE;
	this.angle    = 0;
	this.selectable = false; // can this player be selected?
	this.stateId  = 0;
	this.objects  = [];
	this.execCard = null;
	this.execEff  = "";
	this.currentlyUsedCard = null;
	this.animatePlz = false;
	
	this.setState(STATE_IDLE);
	
	this.group = null;
}

// convert back into real data
Player.prototype.deserialize = function(data) {
  if (data.stateId <= this.stateId) {
    console.log("Ignored State "+data.stateId+" "+this.stateId);
    return;
  }
  this.stateId = data.stateId;
  
	this.deck = [];
	for (var i = 0; i < data.deck.length; i++) {
		this.deck.push(getCardByName(data.deck[i]));
	}
	
	this.hand = [];
	for (var i = 0; i < data.hand.length; i++) {
	  this.hand.push(new GameCard(getCardByName(data.hand[i]), this));
	}
	
	this.objects = [];
	for (var i = 0; i < data.objects.length; i++) {
  	var obj = data.objects[i];
  	obj.card = getCardByName(obj.card);
  	
  	this.objects.push(obj);
	}
	
	
	this.selectable = data.state.selectable;
	
	this.id = data.id;
	game.currentPlayer = game.queryPlayerById(data.state.currentPlayer);
	
	// card
	var before = this.currentlyUsedCard;
	this.currentlyUsedCard = getCardByName(data.state.currentlyUsedCard);
	if (before != this.currentlyUsedCard) {
    if (!!this.currentlyUsedCard) {
      this.animatePlz = true
    } else {
      this.animatePlz = false;
    }
	} else {
  	this.animatePlz = false;
	}
	
	
	
	// SEGMENT
	switch (!!data.state.segment ? data.state.segment.toLowerCase() : "") {
  	case "card":
  	  var prev = this.segment;
  	  this.segment = SEGMENT_CARD1;
  	  if (this == game.me && prev != this.segment) {  
  	    console.log("Segment changed "+this.segment);  
  	    if (game.currentPlayer == game.me) {
    	    this.playCard();
    	  } else {
      	  this.wait();
    	  }
  	  }
  	  break;
    case "start":
      var prev = this.segment;
      this.segment = SEGMENT_START;
      if (prev != this.segment && this == game.me) {
        console.log("Begin Turn "+data.id);
  			if (this == game.currentPlayer) {
  				// im starting
  				console.log("My turn!");
  			} else {
  				this.wait();
  			}
  			var rot = 360-game.currentPlayer.angle;
  			
  			console.log("ANGLE "+game.currentPlayer.angle);
  			// start animation
  			game.animRunning();
  			var tween = new Kinetic.Tween({
          node: game.layers.cardLayer,
          duration: 1,
          rotationDeg: (rot = getAngle(game.layers.cardLayer.getRotationDeg(), rot)),
          easing: Kinetic.Easings['BackEaseInOut'],
          onFinish: function() {
            rot = (rot + 360) % 360;
            game.layers.cardLayer.setRotationDeg(rot);
            game.layers.cardLayer.draw();
            game.animStop();
          }
        });
        tween.play();
      }
      break;
    default:
      this.segment = SEGMENT_NONE;
      if (this == game.me && prev != this.segment) {  
        console.log("No segment ?!?!?");
      }
	}
	
	// ACTION
	// check before if it's me? and if it has changed
	if (this == game.me) {
	  var action = data.action;
	  // console.log("EXEC CARD: "+action.execCard+" EXEC EFF: "+action.execEff);
	  if (action.execCard.length > 0 && action.execEff.length > 0) {
  	  this.addMsg(action.execCard+": "+action.execEff);
  	  this.execCard = action.execCard;
  	  this.execEff = action.execEff;
  	} else {
    	this.execCard = null;
    	// this.execEff = "";
  	}
  	
  	switch (action.action) {
    	case "discard":
    	  this.action_discard(action.actionParams);
    	  break;
      case "selectplayer":
        this.action_selectPlayer(action.actionParams);
        break;
      case "swapcard":
        this.action_swapCard(action.actionParams);
        break;
      case "":
      case null:
        // nothing to do here <3
        break;
      default:
        throw "Unknown action "+data.action.action;
  	}
	}
}

Player.prototype.render = function(parent, pos) {
  if (!!this.group) this.group.destroy();
  this.angle = (pos / game.players.length * 360) % 360;
  this.group = new Kinetic.Group({
    rotationDeg: this.angle
  });
  
  for (var i = 0; i < this.hand.length; i++) {
    var pos = -this.hand.length/2 + i;
    var params = {
      x: pos * (CARD_WIDTH + CARD_MARGIN) + CARD_MARGIN/2,
      y: 0,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      offset: [0, TABLE_RADIUS]
    };
    this.hand[i].render(this.group, params, false);
  }
  parent.add(this.group);
  
  if (!!this.currentlyUsedCard) {
    this.animateUseCard(this.currentlyUsedCard, !!this.animatePlz);
    this.animatePlz = false;
  }
  
  var text;
  this.group.add(text = new Kinetic.Text({
    x: 0,
    y: -CARD_HEIGHT/2 + 8,
    text: this.name,
    fontSize: 14,
    fontFamily: 'Arial',
    fill: 'black',
  }));
  text.setOffset(text.getWidth()/2, TABLE_RADIUS);
  
  // render objects
  var objx = -this.objects.length/2*20;
  for (var i = 0; i < this.objects.length; i++) {
    var obj = this.objects[i];
    
    var objDrawing;
    this.group.add(objDrawing = new Kinetic.Rect({
      x: objx + i*20,
      y: CARD_HEIGHT + 20,
      width: 16,
      height: 16,
      fill: 'rgb(0,0,255)'
    }));
    
    objDrawing.setOffset(0, TABLE_RADIUS);
    
    objDrawing.on('mouseenter', function() {
      console.log("ENTER");
      
      // show object info TODO
      
      
    });
    objDrawing.on('mouseenter', function() {
      console.log("LEAVE");
      
      // hide object info TODO
    });
  }
  
  
  // render selectable
  var active = false;
  for (var i = 0; i < game.players.length; i++) {
    if (game.players[i].state == STATE_SELECTINGPLAYER) {
      active = true;
      break;
    }
  }
  
  if (this.selectable && active) {
    var circle;
    this.group.add(circle = new Kinetic.Circle({
      x: 0,
      y: CARD_HEIGHT + 22,
      radius: 16,
      fill: 'rgb(180,180,180)'
    }));
    circle.setOffset(0, TABLE_RADIUS);
    circle.on('mouseenter', function() {
      if (!!circle.getParent()) {
        game.animRunning();
        var tween = new Kinetic.Tween({
          node: circle,
          duration: 0.25,
          radius: 32,
          opacity: 0.75,
          easing: Kinetic.Easings['EaseOut'],
          onFinish: function() {
            game.animStop();
          }
        });
        tween.play();
      }
    });
    circle.on('mouseleave', function() {
      if (!!circle.getParent()) {
        game.animRunning();
        var tween = new Kinetic.Tween({
          node: circle,
          duration: 0.25,
          radius: 16,
          opacity: 1,
          easing: Kinetic.Easings['EaseOut'],
          onFinish: function() {
            game.animStop();
          }
        });
        tween.play();
      }
    });
    var that = this;
    circle.on('click', function() {
      game.animRunning();
      var tween = new Kinetic.Tween({
        node: circle,
        duration: 0.1,
        radius: 34,
        opacity: 1,
        easing: Kinetic.Easings['EaseOut'],
        onFinish: function() {
          game.me.stateParams.player = that.id; //prev: currentPlayer dont know if this causes problems
          game.me.actionUpdate();
          game.animStop();
        }
      });
      tween.play();
    });
  }
}

Player.prototype.renderHUD = function(parent) {
  var factor = 2;
  var h = (BOTTOMHUD_HEIGHT - 4)*factor;
  var w = (CARD_WIDTH*(h/CARD_HEIGHT))*factor;
  
  // render current executing
  /*if (!!this.execCard) {
    var params = {
      x: 10,
      y: TOPHUD_HEIGHT + 18,
      width: (w/factor)/100*100,
      height: (h+200)/100*75
    };
    
    var gc = new GameCard(getCardByName(this.execCard), this);
    gc.render(game.layers.hudLayer, params, true, false, this.execEff);
  }*/
  
  
  // render rest
 
  var card, oldCard;
  for (var i = 0; i < this.hand.length; i++) {
    var scale = 1/ factor;
    var params = {
      x: i * (w/(factor*factor) + CARD_MARGIN) + CARD_MARGIN/2 + (game.stage.getWidth()/2 - this.hand.length * (w/(factor*factor) + CARD_MARGIN) / 2),
      y: 2,
      width: w/factor,
      height: h+200,
      scale: scale
    };
    oldCard = card;
    var c = this.hand[i];
    switch (c.player.state) {
      case STATE_IDLE:
        c.action = "";
        c.actionEnabled = false;
        c.actionFunc = function() { };
        break;
      case STATE_DISCARDING:
        c.action = "Abwerfen";
        c.actionEnabled = true;
        c.actionFunc = function(card, group) {
          game.animRunning();
          var tween = new Kinetic.Tween({
            node: group,
            duration: 0.5,
            scaleX: 0,
            scaleY: 0,
            opacity: 0,
            rotationDeg: 40,
            y: 500,
            x: group.getX()+100,
            easing: Kinetic.Easings['EaseIn'],
            
            onFinish: (function() {
              game.animStop();
              group.game_cancelothers = false;
              game.render();
              this.actionUpdate(card);
              
            }).bind(this)
          });
          tween.play();
        };
        break;
      case STATE_PLAYCARD:
        if (c.card.type == OBJECT) {
          c.action = "Platzieren";
        } else {
          c.action = "Spielen";
        }
        c.actionEnabled = true;
        c.actionFunc = function(card, group) {
          game.animRunning();
          var tween = new Kinetic.Tween({
            node: group,
            duration: 0.5,
            scaleX: 2,
            scaleY: 2,
            opacity: 0,
            y: -500,
            x: group.getX()-100,
            easing: Kinetic.Easings['EaseIn'],
            
            onFinish: (function() {
              game.animStop();
              group.game_cancelothers = false;
              game.render();
              this.useCard(card);
            }).bind(this)
          });
          tween.play();
        };
        break;
      case STATE_SWAPPING:
        c.action = "Tauschen";
        c.actionEnabled = true;
        c.actionFunc = function(card, group) {
          game.animRunning();
          var tween = new Kinetic.Tween({
            node: group,
            duration: 0.5,
            scaleX: 0,
            scaleY: 0,
            opacity: 0,
            rotationDeg: 40,
            y: 500,
            x: group.getX()+100,
            easing: Kinetic.Easings['EaseIn'],
            
            onFinish: (function() {
              game.animStop();
              group.game_cancelothers = false;
              game.render();
              this.actionUpdate(card);
            }).bind(this)
          });
          tween.play();
        };
        break;
    }
    
    card = c.render(parent, params, true);
    if (!!oldCard) oldCard.game_rightCard = card;
  }
}

Player.prototype.useCard = function(card) {
	game.useCard.call(game, card);
}

Player.prototype.animateUseCard = function(card, animate) {
  var pos = 0;
  for (var i = 0; i < this.hand.length; i++) {
    var hc = this.hand[i].card;
    if (hc.name == card.name) {
      pos = i;
      break;
    }
  }
  
  pos = -this.hand.length/2 + pos;
  
  var factor = .75;
  var targeth = (BOTTOMHUD_HEIGHT - 4)*factor+175;
  var targetw = (CARD_WIDTH*(targeth/CARD_HEIGHT))*factor;
  
  var handcard = new GameCard(card, this);
  
  var eff = !!game.me.execEff ? game.me.execEff : ((!!this.execEff ? this.execEff : null));
  
  if (animate) {
    var node = handcard.render(this.group, {
      x: pos * (CARD_WIDTH + CARD_MARGIN) + CARD_MARGIN/2,
      y: 0,
      width: targetw,
      height: targeth,
      offset: [0, TABLE_RADIUS/(CARD_HEIGHT/targeth)],
      scaleX: (CARD_WIDTH/targetw),
      scaleY: (CARD_HEIGHT/targeth)
    }, true, false, eff);
    
    // fucking animate it
    game.animRunning();
    var tween = new Kinetic.Tween({
      node: node,
      offsetY: 0,
      offsetX: 0,
      x: -targetw/2,
      y: -targeth/2,
      scaleX: 1,
      scaleY: 1,
      duration: 1,
      easing: Kinetic.Easings.EaseInOut,
      onFinish: function() {
        setTimeout(function() {
          game.animStop();
        }, 500);
      }
    });
    tween.play();
  } else {
    var node = handcard.render(this.group, {
      x: -targetw/2,
      y: -targeth/2,
      width: targetw,
      height: targeth,
      scaleX: 1,
      scaleY: 1
    }, true, false, eff);

  }
}


Player.prototype.getCardWidth = function() {
	return this.width / this.hand.length;
}

Player.prototype.playCard = function() {
	this.setState(STATE_PLAYCARD, { });
	this.addMsg("Spielen Sie bitte eine Karte");
	
	game.render();
}

Player.prototype.wait = function() {
	this.setState(STATE_IDLE, { });
	this.addMsg("Spieler "+game.currentPlayer.name+" ist an der Reihe");
}

Player.prototype.getLastMsg = function() {
	return !!this.msg[this.msg.length-1] ? this.msg[this.msg.length-1].msg : "";
}

Player.prototype.addMsg = function(msg) {
  this.msg.push({
    msg: msg
  });
  
  game.hudMsgText.setText(msg);
  game.layers.hudLayer.draw();
}

Player.prototype.setState = function(state, params, func) {
  var same;
  try {
    same = JSON.stringify(params) != JSON.stringify(this.stateParams);
  } catch (e) {
    same = false;
  }
  
  if (state != this.state || same) {
    this.state = state;
    this.stateParams = !!params ? params : { };
    this.actionUpdate = !!func ? func : null;
  }
} 

Player.prototype.doneCurrentAction = function() {
	this.addMsg("Auf andere Spieler wird gewartet!");
	this.setState(STATE_IDLE);
}


Player.prototype.action_discard = function(data) {
  if (!this.stateParams || this.stateParams.pid != data.pid) {
    var count;
    var render = (function() {
      count = (data.count - (!!this.stateParams && !!this.stateParams.discards ? this.stateParams.discards.length : 0)); // Diese Berechnung war zuvor falsch
    	if (count == 1) {
    		// this.addMsg("Wählen Sie "+count+" abzuwerfende Karte aus.");
    	} else {
    		// this.addMsg("Wählen Sie "+count+" abzuwerfende Karten aus.");
    	}
  	}).bind(this);
  	render();
  	
  	this.setState(STATE_DISCARDING, {
  		count: data.count,
  		discards: [],
  		pid: data.pid
  	}, function(card) {
  	  console.log("Action Update: DISCARD.");
  	  
  	  var d = this.stateParams.discards;
  	  d.push(card.name);
  	  this.hand.splice(this.hand.indexOf(card), 1);
  	  
  	  render();
  	  
  	  socket.emit('response_actiondiscard', { pid: data.pid, discard: card.name });
  	  
      setTimeout(function() {
        game.render();
      }, 0);
      
  		
  		if (data.count == (data.count - count)) {
  			this.doneCurrentAction();
  		}
  	});
	}
}

Player.prototype.action_swapCard = function(data) {
  var player = game.queryPlayerById(data.target);
  // this.addMsg("Tauschen Sie eine Karte mit Spieler "+player.name);
  this.setState(STATE_SWAPPING, {
    target: player
  }, function(card) {
    console.log("Swap card "+card.name);
    
    this.hand.splice(this.hand.indexOf(card), 1);
    
    socket.emit('response_actionswap', { pid: data.pid, card: card.name });
    
    this.doneCurrentAction();
    
    setTimeout(function() {
      game.render();
    }, 0);
  });
}

Player.prototype.action_selectPlayer = function(data) {
  // this.addMsg("Wählen Sie einen Spieler aus.");
  for (var i = 0; i < data.players.length; i++) {
    var id = data.players[i];
    game.queryPlayerById(id).selectable = true;
  }
  
  this.setState(STATE_SELECTINGPLAYER, {
    player: 0
  }, function() {
    console.log("Action Update: Select Player. "+this.stateParams.player);
    for (var i = 0; i < game.players.length; i++) {
      game.players[i].selectable = false;
    }
    socket.emit('response_actionselectplayer', {pid: data.pid, player: this.stateParams.player});
    this.doneCurrentAction();
  });
}

