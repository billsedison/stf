var _ = require('lodash')
var flvjs = require('flv.js')
var GestureRecognizer = require('./ios/gesture_recognizer')

var VIDEO_ID = 'ios-screen-video'
var VIODE_CONTAINER_ID = 'ios-screen-container'

module.exports = function DeviceControlCtrl($scope, DeviceService, GroupService, IOSService,
  $location, $timeout, $window, $rootScope) {

  $scope.showScreen = true

  $scope.groupTracker = DeviceService.trackGroup($scope)

  $scope.groupDevices = $scope.groupTracker.devices
  $scope._gestureRecognizer = null

  $scope.kickDevice = function(device) {

    if (!device || !$scope.device) {
      alert('No device found')
      return
    }

    /**
     * kick device, wrap it to support ios
     * @param device the device entry
     * @returns {*}
     */
    var kick = function(device) {

      if (device.platform === 'iOS') {
        return DeviceService.get(device.serial, $scope, 'action,kick').then(d => {
          return GroupService.kick(d)
        })
      }
      else {
        return GroupService.kick(device)
      }
    }

    try {
      // If we're trying to kick current device
      if (device.serial === $scope.device.serial) {

        // If there is more than one device left
        if ($scope.groupDevices.length > 1) {

          // Control first free device first
          var firstFreeDevice = _.find($scope.groupDevices, function(dev) {
            return dev.serial !== $scope.device.serial
          })
          $scope.controlDevice(firstFreeDevice)

          // Then kick the old device
          kick(device).then(function() {
            $scope.$digest()
          })
        } else {
          // Kick the device
          kick(device).then(function() {
            $scope.$digest()
          })
          $location.path('/devices/')
        }
      } else {
        kick(device).then(function() {
          $scope.$digest()
        })
      }
    } catch (e) {
      alert(e.message)
    }
  }

  $scope.controlDevice = function(device) {
    $location.path('/control/' + device.serial)
  }

  function isPortrait(val) {
    var value = val
    if (typeof value === 'undefined' && $scope.device) {
      value = $scope.device.display.rotation
    }
    return (value === 0 || value === 180)
  }

  function isLandscape(val) {
    var value = val
    if (typeof value === 'undefined' && $scope.device) {
      value = $scope.device.display.rotation
    }
    return (value === 90 || value === 270)
  }

  $scope.tryToRotate = function(rotation) {
    if (rotation === 'portrait') {
      $scope.control.rotate(0)
      $timeout(function() {
        if (isLandscape()) {
          $scope.currentRotation = 'landscape'
        }
      }, 400)
    } else if (rotation === 'landscape') {
      $scope.control.rotate(90)
      $timeout(function() {
        if (isPortrait()) {
          $scope.currentRotation = 'portrait'
        }
      }, 400)
    }
  }

  $scope.currentRotation = 'portrait'

  $scope.$watch('device.display.rotation', function(newValue) {
    if (isPortrait(newValue)) {
      $scope.currentRotation = 'portrait'
    } else if (isLandscape(newValue)) {
      $scope.currentRotation = 'landscape'
    }
  })

  // TODO: Refactor this inside control and server-side
  $scope.rotateLeft = function() {
    var angle = 0
    if ($scope.device && $scope.device.display) {
      angle = $scope.device.display.rotation
    }
    if (angle === 0) {
      angle = 270
    } else {
      angle -= 90
    }
    $scope.control.rotate(angle)

    if ($rootScope.standalone) {
      $window.resizeTo($window.outerHeight, $window.outerWidth)
    }
  }

  $scope.rotateRight = function() {
    var angle = 0
    if ($scope.device && $scope.device.display) {
      angle = $scope.device.display.rotation
    }
    if (angle === 270) {
      angle = 0
    } else {
      angle += 90
    }
    $scope.control.rotate(angle)

    if ($rootScope.standalone) {
      $window.resizeTo($window.outerHeight, $window.outerWidth)
    }
  }

  /**
   * check device is ios device or not
   * @returns {boolean} the result
   */
  $scope.isIOS = function() {
    if ($scope.device && $scope.device.platform) {
      return $scope.device.platform === 'iOS'
    }
    return false
  }

  /**
   * resize video size
   */
  function resizeVideo() {
    var containerEle = document.getElementById(VIODE_CONTAINER_ID)
    var videoEle = document.getElementById(VIDEO_ID)
    if (!containerEle || !videoEle) {
      return
    }

    var sx = containerEle.offsetWidth / videoEle.offsetWidth
    var sy = containerEle.offsetHeight / videoEle.offsetHeight
    var scale = Math.min(sx, sy)
    videoEle.style.transform = `scale(${scale})`
  }

  /**
   * load video
   * @param device the ios device
   */
  function loadVideo(device) {
    if (flvjs.isSupported()) {
      var videoElement = document.getElementById(VIDEO_ID)
      videoElement.style.transform = 'scale(0.5)'
      var flvPlayer = flvjs.createPlayer({
        type: 'flv',
        isLive: true,
        url: device.stream,
      }, {
        enableStashBuffer: false,
        lazyLoad: false,
        fixAudioTimestampGap: false,
        enableWorker: true
      })
      flvPlayer.attachMediaElement(videoElement)
      flvPlayer.load()
      flvPlayer.play()

      setTimeout(() => resizeVideo(), 300)
    }
  }

  /**
   * watch device, when device loaded
   */
  $scope.$watch('device', function(newDevice) {
    if (newDevice && newDevice.platform === 'iOS') {
      IOSService.getStatus(newDevice).then(() => {
        loadVideo(newDevice)
      })
    }
  })

  /**
   * watch container width resize, then the video also need resize
   */
  $scope.$watch(function() {
    var ele = document.getElementById(VIODE_CONTAINER_ID)
    if (!ele) {
      return 0
    }
    return ele.offsetWidth
  }, function(newVal) {
    if (newVal <= 0) {
      return
    }
    resizeVideo()
  })

  /**
   * return ios gesture
   * @returns {null|GestureRecognizer} the gesture object
   */
  function gestureRecognizer()
  {
    if (!$scope._gestureRecognizer) {
      $scope._gestureRecognizer = new GestureRecognizer({
        onClick: (point) => {
          IOSService.tap($scope.device, point.x, point.y)
        },
        onDrag: (params) => {
          IOSService.drag($scope.device, params.origin.x, params.origin.y, params.end.x,
            params.end.y, params.duration)
        },
        onKeyDown: (key) => {
          IOSService.key($scope.device, key)
        },
      })
    }
    return $scope._gestureRecognizer
  }

  /**
   * on mouse down event
   * @param ev the event
   */
  $scope.onIOSMouseDown = function(ev) {
    gestureRecognizer().onMouseDown(ev)
  }

  /**
   * on mouse move event
   * @param ev the event
   */
  $scope.onIOSMouseMove = function(ev) {
    gestureRecognizer().onMouseMove(ev)
  }

  /**
   * on mouse up event
   * @param ev the event
   */
  $scope.onIOSMouseUp = function(ev) {
    gestureRecognizer().onMouseUp(ev)
  }

  /**
   * on keyboard down event
   * @param ev the event
   */
  $scope.onIOSKeyDown = function(ev) {
    gestureRecognizer().onKeyDown(ev)
  }

  /**
   * ios goto home page
   */
  $scope.gotoHome = function() {
    if ($scope.isIOS()) {
      IOSService.home($scope.device)
    }
  }

}
