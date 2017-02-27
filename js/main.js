var socket = io.connect('http://localhost:61553');
var storage = isStorageSupported() ? sessionStorage : null;
var game;
var TOPHUD_HEIGHT = 30;
var BOTTOMHUD_HEIGHT;

$(document).ready(function() {
  game = {
    players: [],
    me: null,
    turnIncrement: 1,
    stage: new Kinetic.Stage({
      container: 'container',
      width: 800,
      height: 600
    }),
    layers: {
      bgLayer: new Kinetic.Layer(),
      tableLayer: new Kinetic.Layer(),
      cardLayer: new Kinetic.Layer(),
      hudLayer: new Kinetic.Layer()
    },
    currentPlayer: null,
    hudMsgText: null,
    animation: 0,
    updateStack: [],
  	init: function() {
  	  this.render(); // fix bug hudMsgText == null
      
      var params = getUrlVars();
      
      if (!!params['startnew']) {
        storage['myId'] = null;
      }
      
  		socket.emit('register_me', { name: params['name'], match: params['id'], count: params['count'], oldId: (storage != null && !!storage['myId'] ) ? storage['myId'] : null });
  		
  		socket.on('error', function(data) {
  			console.log("Server error "+data.msg);
  		});
  		
  		socket.on('register_player', (function(alldata) {
  		  var players = alldata.players;
  		  for (var i = 0; i < players.length; i++) {
  		    var data = players[i];
  		    
    			console.log("Register Player "+data.name);
    			if (this.queryPlayerById(data.id) == null) {
    			  var myOldId = storage['myId']
    				var p = new Player(data.name, data.id);
    				this.players.push(p);
    				this.players.sort(function(a,b) { return (a.id < b.id) ? -1 : (a.id > b.id ? 1 : 0); });
    				
    				if (!!data.itsMe) {
    				  this.me = this.queryPlayerById(data.id)
    				  
    				  storage['myId'] = +this.me.id;
    				  console.log("Store my id "+this.me.id);
    				  
    				}
    			}
  			}
  			
  			for (var i = 0; i < players.length; i++) {
  		    var data = players[i];
  		    var p = this.queryPlayerById(data.id);
  		    
    			p.deserialize(data);
    				
    				
          if (!!this.me && this.me != p && (!data.reregister || this.currentPlayer != this.me)) {
            this.me.addMsg("Spieler "+data.name+" ist dem Spiel "+(data.reregister ? "wieder " : "" )+"beigetreten!");
          }
  			}
  			this.render();
  		}).bind(this));
  		
  		
  		socket.on('unregister_player', (function(data) {
  			console.log("Unregister Player "+data.id);
  			var o = this.queryPlayerById(data.id);
  			if (!!o) {
  				this.players.splice(this.players.indexOf(o), 1);
  				this.render();
  				this.me.addMsg("Spieler "+data.name+" hat das Spiel verlassen!");
  				
  			}
  		}).bind(this));
  		
  		var cacheMe = null;
  		socket.on('update_player', (function(data) {
  		  var f = (function() {
    			var p;
    			if ((p = this.queryPlayerById(data.id)) != null) {
    				console.log("Update player "+p.name);
    				p.deserialize(data);
    				this.render();
    			} else {
    				console.log("Unknown player "+data.id);
    			}
  			}).bind(this);
  			game.updateStack.push(f);
  		}).bind(this));
  		
  		
  		this.stage.add(this.layers.bgLayer);
  		this.stage.add(this.layers.tableLayer);
  		this.stage.add(this.layers.cardLayer);
  		this.stage.add(this.layers.hudLayer);
    },
    render: function() {
      for(var index in this.layers) {
        var attr = this.layers[index];
        attr.removeChildren();
      }
      
      var tablePos = [this.stage.getWidth()/2, this.stage.getHeight()/2 - TABLE_RADIUS/2 + TOPHUD_HEIGHT + 18]; // + 16 for text
      this.layers.cardLayer.setPosition(tablePos);
      this.layers.tableLayer.setPosition(tablePos);
      
      
      var table = new Kinetic.Circle({
        radius: TABLE_RADIUS,
        fill: 'yellow'
      });
      this.layers.tableLayer.add(table);
      
      var direction = new Kinetic.Path({
        offset: [25, 25],
        data: 'M12.582,9.551C3.251,16.237,0.921,29.021,7.08,38.564l-2.36,1.689l4.893,2.262l4.893,2.262l-0.568-5.36l-0.567-5.359l-2.365,1.694c-4.657-7.375-2.83-17.185,4.352-22.33c7.451-5.338,17.817-3.625,23.156,3.824c5.337,7.449,3.625,17.813-3.821,23.152l2.857,3.988c9.617-6.893,11.827-20.277,4.935-29.896C35.591,4.87,22.204,2.658,12.582,9.551z',
        fill: 'green',
        scaleX: this.turnIncrement > 0 ? -1 : (this.turnIncrement < 0 ? 1 : 0),
        scaleY: 1
      });
      this.layers.tableLayer.add(direction);
      
      BOTTOMHUD_HEIGHT = this.stage.getHeight() - (TOPHUD_HEIGHT + TABLE_RADIUS*2 + 36);
      
      
      // bottom HUD
      var hudBottomGroup = new Kinetic.Group({
        width: this.stage.getWidth(),
        height: BOTTOMHUD_HEIGHT,
        x: 0,
        y: this.stage.getHeight()-BOTTOMHUD_HEIGHT,
      });
      hudBottomGroup.add(new Kinetic.Rect({
        width: this.stage.getWidth(),
        height: BOTTOMHUD_HEIGHT,
        fill: 'blue'
      }));
      
      if (!!this.me) {
        // draw bottom row
        this.me.renderHUD(hudBottomGroup);
      }
      
      // top HUD
      var hudTopGroup = new Kinetic.Group({
        width: this.stage.getWidth(),
        height: TOPHUD_HEIGHT,
        x: 0,
        y: 0
      });
      hudTopGroup.add(new Kinetic.Rect({
        width: this.stage.getWidth(),
        height: TOPHUD_HEIGHT,
        fill: 'blue'
      }));
      
      hudTopGroup.add(this.hudMsgText = new Kinetic.Text({
        text: !!this.me ? this.me.getLastMsg() : "",
        fontSize: 14,
        fontFamily: 'Arial',
        fill: 'white',
        width: hudTopGroup.getWidth(),
        padding: 8,
        align: 'center'
      }));
      
      this.layers.hudLayer.add(hudTopGroup);
      this.layers.hudLayer.add(hudBottomGroup);
      
      for (var i = 0; i < this.players.length; i++) {
        this.players[i].render(this.layers.cardLayer, i);
      }
      
      this.stage.draw(); // update stuff
    },
    useCard: function(card) {
  	  socket.emit('request_usecard', {card: card.name});
    },
    queryPlayerById: function(id) {
  	  for (var i = 0; i < this.players.length; i++) {
  		  if (this.players[i].id == id) return this.players[i];
  	  }
  	  return null;
    },
    animRunning: function() {
      this.animation++;
    },
    animStop: function() {
      this.animation--;
    }
  }
  
  game.init();
  
  // update
  setInterval(function() {
    if (game.updateStack.length > 0) {
      // am i currently animating?
      if (game.animation == 0) {
        // no => execute next
        var update = game.updateStack[0];
        game.updateStack.splice(0, 1);
        update();
      }
    }
  }, 0);
});
