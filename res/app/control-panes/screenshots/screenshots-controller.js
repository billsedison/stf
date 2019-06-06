module.exports = function ScreenshotsCtrl($scope) {
  $scope.screenshots = []
  $scope.screenShotSize = 400

  $scope.clear = function() {
    $scope.screenshots = []
  }


  $scope.shotSizeParameter = function(maxSize, multiplier) {
    var finalSize = $scope.screenShotSize * multiplier
    var finalMaxSize = maxSize * multiplier

    return (finalSize === finalMaxSize) ? '' :
      '?crop=' + finalSize + 'x'
  }

  $scope.getIOSImageWidth = function(maxSize, multiplier) {
    var finalSize = $scope.screenShotSize * multiplier
    return finalSize
  }

  /**
   * open base64 data url
   * @param base64URL the base 64 url
   */
  function debugBase64(base64URL) {
    const win = window.open()
    win.document.write('<title>screen shot image preview</title><iframe src="' + base64URL + '" ' +
      'frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; ' +
      'height:100%;" allowfullscreen></iframe>')
  }

  $scope.open = function(dataUrl) {
    debugBase64(dataUrl)
  }

  $scope.takeScreenShot = function() {
    $scope.control.screenshot().then(function(result) {
      $scope.$apply(function() {
        $scope.screenshots.unshift(result)
      })
    })
  }

  $scope.zoom = function(param) {
    var newValue = parseInt($scope.screenShotSize, 10) + param.step
    if (param.min && newValue < param.min) {
      newValue = param.min
    } else if (param.max && newValue > param.max) {
      newValue = param.max
    }
    $scope.screenShotSize = newValue
  }
}
