function GameCard(card, player) {
	this.card 		= card;
	this.position 	= null;
	this.player 	= player;
	
	this.action   = "Spielen";
	this.actionEnabled = false;
	this.actionFunc = function() { };
}

GameCard.prototype.render = function(parent, params, open, hover, eff) {
  if (typeof hover == 'undefined') hover = true;
  if (typeof eff == 'undefined') eff = null;
  try {
    var group = new Kinetic.Group(params);
    
    params.x = 0; params.y = 0;
    params.offset = [];
    params.scale = 1;
    
    if (open) {
      if (this.card.type == DEATHLY_SIN) {
        params.fill = 'white';
      } else {
        params.fill = 'rgb(200,200,200)';
      }
    } else {
      params.fill = 'red';
    }
    group.add(new Kinetic.Rect(params));
    
    if (open) {
      group.add(new Kinetic.Text({
        x: 0,
        y: 0,
        text: this.card.name,
        fontSize: 18,
        fontFamily: 'Arial',
        fill: 'black',
        width: params.width,
        padding: 5,
        align: 'center'
      }));
      
      group.add(new Kinetic.Text({
        x: 0,
        y: 36,
        text: this.card.getAttributeName()+(this.card.type == DEATHLY_SIN ? "" : " Level "+this.card.level),
        fontSize: 14,
        fontFamily: 'Arial',
        fill: 'black',
        width: params.width,
        padding: 5,
        align: 'center'
      }));
      
      var fs = 18;
      var text;
      group.add(text = new Kinetic.Text({
        x: 0,
        y: 50,
        text: this.card.eff,
        fontSize: fs,
        fontFamily: 'Arial',
        fill: 'black',
        width: params.width,
        height: params.height+10000,
        padding: 5,
        align: 'left'
      }));
      
      // check if overflow
      (function() {
        var height = 0;
        
        do {
          if (height > params.height - 80) {
            text.setFontSize(fs = (fs - .5));
          }
          
          var lh = text.getLineHeight() * text.getTextHeight();
          var textArr = text.textArr;
          height = textArr.length*lh;
          
        } while(height > params.height - 80);
      })();
      
      (function() {
        if (!!eff && eff.length > 0) {
          var lh = text.getLineHeight() * text.getTextHeight();
          // highlight eff
          var textArr = text.textArr;
          for (var i = textArr.length-1; i >= 0; i--) {
            var line = textArr[i].text;
            for (var j = i + 1; j < textArr.length; j++) {
              line += textArr[j].text;
            }
            
            var pos;
            if ((pos = line.indexOf(eff)) != -1) {
              var x = text._getTextSize(line.substring(0, pos)).width;
              do {
                var y = i*lh + 50;
                var seleff = eff.substring(0, Math.min(eff.length, textArr[i].text.length - pos));
                
                group.add(new Kinetic.Text({
                  x: x,
                  y: y,
                  text: seleff,
                  fontSize: fs,
                  fontFamily: 'Arial',
                  fill: 'red',
                  width: params.width-x,
                  height: params.height-80,
                  padding: 5,
                  align: 'left'
                }));
                
                line = line.substring(pos + seleff.length - 1, pos + line.length - seleff.length);
                eff = eff.substring(seleff.length, eff.length);
                
                i++;
                x = 0;
                pos = 0;
              } while(eff.length != 0);
              break;
            }
          }
        }
      })();
      
      if (hover) {
        createButton(group, {
          x: 40,
          y: params.height-120,
          width: params.width-80,
          height: 28,
          fill: 'rgb(200, 20, 100)',
          text: this.action
        }, this.actionEnabled, (function() {
          if (this.actionEnabled) {
            group.game_cancelothers = true;
            this.actionFunc.call(this.player, this.card, group);
            
            
          }
        }).bind(this));
      }
      
      if (!parent.game_animstack) {
        parent.game_resetAnimStack = function() {
          parent.game_animstack = [];
          parent.game_animstack.optimize = function() {
            for (var i = 1; i < this.length-2; i++) {
              var e1 = this[i], e2 = this[i+1];
              if (e1.obj == e2.obj) {
                if (e1.action == 'mouseenter' && e2.action == 'mouseenter' || e1.action == 'mouseleave' && e2.action == 'mouseleave') {
                  this.splice(i, 2);
                } else if (e1.action == 'mouseenter' && e2.action == 'mouseleave' || e1.action == 'mouseleave' && e2.action == 'mouseenter') {
                  this.splice(i, 1);
                }
              }
            }
          }
        }
        parent.game_resetAnimStack();
      }
      
      var execNext = function() {
        setTimeout(function() {
          if (!group.game_hover && !group.game_cancelothers) {
            parent.game_animstack.splice(0, 1);  
            if (parent.game_animstack.length > 0) {
              var e = parent.game_animstack[0];
              e.func();
            }
          } else {
            if (!group.game_cancelothers) parent.game_resetAnimStack();
          }
        }, 1)
      }
      
      var close = function() {
        // console.log("CLOSE");
        if (!!group.getParent() && !!group.game_open) {
          var tween = new Kinetic.Tween({
            node: group,
            duration: 0.25,
            scaleX: 0.5,
            scaleY: 0.5,
            easing: Kinetic.Easings['EaseIn'],
            y: group.game_oldY,
            onFinish: function() {
              group.game_open = false;
              execNext();
            }
          });
          tween.play();
        } else {
          execNext(); 
        }
      }
      
      var open = function() {
        // console.log("OPEN");
        if (!group.game_open && !!group.getParent()) {
          group.game_oldY = group.getY();
          group.game_oldsx = group.getScaleX();
           
          var tween = new Kinetic.Tween({
            node: group,
            duration: 0.25,
            scaleX: 1,
            scaleY: 1,
            easing: Kinetic.Easings['EaseOut'],
            y: group.getY()-250,
            onFinish: function() {
              group.game_open = true;
              execNext();
            }
          });
          tween.play();
        } else {
          execNext();
        }
      }
      
      if (hover) {
        group.on('mouseenter', function(evt) {
          // console.log("OVER CARD");
          evt.cancelBubble = false;
          
          parent.game_animstack.push({
            obj: group,
            action: 'mouseenter',
            func: open
          });
          
          parent.game_animstack.optimize();
          
          if (parent.game_animstack.length == 1) {
            var e = parent.game_animstack[0];
            e.func();
          }
        });
        group.on('mouseleave', function(evt) {
          // console.log("LEAVE CARD");
          evt.cancelBubble = false;
          
          parent.game_animstack.push({
            obj: group,
            action: 'mouseleave',
            func: close
          });
          
          parent.game_animstack.optimize();
          
          if (parent.game_animstack.length == 1) {
            var e = parent.game_animstack[0];
            e.func();
          }
        });
        group.on('click', function(evt) {
           var node = evt.targetNode;
           if (!!node.game_clicked) {
             node.game_clicked();
           }
        });
        group.on('scaleXChange', function(evt) {
          if (!group.game_cancelothers) {
            var g = group;
            
            var diff = group.getWidth()*group.getScaleX() - group.getWidth()*group.game_oldsx;
            do {
              g = g.game_rightCard;
              if (!!g) {
                if (!g.game_origx) g.game_origx = g.getX();
                g.setX(g.game_origx + diff);
                if (!!g.getParent()) g.draw();
              }
            } while (!!g);
          }
        });
      }
      
    }
    parent.add(group);
    
    return group;
  } catch (ex) {
    console.log("Error while rendering GameCard");
    console.log(ex.toString());
  }
}