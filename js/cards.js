var DEATHLY_SIN = 0;
var OBJECT = 1;

var PRIDE	= 0;
var GREED	= 1;
var LUST	= 2;
var ANGER	= 3;
var GLUTTONY= 4;
var ENVY	= 5;
var LAZINESS= 6;

function getCardByName(name) {
	for (var i = 0; i < cards.length; i++) {
		if (cards[i].name == name) return cards[i];
	}
	return null;
}

function convert2CardArr(arr) {
	var res = [];
	for (var i = 0; i < arr.length; i++) {
		res.push(!!arr[i].name ? arr[i].name : arr[i].card.name);
	}
	return res;
}

/**
	attribute => Stolz(0) / Habgier(1) / Wollust(2) / Zorn(3) / Völlerei(4) / Neid(5) / Faulheit(6)
	type => "Todsünde" (0)/ Gegenstand(2) / [Katastrophe](3)
*/
function Card(name, eff, type, attribute, callbacks, level) {
	this.name = name;
	this.callbacks = callbacks;
	this.type = type;
	this.attribute = attribute;
	this.level = level;
	this.eff = eff;
}

Card.prototype.use = function(container) {
	console.log("Use card "+this.name);
	if (!!this.callbacks.use) this.callbacks.use.call(this, container);
}

Card.prototype.getAttributeName = function() {
	switch(this.attribute) {
		case 0:
			return "Stolz";
		case 1:
			return "Habgier";
		case 2:
			return "Wollust";
		case 3:
			return "Zorn";
		case 4:
			return "Völlerei";
		case 5:
			return "Neid";
		case 6:
			return "Faulheit";
		default:
			throw "Unknown Attribute";
	}
}

Card.prototype.getTypeName = function() {
	switch(this.type) {
		case 0:
			return "Todsünde";
		case 1:
			return "Gegenstand";
		default:
			throw "Unknown Attribute";
	}
}

