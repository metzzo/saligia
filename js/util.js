function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

function getTimerAll() {
	return Date.now();
}

function isStorageSupported() {
  try {
    return 'sessionStorage' in window && window['sessionStorage'] !== null;
  } catch (e) {
    return false;
  }
}

function createButton(parent, params, active, click) {
    if (!!active) {
        params.opacity = 1;
    } else {
        params.opacity = 0.25;
    }
    
    var rect
    parent.add(rect = new Kinetic.Rect(params));
    
    params.fontSize = 14;
    params.fontFamily = 'Arial';
    params.fill = 'black';
    params.padding = 5;
    params.align = 'center';    
    
    var text;
    parent.add(text = new Kinetic.Text(params));
    if (!!click) {
        text.game_clicked = click;
    }
}

function getAngle(currentDeg, rotation) {
  var oneWay = rotation - currentDeg;
  var oneWayAbsolute = Math.abs(rotation - currentDeg);
  var otherWay = 360-oneWayAbsolute;
  var trueRotation;
  
  if (otherWay < oneWayAbsolute) { 
      //Take the other way
      if (oneWay > 0) {
          //Clicked direction was positive/clockwise
          trueRotation = currentDeg - otherWay;
      } else {
          //Clicked direction was negative/counter clockwise
          trueRotation = currentDeg + otherWay;
      }
  } else {
      //Take the clicked way
      trueRotation = rotation;
  }
  return trueRotation;
}

function getUrlVars(){
  var vars = [], hash;
  var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
  for(var i = 0; i < hashes.length; i++) {
    hash = hashes[i].split('=');
    vars.push(hash[0]);
    vars[hash[0]] = decodeURIComponent(hash[1]);
  }
  return vars;
}