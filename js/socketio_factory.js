app.factory('socket', function ($rootScope) {
  var socket
  try {
    socket = io.connect('http://metzzo.lacerta.uberspace.de:61553/'); // io.connect('http://localhost:61553');
  } catch (ex) {
    // mock it baby
    socket = {
      on: function() { },
      emit: function() { },
      mock: true
    };
  }
  return {
    on: function (eventName, callback) {
      socket.on(eventName, function () {  
        var args = arguments;
        if (!$rootScope.$$phase) {
          $rootScope.$apply(function () {
            callback.apply(socket, args);
          });
        } else {
          callback.apply(socket, args);
        }
      });
    },
    emit: function (eventName, data, callback) {
      socket.emit(eventName, data, function () {
        var args = arguments;
        if (!$rootScope.$$phase) {
          $rootScope.$apply(function () {
            if (callback) {
              callback.apply(socket, args);
            }
          });
        } else {
          if (callback) {
            callback.apply(socket, args);
          }
        }
      })
    }
  };
});