var cards = [
	new Card("Drei-Klassen Gesellschaft", "Spieler mit 8 oder mehr Karten werfen 3 ab. \n\nSpieler mit 6 oder 7 Karten werfen 2 ab. \n\nSpieler mit 4 oder 5 Karten werfen 1 ab. \n\nAlle anderen Spieler ziehen 2 Karten.", DEATHLY_SIN, PRIDE, {
		use: function(state) {
		  var me = state.player;
		  
			if (me.hand.length >= 8) {
			  me.setExecuting(this.name, "Spieler mit 8 oder mehr Karten werfen 3 ab.");
				me.action_discard(3, me.doneExecuting);
			} else if (me.hand.length == 6 || me.hand.length == 7) {
			  me.setExecuting(this.name, "Spieler mit 6 oder 7 Karten werfen 2 ab.");
				me.action_discard(2, me.doneExecuting);
			} else if (me.hand.length == 5  || me.hand.length == 4) {
			  me.setExecuting(this.name, "Spieler mit 4 oder 5 Karten werfen 1 ab.");
				me.action_discard(1, me.doneExecuting);
			} else {
			  me.setExecuting(this.name, "Alle anderen Spieler ziehen 2 Karten.");
				me.action_drawTop(2, me.doneExecuting);
			}
		}
	}),
	new Card("Sklavenhalter", "Ziehe 1 Karte. Wähle einen Gegner, der 1 Karte abwerfen muss. Wirf in deiner nächsten Runde 2 Karten ab.", DEATHLY_SIN, PRIDE, {
		use: function(state) {
		  var card = this;
		  
			var me = state.player;
			if (state.starter.id == me.id) {
			  me.setExecuting(card.name, "Ziehe 1 Karte.");
  			me.action_drawTop(1, function() {
  			  me.setExecuting(card.name, "Wähle einen Gegner, der 1 Karte abwerfen muss.");
    			me.action_selectPlayer(me.match.getPlayersExcept([ me ]), function(sel) {
    			  sel.setExecuting(card.name, "Wähle einen Gegner, der 1 Karte abwerfen muss.");
      			sel.action_discard(1, function() {
      			  console.log("Done discarding for Sklavenhalter");
        			var segment = me.match.getSegment("start").actions;
        			var f = function() {
        			  // check if my turn
        			  if (me == me.match.getCurrentPlayer()) {
          			  console.log("Lingering: DISCARD 2");
          			  me.match.start_newchain();
          			  me.setExecuting(card.name, "Wirf in deiner nächsten Runde 2 Karten ab.");
            			me.action_discard(2, me.doneExecuting); // i would like to discard!
                  segment.splice(segment.indexOf(f), 1); // remove me
                }
        			};
        			
        			segment.push(f);
        			me.action_done();
      			});
    			});
  			});
			} else {
  			me.action_done();
			}
		}
	}),
	new Card("Schatzkammer", "Am Rundenanfang deines Zuges: Wähle einen Gegner aus der weniger Karten als du hat. Dieser muss 1 Karte ziehen.", OBJECT, PRIDE , {
		use: function(state) {
		  var card = this;
			var me = state.player;
			if (state.starter.id == me.id) {
			  var obj = me.placeObject(this, function() {
  			  var segment = me.match.getSegment("start").actions;
    			var f = function() {
    			  console.log("Schatzkammer Lingering");
    			  var owner = me.match.players[obj.owner];
    			  if (obj.placed) {
    			    if (owner == me.match.getCurrentPlayer()) {
        			  var pls = [];
                owner.match.iteratePlayers(function(pl) {
                  if (pl.hand.length < owner.hand.length) {
                    pls.push(pl);
                  }
                });
                if (pls.length > 0) {
          			  owner.match.start_newchain();
            			owner.setExecuting(card.name, "Am Rundenanfang deines Zuges: Wähle einen Gegner aus der weniger Karten als du hat.");
            			owner.action_selectPlayer(pls, function(player) {
            			  player.setExecuting(card.name, "Dieser muss 1 Karte ziehen.");
              			player.action_drawTop(1, owner.doneExecuting);
            			});
                } else {
                  console.log("Nothing to select for Schatzkammer");
                }
              } else {
                console.log("Not my turn for Schatzkammer");
              }
            } else {
              console.log("Remove Schatzkammer Lingering");
              // remove lingering
              segment.splice(segment.indexOf(f), 1);
            }
    			};
    			segment.push(f);
  			});
			}
			me.action_done();
		}
	}, 2),
	
	new Card("Goldenes Lamm", "Ziehe 2 Karten. Wirf 1 Karte ab. Jeder andere Spieler zieht 1 Karte.", DEATHLY_SIN, GREED, {
		use: function(state) {
		  var card = this;
		  var me = state.player;
			if (state.starter.id == me.id) {
			  me.setExecuting(card.name, "Ziehe 2 Karten.");
  			me.action_drawTop(2, function() {
  			  me.setExecuting(card.name, "Wirf 1 Karte ab.");
  			  
    			me.action_discard(1, me.doneExecuting);
  			});
			} else {
			  me.setExecuting(card.name, "Jeder andere Spieler zieht 1 Karte.");
  			me.action_drawTop(1, me.doneExecuting);
			}
		}
	}),
	new Card("Nacht und Nebelaktion", "Nimm einen zufälligen Gegenstand eines Gegners in deinen Besitz und ziehe 1 Karte. Falls es keinen Gegenstand gibt, so ziehe stattdessen 3 Karten.", DEATHLY_SIN, GREED, {
		use: function(state) {
		  var card = this;
		  
			var me = state.player;
			if (state.starter.id == me.id) {
			  var objs = me.getOtherObjects();
			  
			  if (objs.length == 0) {
  			  // no object on field
  			  me.setExecuting(card.name, "Falls es keinen Gegenstand gibt, so ziehe stattdessen 3 Karten.");
  			  me.action_drawTop(3, me.doneExecuting);
			  } else {
			    me.setExecuting(card.name, "Nimm einen zufälligen Gegenstand eines Gegners in deinen Besitz");
			    var obj = objs[Math.floor(Math.random()*objs.length)];
  			  var oldplayer = me.match.players[obj.owner];
  			  oldplayer.objects.splice(oldplayer.objects.indexOf(obj), 1);
  			  obj.owner = me.id;
  			  me.objects.push(obj);
  			  
  			  
  			  me.setExecuting(card.name, "und ziehe 1 Karte.");
  			  me.action_drawTop(1, me.doneExecuting);
			  }
			} else {
  			me.action_done();
			}
		}
	}),
	new Card("Pakt mit dem Teufel", "Spiele einen zufälligen Gegenstand aus deiner Bibliothek. Am Rundenende deines Zuges: Ziehe 1 Karte.", OBJECT, GREED, {
		use: function(state) {
		  var card = this;
			var me = state.player;
			if (state.starter.id == me.id) {
  			var objsInDeck = [];
  			for (var i = 0; i < me.deck.length; i++) {
    			var c = me.deck[i];
    			if (c.type == OBJECT) {
      			objsInDeck.push(c);
    			}
  			}
  			
  			// lingering stuff
  			var obj = me.placeObject(this, function() {
    			var segment = me.match.getSegment("end").actions;
      			var f = function() {
      			  console.log("Pakt Mit Dem Teufel Lingering");
      			  var owner = me.match.players[obj.owner];
      			  if (obj.placed) {
      			    if (owner == me.match.getCurrentPlayer()) {
      			      console.log("execute Pakt Mit Dem Teufel");
      			      owner.match.start_newchain();
      			      me.setExecuting(card.name, "Am Rundenende deines Zuges: Ziehe 1 Karte.");
                  owner.action_drawTop(1, function() {
                    owner.action_done();
                  })
                } else {
                  console.log("Not my turn Pakt Mit Dem Teufel");
                }
              } else {
                console.log("Remove Pakt Mit Dem Teufel Lingering");
                // remove lingering
                segment.splice(segment.indexOf(f), 1);
              }
      			};
      			segment.push(f);
            me.action_done();
            
      			var selobj = objsInDeck[Math.floor(Math.random()*objsInDeck.length)];
      			me.match.start_newchain(); // new chain
      			me.setExecuting(card.name, "Spiele einen zufälligen Gegenstand aus deiner Bibliothek.");
      			me.action_execcard(selobj); // on this chain exec new card
          });
			} else {
			  me.action_done();
			}
		}
	}, 0),
	
	new Card("Feier des Teufels", "Jeder Gegner zieht 1 Karte und wirft 2 Karten ab.\nDu wirfst 1 Karte ab und ziehst 2 Karten. Jeder Gegner der eine \"Wollust\" Karte abgeworfen hat muss 3 Karten ziehen.", DEATHLY_SIN, LUST, {
		use: function(state) {
			var me = state.player;
			var card = this;
			if (state.starter.id == me.id) {
			  me.setExecuting(card.name, "Du wirfst 1 Karte ab");
  			me.action_discard(1, function() {
  			  me.setExecuting(card.name, "und ziehst 2 Karten");
    			me.action_drawTop(2, me.doneExecuting);
  			});
			} else {
			  me.setExecuting(card.name, "Jeder Gegner zieht 1 Karte");
  			me.action_drawTop(1, function() {
  			  me.setExecuting(card.name, "und wirft 2 Karten ab.");
    			me.action_discard(2, function(discards) {
    			  var lust = false;
    			  
      			for (var i = 0; i < discards.length; i++) {
        			var card = discards[i];
        			if (card.attribute == LUST) {
          			console.log("Player discarded LUST card!!");
          			lust = true;
          			break;
        			}
      			}
      			
      			if (lust) {
      			  me.setExecuting(card.name, "Jeder Gegner der eine \"Wollust\" Karte abgeworfen hat muss 3 Karten ziehen.");
        			me.action_drawTop(3, me.doneExecuting);
      			} else {
        			me.action_done();
      			}
    			});
  			});
			}
		}
	}),
	new Card("Des Freundes Tochter", "Wähle einen Gegner aus. Falls dieser eine \"Wollust\" Karte hat, so muss er alle \"Wollust\” Karten und 1 weitere Karte abwerfen. Ansonsten wirf 2 Karten ab.", DEATHLY_SIN, LUST, {
		use: function(state) {
			var me = state.player;
			var card = this;
			if (state.starter.id == me.id) {
			  me.setExecuting(card.name, "Wähle einen Gegner aus.");
  			me.action_selectPlayer(me.match.getPlayersExcept([ me ]), function(sel) {
  			  // check if lust
  			  var discards = [];
  			  for (var i = 0; i < sel.hand.length; i++) {
    			  var handcard = sel.hand[i];
    			  if (handcard.attribute == LUST) {
      			  discards.push(handcard);
    			  }
  			  }
  			  if (discards.length == 0) {
    			  // i get to discard
    			  me.setExecuting(card.name, "Ansonsten wirf 2 Karten ab.");
    			  me.action_discard(2, function() {
      			  me.action_done();
    			  });
  			  } else {
    			  // opponent has to discard
    			  for (var i = 0; i < discards.length; i++) {
      			  sel.discard(discards[i]);
    			  }
    			  sel.update();
    			  sel.setExecuting(card.name, "Falls dieser eine \"Wollust\" Karte hat, so muss er alle \"Wollust\” Karten und 1 weitere Karte abwerfen.");
    			  sel.action_discard(1, function() {
      			  sel.action_done();
    			  });
  			  }
  			});
			} else {
  			me.action_done();
			}
		}
	}),
	new Card("Schlangenfrau", "Am Rundenanfang deines Zuges: Wähle einen Gegner aus, dieser muss eine zufällige Karte aus seiner Hand spielen.", OBJECT, LUST, {
		use: function(state) {
		  var card = this;
      var me = state.player;
			if (me.id == state.starter.id) {
  			var obj = me.placeObject(this, function() {
  			  var segment = me.match.getSegment("start").actions;
    			var f = function() {
    			  console.log("Schlangenfrau Lingering");
    			  var owner = me.match.players[obj.owner];
    			  if (obj.placed) {
    			    if (owner == me.match.getCurrentPlayer()) {
    			      console.log("execute Schlangenfrau");
                owner.match.start_newchain();
                me.setExecuting(card.name, "Am Rundenanfang deines Zuges: Wähle einen Gegner aus");
                owner.action_selectPlayer(me.match.getPlayersExcept([ owner ]), function(sel) {
                  sel.setExecuting(card.name, "dieser muss eine zufällige Karte aus seiner Hand spielen.");
                  var c = sel.hand[Math.floor(sel.hand.length*Math.random())];
                  sel.discard(c);
                  sel.update();
                  
                  sel.match.start_newchain();
                  owner.action_done();
                  
                  sel.action_execcard(c);
                  
                });
              } else {
                console.log("Not my turn for Schlangenfrau");
              }
            } else {
              console.log("Remove Schlangenfrau Lingering");
              // remove lingering
              segment.splice(segment.indexOf(f), 1);
            }
    			};
    			segment.push(f);
  			});
			}
			me.action_done();
		}
	}, 2),
	
	new Card("Gotteszorn", "Zerstöre einen zufälligen Gegenstand deiner Gegner und wirf 1 Karte ab. Falls es keinen Gegenstand im Spiel gibt: Ziehe 3 Karten.", DEATHLY_SIN, ANGER, {
		use: function(state) {
		  var card = this;
			var me = state.player;
			if (state.starter.id == me.id) {
			  var objs = me.getOtherObjects();
        if (objs.length > 0) {
          var rndobj = objs[Math.floor(Math.random()*objs.length)];
  			  var objowner = me.match.players[rndobj.owner];
  			  // destroy
  			  objowner.deleteObject(rndobj);
  			  me.setExecuting(card.name, "Zerstöre einen zufälligen Gegenstand deiner Gegner und wirf 1 Karte ab.");
  			  me.action_discard(1, function() {
    			  objowner.action_done();
  			  });
			  } else {
			    me.setExecuting(card.name, "Falls es keinen Gegenstand im Spiel gibt: Ziehe 3 Karten.");
  			  me.action_drawTop(3, function() {
    			  me.action_done();
  			  });
			  }
			} else {
  			me.action_done();
			}
		}
	}),
	new Card("Köpfung und Verstümmelung", "Falls du mehr als 8 Karten hast: Alle Gegner ziehen solange Karten bis sie 6 Karten haben.\n\nFalls du weniger als 8 Karten hast: Wirf deine ganze Hand ab und ziehe 5 Karten. \n\nFalls du genau 8 Karten hast: Jeder Gegner zieht 2 Karten und du wirfst 1 Karte ab.", DEATHLY_SIN, ANGER, {
		use: function(state) {
			var me = state.player;
			var card = this;
			
			if (state.starter.hand.length > 8) {
  			if (state.starter.id == me.id) {
          me.action_done();
  			} else {
    			if (me.hand.length < 6) {
    			  me.setExecuting(card.name, "Alle Gegner ziehen solange Karten bis sie 6 Karten haben.");
    			  me.action_drawTop(6 - me.hand.length, me.doneExecuting);
    			} else {
      			me.action_done();
    			}
  			}
			} else if (state.starter.hand.length < 8) {
  			if (state.starter.id == me.id) {
  			  me.setExecuting(card.name, "Wirf deine ganze Hand ab");
          me.action_discardall(function() {
            me.setExecuting(card.name, "und ziehe 5 Karten.");
            me.action_drawTop(5, me.doneExecuting);
          });
  			} else {
    			me.action_done();
  			}
			} else {
  			if (state.starter.id == me.id) {
  			  me.setExecuting(card.name, "du wirfst 1 Karte ab.");
          me.action_discard(1, me.doneExecuting);
  			} else {
  			  me.setExecuting(card.name, "Jeder Gegner zieht 2 Karten");
    			me.action_drawTop(2, me.doneExecuting);
  			}
			}
		}
	}),
	new Card("Folterkammer", "Am Rundenende deines Zuges: Falls ein Spieler mehr als 6 Karten hat, so muss er 2 Karten abwerfen und falls ein Spieler 1 Karte hat, so muss er 2 Karten ziehen.", OBJECT, ANGER, {
		use: function(state) {
		  var card = this;
		  
			var me = state.player;
			if (me.id == state.starter.id) {
  			var obj = me.placeObject(this, function() {
  			  var segment = me.match.getSegment("end").actions;
    			var f = function() {
    			  console.log("Folterkammer Lingering");
    			  var owner = me.match.players[obj.owner];
    			  if (obj.placed) {
    			    if (owner == me.match.getCurrentPlayer()) {
    			      console.log("execute Folterkammer");
    			      owner.match.iteratePlayers(function(pl) {
      			      if (pl.hand.length > 6) {
        			      pl.match.start_newchain();
        			      me.setExecuting(card.name, "Falls ein Spieler mehr als 6 Karten hat, so muss er 2 Karten abwerfen");
        			      pl.action_discard(2, function() {
          			      owner.doneExecuting();
        			      });
      			      } else if (pl.hand.length == 1) {
        			      pl.match.start_newchain();
        			      me.setExecuting(card.name, "Falls ein Spieler 1 Karte hat, so muss er 2 Karten ziehen.");
                    pl.action_drawTop(2, function() {
          			      owner.doneExecuting();
        			      });
      			      }
    			      });
              } else {
                console.log("Not my turn Folterkammer");
              }
            } else {
              console.log("Remove Folterkammer Lingering");
              // remove lingering
              segment.splice(segment.indexOf(f), 1);
            }
    			};
    			segment.push(f);
  			});
			}
			me.action_done();
		}
	}, 2),
	
	new Card("Eierlegende Wollmilchsau", "Du und ein Gegner deiner Wahl werfen die ganze Hand ab und ziehen dementsprechend viele Karten. Zusätzlich wirft der Gegner 1 Karte ab und du ziehst 1 Karte. ", DEATHLY_SIN, GLUTTONY, {
		use: function(state) {
			var me = state.player;
			var card = this;
			if (me.id == state.starter.id) {
			  me.setExecuting(card.name, "Du und ein Gegner deiner Wahl");
  			me.action_selectPlayer(me.match.getPlayersExcept([ me ]), function(sel) {
  			  sel.setExecuting(card.name, "werfen die ganze Hand ab");
    			sel.action_discardall(function(cards) {
    			  sel.setExecuting(card.name, "und ziehen dementsprechend viele Karten");
      			sel.action_drawTop(cards.length, function() {
      			  sel.setExecuting(card.name, "Zusätzlich wirft der Gegner 1 Karte ab");
      			  sel.action_discard(1, function() {
      			    me.setExecuting(card.name, "Du und ein Gegner deiner Wahl werfen die ganze Hand ab");
        			  me.action_discardall(function(cards) {
        			    me.setExecuting(card.name, "und ziehen dementsprechend viele Karten");
            		  me.action_drawTop(cards.length, function() {
            		    me.setExecuting(card.name, "und du ziehst 1 Karte.");
            		    me.action_drawTop(1, function() {
              		    me.match.iteratePlayers(function(pl) {
                		    pl.action_done();
              		    });
            		    });
            		  });
          			});
      			  });
      			});
    			});
  			});
			}
		}
	}),
	new Card("Zauberspiegel", "Der Spieler der die wenigsten Karten hat, zieht 2 Karten. Der Spieler der die meisten Karten hat, wirft 2 Karten ab.", DEATHLY_SIN, GLUTTONY, {
		use: function(state) {
		  var card = this;
			var me = state.player
			if (me.id == state.starter.id) {
  			var lowest = [];
  			me.match.iteratePlayers(function(pl) {
    			if (lowest.length == 0 || lowest[0].hand.length >= pl.hand.length) {
      		  if (lowest.length > 0 && lowest[0].hand.length == pl.hand.length) {
        		  lowest.push(pl);
      		  } else {
        		  lowest = [ pl ];
      		  }
    			}
  			});
  			me.setExecuting(card.name, "Der Spieler der die wenigsten Karten hat");
  			me.action_selectPlayer(lowest, function(player) {
  			  player.setExecuting(card.name, "Der Spieler der die wenigsten Karten hat, zieht 2 Karten.");
    			player.action_drawTop(2, function() {
      			var highest = [];
      			me.match.iteratePlayers(function(pl) {
      			  if (pl != player) {
          			if (highest.length == 0 || highest[0].hand.length <= pl.hand.length) {
            		  if (highest.length > 0 && highest[0].hand.length == pl.hand.length) {
              		  highest.push(pl);
            		  } else {
              		  highest = [ pl ];
            		  }
          			}
        			}
      			});
      			
      			me.setExecuting(card.name, "Der Spieler der die meisten Karten hat, wirft 2 Karten ab.");
      			me.action_selectPlayer(highest, function(player) {
      			  player.setExecuting(card.name, "Der Spieler der die meisten Karten hat, wirft 2 Karten ab.");
        			player.action_discard(2, function() {
          			player.match.done_all();
        			});
      			});
    			});
  			});
			}
		}
	}),
	new Card("Fressorgie", "Am Rundenende deines Zuges: Wirf 1 Karte ab. Zerstöre diesen Gegenstand falls du 1 Karte hast und ziehe 1 Karte.", OBJECT, GLUTTONY, {
		use: function(state) {
		  var card = this;
			var me = state.player;
			if (me.id == state.starter.id) {
  			var obj = me.placeObject(this, function() {
  			  var segment = me.match.getSegment("end").actions;
    			var f = function() {
    			  console.log("Fressorgie Lingering");
    			  var owner = me.match.players[obj.owner];
    			  if (obj.placed) {
    			    if (owner == me.match.getCurrentPlayer()) {
    			      console.log("execute Fressorgie");
    			      owner.match.start_newchain();
                if (owner.hand.length == 1) {
                  // destroy!
                  owner.deleteObject(obj);
                  owner.update();
                  owner.setExecuting(card.name, "Zerstöre diesen Gegenstand falls du 1 Karte hast und ziehe 1 Karte.");
                  owner.action_drawTop(1, function() {
                    owner.action_done();
                  })
                } else {
                  
                  owner.setExecuting(card.name, "Am Rundenende deines Zuges: Wirf 1 Karte ab.");
                  owner.action_discard(1, function() {
                    owner.action_done();
                  }); 
                }
              } else {
                console.log("Not my turn Fressorgie");
              }
            } else {
              console.log("Remove Fressorgie Lingering");
              // remove lingering
              segment.splice(segment.indexOf(f), 1);
            }
    			};
    			segment.push(f);
  			});
			}
			me.action_done();
		}
	}, 3),
	
	new Card("Neidische Schwestern", "Wähle einen Gegner der weniger Karten als du hat. Dieser Spieler muss 2 Karten ziehen. Falls kein Spieler in Frage kommt: Ziehe 3 Karten.", DEATHLY_SIN, ENVY, {
		use: function(state) {
		  var card = this;
			var me = state.player
			if (me.id == state.starter.id) {
			  var pls = [];
        me.match.iteratePlayers(function(pl) {
          if (pl.hand.length < me.hand.length) {
            pls.push(pl);
          }
        });
        if (pls.length > 0) {
          me.setExecuting(card.name, "Wähle einen Gegner der weniger Karten als du hat.");
  			  me.action_selectPlayer(pls, function(player) {
  			    me.setExecuting(card.name, "Dieser Spieler muss 2 Karten ziehen.");
    			  player.action_drawTop(2, function() {
      			  me.match.done_all();
    			  })
  			  });
			  } else {
			    me.setExecuting(card.name, "Falls kein Spieler in Frage kommt: Ziehe 3 Karten.");
  			  me.action_drawTop(3, function() {
    			  me.match.done_all();
  			  })
			  }
			}
		}
	}),
	new Card("Linkes Tauschgeschäft", "Tausche mit einem Gegner deiner Wahl 1 Karte. Jeder der einen Gegenstand erhält muss Karten in Höhe des Levels ziehen.", DEATHLY_SIN, ENVY, {
		use: function(state) {
		  var card = this;
			var me = state.player;
			if (me.id == state.starter.id) {
  			var pls = me.match.getPlayersExcept([me]);
  			me.setExecuting(card.name, "Tausche mit einem Gegner deiner Wahl");
  			me.action_selectPlayer(pls, function(player) {
  			  me.setExecuting(card.name, "Tausche mit einem Gegner deiner Wahl 1 Karte.");
  			  player.setExecuting(card.name, "Tausche mit einem Gegner deiner Wahl 1 Karte.");
    			me.action_swapCard(player, function(data) {
    			  var done = function() {
        			if (data.pl2.card.type == OBJECT) {
        			  me.setExecuting(card.name, "Jeder der einen Gegenstand erhält muss Karten in Höhe des Levels ziehen.");
          			data.pl2.pl.action_drawTop(data.pl2.card.level, function() {
            			me.match.done_all();
          			});
        			} else {
          			me.match.done_all();
        			}
      			};
    			  
      			if (data.pl1.card.type == OBJECT) {
      			  me.setExecuting(card.name, "Jeder der einen Gegenstand erhält muss Karten in Höhe des Levels ziehen.");
        			data.pl1.pl.action_drawTop(data.pl1.card.level, done);
      			} else {
        			done();
      			}
     			});
  			});
			}
		}
	}),
	new Card("Ungerechtes Gericht", "Am Rundenanfang deines Zuges: Wenn du die meisten Karten hast und es einen anderen Gegenstand gibt, zerstöre einen anderen zufälligen Gegenstand auf dem Feld und lass einen beliebigen Gegner deiner Wahl 1 Karte ziehen.", OBJECT, ENVY, {
		use: function(state) {
		  var card = this;
			var me = state.player;
			if (me.id == state.starter.id) {
  			var obj = me.placeObject(this, function() {
  			  var segment = me.match.getSegment("start").actions;
    			var f = function() {
    			  console.log("Ungerechtes Gericht Lingering");
    			  var owner = me.match.players[obj.owner];
    			  if (obj.placed) {
    			    if (owner == me.match.getCurrentPlayer()) {
    			      console.log("execute Ungerechtes Gericht");
                var most = true;
                owner.match.iteratePlayers(function(pl) {
                  if (pl != owner && pl.hand.length >= owner.hand.length) {
                    most = false;
                  }
                });
                if (most) {
                  var objs = owner.getOtherObjects();
                  if (objs.length > 0) {
                    var rndobj = objs[Math.floor(Math.random()*objs.length)];
            			  var objowner = owner.match.players[rndobj.owner];
            			  // destroy
            			  objowner.deleteObject(rndobj);
            			  me.setExecuting(card.name, "Wenn du die meisten Karten hast und es einen anderen Gegenstand gibt, zerstöre einen anderen zufälligen Gegenstand auf dem Feld");
            			  
                    objowner.update();
          			  }
          			  
          			  // delete it baby
          			  owner.match.start_newchain();
          			  me.setExecuting(card.name, "lass einen beliebigen Gegner deiner Wahl 1 Karte ziehen");
          			  owner.action_selectPlayer(owner.match.getPlayersExcept([ owner ]), function(sel) {
          			    console.log("GOD SAID LET THERE BE DISCARD AND THERE WAS DISCARD");
          			    sel.setExecuting(card.name, "lass einen beliebigen Gegner deiner Wahl 1 Karte ziehen");
          			    sel.action_drawTop(1, function() {
          			      owner.action_done();
          			    });
          			  });
                } else {
                  console.log("I do not have the most :(");
                }
              } else {
                console.log("Not my turn for Ungerechtes Gericht");
              }
            } else {
              console.log("Remove Ungerechtes Gericht Lingering");
              // remove lingering
              segment.splice(segment.indexOf(f), 1);
            }
    			};
    			segment.push(f);
  			});
			}
			me.action_done();
		}
	}, 2),
	
	new Card("Jahrelanges schlafen", "Überspringe deinen nächsten Spielzug.", DEATHLY_SIN, LAZINESS, {
		use: function(state) {
			var me = state.player;
			if (state.starter.id == me.id) {
			  me.skipNextTurn = true;
			}
			me.action_done();
		}
	}),
	new Card("Opium", "Kehre die Spielerreihenfolge um.", DEATHLY_SIN, LAZINESS, {
		use: function(state) {
			var me = state.player;
			if (state.starter.id == me.id) {
			  me.match.turnIncrement = -me.match.turnIncrement;
			}
			me.action_done();
		}
	}),
	new Card("Raum des Vergessens", "Am Rundenanfang: Ziehe keine Karte.", OBJECT, LAZINESS, {
		use: function(state) {
		  var card = this;
			var me = state.player;
			if (me.id == state.starter.id) {
  			var obj = me.placeObject(this, function() {
  			  var segment = me.match.getSegment("start").actions;
    			var f = function() {
    			  console.log("Raum des Vergessens Lingering");
    			  var owner = me.match.players[obj.owner];
    			  if (obj.placed) {
    			    if (owner == me.match.getCurrentPlayer()) {
    			      console.log("Skip next draw Raum des Vergessens");
                owner.skipDraw = true;
              } else {
                console.log("Not my turn for Raum des Vergessens");
              }
            } else {
              console.log("Remove Raum des Vergessens Lingering");
              // remove lingering
              segment.splice(segment.indexOf(f), 1);
            }
    			};
    			segment.push(f);
  			});
			}
			me.action_done();
		}
	}, 0)
];