var sequencedImages = document.querySelectorAll('.sequenced-image');

var icons = {
  next: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAABKUlEQVRoQ+3a3Q2CMBQF4MMEuomOoJM4gqs4gpvoCLqJI5ibSEKIJoDnhxD6xkObfvf25bQ0WMhoFuLACplbJ9kd2QJ4JZBMyBXADsAxgWFBCnH6dOKRwDAgFwDn3nGyYxiQPYA7gE0Sw4DU/uMYFiSOYUKiGDYkhlFAIhgVxI5RQqwYNcSGcUAsGBdEjnFCpBg3RIZJQCSYFISOSUKomDSEhpkL5AagLi664wngMDT/pyEVyP5GlD4JoSGSECoiBaEjEhAJwg2RIZwQKcIFkSMcEAtCDbEhlBArQgWxIxSQCIINiSGYkCiCBYkjWJBvT2+jQlEvUE36ZOWR7mOoHcHqSFvBwtQxGxxPJ5X+xyRWR9rlF/HDALPAo9did2T0BlgTVgirkqx13ndQeDPbLxBMAAAAAElFTkSuQmCC',
  prev: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAABCElEQVRoQ+3ZUQrCQAyE4enN9CZ6MvUmHk0W3JelCk0ykwTte8v/NUVcsqH5tTXvxx+QPcGsCZwAPCPwGYALgBuAO4CrF6EGzPjZ7UYoAWv8RJw9n5MK8Cl+fEJjCuZLAaDFDzUbQI1nA+jxTIAkngWQxTMA0vhogDw+EpASHwVIi48ApMZ7AenxHkCJeCugTLwFUCr+KKBc/M8BBrjcFCzngVIIC6DUJKyAMggPoATCC0hHRABSEVGANEQkIAURDZAjGAApggWQIZgACYINoCMUACpCBfiGaLHgmAuM9a/4433GKL3gWOMmwh1/9Ehpfks7N7Zes0a+CPqKKTR272HKXyEKpj3gBdDhTjHE+2+kAAAAAElFTkSuQmCC',
  toStart: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAABxUlEQVRoQ+2X0VHEMAxE9yqADqAEOuA6ACqBDqAD6OAoDTphlomZkLGjlawcZMb+Vp60km7tO2Dn57Dz+jEE/PUExwTGBDo7MFaos4Hdn48JCC28BvAK4EGIXQupcraewCOAFwCXQNel2eRsJeBm6vpx1tJILpMTgVqb8Dx1fRnnzSVxvNC14tntEwDuau2ouVwcFbpWOPeb3XoyRmPlCnEsqLUu91PXmdw6a7nCnKiAYmlMrJ5arm5ORMDc0tTiGbfMlcLxCKhZWkRAFuc7tyqgZWleAVmcn7yWAMvSPAI+VizWw/lVc0uAammexFmxpgCPpWUV5eFIAt4BXHioZ4w1BbAWrhBfkbS6/3YkAaVo/og5jasEFZ9JHJeAUjenQQvsOUycxZFtdF4wL6A3ALdBFaVzWRzXRTavma9OdtL7I19adgrHushazeYjjNO4c0yj9Zjr4kQFlLp5Z6iWaz2nQ5xeAR7LtXKp1h1yIWVTLMu1BKjWvZkAy3JVAS6OF6pMgjE1q4zkMjkRqCqCcXOr7MnV5PRAVSHFcj3/n2vsKuccAlShobghINS2xI/GBBKbGUKNCYTalvjRmEBiM0Oo3U/gC+3ZNDHrI2rcAAAAAElFTkSuQmCC',
  toEnd: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAB0ElEQVRoQ+2Y/U0EIRTE31WipWkH2oF2oJWoHWgH2oF2oBVoJoEEWd7C+8qGC/s3DMz8ljn2TjT5c5p8/7QMHE1wEVgEjAmsV8gYoHn6WRJ4IqJbIvo0xgOdayL6NursTm8R+E2L3hHRo2FxLx2VgTzpNdF4VxiBgVIHNKxUN9vgCNQDQeNeaKI0kKdqdEwEyslIDymCysjTMoB5oIkzNqrjZiALPSQavcPJGZDquBuAIDYPGs876j0DmAqqoLGnE2Igi2JhrnJHDJQ6qsodPcR7KYBGq3IlBjJVcXV7GOAqV2pAVbmeBuqq1BoQVW6EgXw4L0e6tjOmW7lRBhz2/k+Cre5ZDLCVO5OBLyK6qX8zZjGAWzEqdvPrH2UAaV04HISPlDp7b4owgFsr0rLWaNYJvUqU4m8prfztoDUAnavRbwcPAj8pcVRd+UgNcDqhBF5S6q0vLYkB6CD13hV9Y0ZLAGlhQet1ulmNksOvMcBWmvAVGtVxe4WQFlIf/RTkXqFuNUYQGKq0AQIaHROBuhol4ZQERNUoWYQ7A6pKaxDw0BETQLOoKq1ayUtHbEBC8PCxZ/nv9OGpSjawCEjSihi7CESkKtFcBCRpRYydnsAfI2iMMdx7IooAAAAASUVORK5CYII='
};

function createUrlFromBase(urlBase, urlNum) {
  return urlBase + urlNum + '.png';
}

Array.prototype.map.call(sequencedImages, function (root) {
  var urlBase = root.attributes['data-base'].value;
  var infoStrings = Array.prototype.map.call(root.querySelectorAll('p'), function (p) {
    return p.innerHTML;
  });
  var urlMaxNum = infoStrings.length;
  var urlNum = 1;

  var imageArea = document.createElement('img');
  imageArea.className = '-sequenced-image-fragment';
  imageArea.src = createUrlFromBase(urlBase, urlNum);

  var divider = document.createElement('div');
  divider.className = '-divider';

  var textArea = document.createElement('div');
  textArea.innerHTML = infoStrings[urlNum - 1];
  textArea.className = '-textArea';

  var leftButton = document.createElement('img');
  leftButton.className = '-control -left -disabled';
  leftButton.src = icons.prev;
  var onLeft = function() {
    rightButton.className = '-control -right';
    if (urlNum > 1) {
      urlNum--;
      imageArea.src = createUrlFromBase(urlBase, urlNum);
      if (urlNum === 1) {
        leftButton.className = '-control -left -disabled';
      }
      textArea.innerHTML = infoStrings[urlNum - 1];
    }
  };
  leftButton.addEventListener('click', onLeft);

  var rightButton = document.createElement('img');
  rightButton.className = '-control -right';
  rightButton.src = icons.next;
  var onRight = function() {
    leftButton.className = '-control -left';
    if (urlNum < urlMaxNum) {
      urlNum++;
      imageArea.src = createUrlFromBase(urlBase, urlNum);
      if (urlNum === urlMaxNum) {
        rightButton.className = '-control -right -disabled';
      }
      textArea.innerHTML = infoStrings[urlNum - 1];
    }
  };
  rightButton.addEventListener('click', onRight);

  root.appendChild(imageArea);
  root.appendChild(divider);
  root.appendChild(leftButton);
  root.appendChild(rightButton);
  root.appendChild(textArea);
});
