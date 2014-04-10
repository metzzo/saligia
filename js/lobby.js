var app = angular.module('lobby', [ 'ui.bootstrap' ]);

var AppCtrl = function($scope, $modal, socket) {
  var appCtrl = this;
  
  $scope.rooms = [ ];
  $scope.hasConnection = !!socket.mock;
  
  $scope.openHost = function() {
    var modalInstance = $modal.open({
      templateUrl: 'hostModal.html',
      controller: HostCtrl
    });
  };
  
  $scope.joinGame = function(data) {
    console.log("join game");
    
    socket.emit('request_join', {
      name: data.name
    });
  };
  
  socket.emit('request_lobbylist');
  
  socket.on('response_lobbylist', function(data) {
    $scope.rooms = data;
  });
  
  socket.on('response_join', function(data) {
    console.log("Join room "+data.room.name);
    if (!!data.error) {
      console.log("Invalid password");
    } else {
      // create room
      var found = false;
      for (var i = 0; i < $scope.rooms.length; i++) {
        if ($scope.rooms[i].name == data.room.name) {
         found = true;
         break;
        }
      }
      if (!found) $scope.rooms.push(data.room);
      
      // open dialog
      var modalInstance = $modal.open({
        templateUrl: 'lobbyModal.html',
        controller: RoomCtrl,
        resolve: {
          joinParams: function() {
            return {
              getRoom: function() {
                for (var i = 0; i < $scope.rooms.length; i++) {
                  var room = $scope.rooms[i];
                  if (room.name == data.room.name) return room;
                }
                return null;
              },
              getName: function() {
                return data.room.name
              },
              getMe: function() {
                return data.me
              }
            };
          }
        }
      });      
    }
  });
  
  socket.on('response_updateroom', function(data) {
    console.log("Update room "+data.name+" count "+data.peers.length);
    var found = false;
    for (var i = 0; i < $scope.rooms.length; i++) {
      var room = $scope.rooms[i];
      if (room.name == data.name) {
        $scope.rooms[i] = data;
        found = true;
        break;
      }
    }
    if (!found && data.peers.length > 0) {
      // does not exist yet
      $scope.rooms.push(data);
    }
  });
};

var HostCtrl = function($scope, $modalInstance, socket) {
  $scope.enablePassword = false;
  $scope.name = "";
  $scope.password = "";
  
  $scope.hostGame = function() {
    console.log("host game");
    
    socket.emit('request_host', {
      name: $scope.name,
      pw: $scope.enablePassword ? $scope.password : null
    });
    
    $modalInstance.close();
  };
  
  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
};

var RoomCtrl = function($scope, $modalInstance, $window, $timeout, $modal, socket, joinParams) {
  $scope.getName = joinParams.getName;
  $scope.getMe = joinParams.getMe;
  $scope.getRoom = joinParams.getRoom;
  
  
  socket.on('response_startgame', function(data) {
    // file://localhost/Users/rfischer/Documents/Programming/Saligia/game.html
    var gameUrl = 'http://metzzo.lacerta.uberspace.de/Saligia/game.html?name='+encodeURIComponent($scope.getReallyMe().name)+"&id="+encodeURIComponent(data.gameId)+"&startnew=1"+"&count="+encodeURIComponent(data.room.peers.length);
    
    var modalInstance = $modal.open({
      templateUrl: 'gameModal.html',
      controller: GameCtrl,
      windowClass: 'gameModal',
      resolve: {
        gameParams: function() {
          return {
            url: gameUrl
          };
        }
      }
    });
    
    $scope.close();
  });
  
  $scope.getReallyMe = function() {
    var room = $scope.getRoom();
    
    if (!!room && !!room.peers) {
      var peers = room.peers;
      for (var i = 0; i < peers.length; i++) {
        var peer = peers[i];
        if (peer.id == $scope.getMe()) return peer;
      }
    }
    return null;
  };
  
  $scope.amIHost = function() {
    var peer = $scope.getReallyMe();
    return !!peer ? peer.host : false;
  };
  
  $scope.getFreeSlots = function() {
    var room = $scope.getRoom();
    if (!!room) {
      var peerLength = room.peers.length;
      var arr = new Array(6 - peerLength);
      for (var i = 0; i < arr.length; i++) {
        arr[i] = "Leerer Slot #"+(peerLength + i + 1);
      }
      return arr;
    } else {
      return [ ];
    }
  };
  
  $scope.getPeers = function() {
    var room = $scope.getRoom();
    if (!!room) {
      return room.peers;
    }
  };
  
  $scope.kickPeer = function(peer) {
    socket.emit('request_kickpeer', {
      room: $scope.getName(),
      peer: peer.id
    });
  };
  
  $scope.startGame = function() {
    // send to server that id like to start the game
    socket.emit('request_startgame', {
      room: $scope.getName()
    });
  };
  
  $scope.close = function() {
    try {
      $modalInstance.dismiss('cancel');
    } catch (e) { } // fails if already dismissed
  };
  
  
  // send leaveroom to server
  var cleanUp = function() {
    socket.emit('request_leaveroom');
  };
  $modalInstance.result.then(cleanUp, cleanUp);
  
  $scope.$watch($scope.getPeers, function(newVal, oldVal) {
    var notInArray = true;
    var peers = $scope.getPeers();
    // am i still in the array?
    if (peers) {
      for (var i = 0; i < peers.length; i++) {
        var peer = peers[i];
        if (peer.id == $scope.getMe()) {
          notInArray = false;
          break;
        }
      }
    }
    
    if (notInArray) {
      console.log("No peers / kicked => Host has left");
      $scope.close();
    }
  });
  
  $scope.$watch("getReallyMe().name", function(newVal, oldVal) {
    $timeout(function() {
      var reallyMe = $scope.getReallyMe();
      // check if i am the last "iteration"
      if (reallyMe && newVal == reallyMe.name) {
        // send new name
        socket.emit('request_updatepeer', {
          room: $scope.getName(),
          peer: reallyMe
        });
      }
    }, 250);
  });
};


var GameCtrl = function($scope, $modalInstance, gameParams) {
  $scope.url = gameParams.url;
  
  $scope.close = function() {
    try {
      $modalInstance.dismiss('cancel');
    } catch (e) { } // fails if already dismissed
  };
};



