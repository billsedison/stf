var _ = require('lodash')
var rotator = require('./rotator')
var ImagePool = require('./imagepool')
var flvjs = require('flv.js')

const IOS_VIODE_ID = 'screenshot'

// eslint-disable-next-line
var Base64={_keyStr:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',encode:function(e){var t="";var n,r,i,s,o,u,a;var f=0;e=Base64._utf8_encode(e);while(f<e.length){n=e.charCodeAt(f++);r=e.charCodeAt(f++);i=e.charCodeAt(f++);s=n>>2;o=(n&3)<<4|r>>4;u=(r&15)<<2|i>>6;a=i&63;if(isNaN(r)){u=a=64}else if(isNaN(i)){a=64}t=t+this._keyStr.charAt(s)+this._keyStr.charAt(o)+this._keyStr.charAt(u)+this._keyStr.charAt(a)}return t},decode:function(e){var t="";var n,r,i;var s,o,u,a;var f=0;e=e.replace(/[^A-Za-z0-9\+\/\=]/g,"");while(f<e.length){s=this._keyStr.indexOf(e.charAt(f++));o=this._keyStr.indexOf(e.charAt(f++));u=this._keyStr.indexOf(e.charAt(f++));a=this._keyStr.indexOf(e.charAt(f++));n=s<<2|o>>4;r=(o&15)<<4|u>>2;i=(u&3)<<6|a;t=t+String.fromCharCode(n);if(u!=64){t=t+String.fromCharCode(r)}if(a!=64){t=t+String.fromCharCode(i)}}t=Base64._utf8_decode(t);return t},_utf8_encode:function(e){e=e.replace(/\r\n/g,"\n");var t="";for(var n=0;n<e.length;n++){var r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r)}else if(r>127&&r<2048){t+=String.fromCharCode(r>>6|192);t+=String.fromCharCode(r&63|128)}else{t+=String.fromCharCode(r>>12|224);t+=String.fromCharCode(r>>6&63|128);t+=String.fromCharCode(r&63|128)}}return t},_utf8_decode:function(e){var t="";var n=0;var r=c1=c2=0;while(n<e.length){r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r);n++}else if(r>191&&r<224){c2=e.charCodeAt(n+1);t+=String.fromCharCode((r&31)<<6|c2&63);n+=2}else{c2=e.charCodeAt(n+1);c3=e.charCodeAt(n+2);t+=String.fromCharCode((r&15)<<12|(c2&63)<<6|c3&63);n+=3}}return t}}


module.exports = function DeviceScreenDirective(
  $document
, ScalingService
, VendorUtil
, PageVisibilityService
, $timeout
, $window
) {
  return {
    restrict: 'E'
  , template: require('./screen.pug')
  , scope: {
      control: '&'
    , device: '&'
    }
  , link: function(scope, element) {
      var URL = window.URL || window.webkitURL
      var BLANK_IMG =
        'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
      var cssTransform = VendorUtil.style(['transform', 'webkitTransform'])

      var device = scope.device()
      scope.deviceType = device.platform
      var isIOS = device.platform === 'iOS'
      var control = scope.control()
      var input = element.find('input')

      var screen = scope.screen = {
        rotation: 0
      , bounds: {
          x: 0
        , y: 0
        , w: 0
        , h: 0
        }
      }

      var scaler = ScalingService.coordinator(
        device.display.width
      , device.display.height
      )

      var flvPlayer = null

      /**
       * SCREEN HANDLING
       *
       * This section should deal with updating the screen ONLY.
       */
      ;(function() {
        function stop() {
          try {
            if(device.platform === 'iOS') {
              if(flvPlayer) {
                flvPlayer.pause()
                flvPlayer.unload()
                flvPlayer.detachMediaElement()
                flvPlayer.destroy()
                flvPlayer = null
              }
            } else {
              ws.onerror = ws.onclose = ws.onmessage = ws.onopen = null
              ws.close()
              ws = null
            }
          }
          catch (err) { /* noop */ }
        }

        var canvasAspect = 1
        var parentAspect = 1

        function isLandscape() {
          return device && device.display && (
            device.display.rotation === 90 || device.display.rotation === 270
          )
        }

        function resizeListener() {
          parentAspect = element[0].offsetWidth / element[0].offsetHeight
          if (isIOS) {
            var videoElement = document.getElementById('screenshot')
            if (isLandscape()) {
              canvasAspect = videoElement.offsetHeight / videoElement.offsetWidth
            }
            else {
              canvasAspect = videoElement.offsetWidth / videoElement.offsetHeight
            }
            resizeIOSVideo()
          }
          else {
            maybeFlipLetterbox()
          }
        }

        function resizeIOSVideo() {
          var containerEle = element[0]
          var videoEle = document.getElementById('screenshot')
          if (!containerEle || !videoEle) {
            return
          }
          var sx = containerEle.offsetWidth / videoEle.offsetWidth
          var sy = containerEle.offsetHeight / videoEle.offsetHeight
          if (isLandscape()) {
            sx = containerEle.offsetWidth / videoEle.offsetHeight
            sy = containerEle.offsetHeight / videoEle.offsetWidth
          }
          var scale = Math.min(sx, sy)
          var transform = `scale(${scale})`
          transform += `rotate(-${device.display.rotation}deg)`
          videoEle.style.transform = transform
        }


        function maybeFlipLetterbox() {
          element[0].classList.toggle(
            'letterboxed', parentAspect < canvasAspect)
        }

        $window.addEventListener('resize', resizeListener, false)
        scope.$on('fa-pane-resize', resizeListener)

        resizeListener()

        scope.$on('$destroy', function() {
          stop()
          $window.removeEventListener('resize', resizeListener, false)
        })


        if(isIOS) {
          loadIOSVideo()
          var videoElement = document.getElementById(IOS_VIODE_ID)
          scope.$watch('$parent.showScreen', () => {
            if (!scope.$parent.showScreen) {
              videoElement.style.display = 'none'
            }
            else {
              videoElement.style.display = ''
            }
          })

          scope.$watch('$parent.device.display.rotation', () => {
            resizeListener()
          })
          return
        }
        function loadIOSVideo() {

          if (flvjs && flvjs.isSupported()) {
            var device = scope.device()
            var suffix = Base64.encode(device._name)
            var videoElement = document.getElementById(IOS_VIODE_ID)
            videoElement.style.transform = 'scale(0.0)'
            var flvPlayer = flvjs.createPlayer({
              type: 'flv',
              isLive: true,
              hasAudio: false,
              url: 'ws://localhost:8000/live/stream-' + suffix + '.flv',
            }, {
              enableStashBuffer: false,
              lazyLoad: false,
              fixAudioTimestampGap: false,
              accurateSeek: true,
              autoCleanupSourceBuffer: true,
              enableWorker: true,
            })
            flvPlayer.attachMediaElement(videoElement)
            flvPlayer.load()
            flvPlayer.play()

            flvPlayer.on(flvjs.Events.METADATA_ARRIVED, () => {
              setTimeout(() => resizeListener(), 100)
            })
            flvPlayer.on(flvjs.Events.MEDIA_INFO, () => {
              setTimeout(() => resizeListener(), 100)
            })
            flvPlayer.on(flvjs.Events.LOADING_COMPLETE, () => {
              setTimeout(() => resizeListener(), 100)
            })
            setTimeout(() => resizeListener(), 1000)

            var startTime = Date.now()
            videoElement.addEventListener('progress', function() {
              var bf = this.buffered
              var time = this.currentTime
              if (bf.length <= 0) {
                return
              }
              if (this.buffered.end(0) - time > 4) {
                // eslint-disable-next-line
                console.log('delay time = ' + (this.buffered.end(0) - time)
                  + ', total run time = ' + (Date.now() - startTime) / 1000)
                // eslint-disable-next-line
                console.log('adjust timeline to last frame')
                this.currentTime = this.buffered.end(0) - 0.05
              }
            })
          }
        }


        var ws = new WebSocket(device.display.url)
        ws.binaryType = 'blob'

        ws.onerror = function errorListener() {
          // @todo Handle
        }

        ws.onclose = function closeListener() {
          // @todo Maybe handle
        }

        ws.onopen = function openListener() {
          checkEnabled()
        }

        var canvas = element.find('canvas')[0]
        var g = canvas.getContext('2d')
        var positioner = element.find('div')[0]

        function vendorBackingStorePixelRatio(g) {
          return g.webkitBackingStorePixelRatio ||
            g.mozBackingStorePixelRatio ||
            g.msBackingStorePixelRatio ||
            g.oBackingStorePixelRatio ||
            g.backingStorePixelRatio || 1
        }

        var devicePixelRatio = window.devicePixelRatio || 1
        var backingStoreRatio = vendorBackingStorePixelRatio(g)
        var frontBackRatio = devicePixelRatio / backingStoreRatio

        var options = {
          autoScaleForRetina: true
        , density: Math.max(1, Math.min(1.5, devicePixelRatio || 1))
        , minscale: 0.36
        }

        var adjustedBoundSize
        var cachedEnabled = false

        function updateBounds() {
          function adjustBoundedSize(w, h) {
            var sw = w * options.density
            var sh = h * options.density
            var f

            if (sw < (f = device.display.width * options.minscale)) {
              sw *= f / sw
              sh *= f / sh
            }

            if (sh < (f = device.display.height * options.minscale)) {
              sw *= f / sw
              sh *= f / sh
            }

            return {
              w: Math.ceil(sw)
            , h: Math.ceil(sh)
            }
          }

          // FIXME: element is an object HTMLUnknownElement in IE9
          var w = screen.bounds.w = element[0].offsetWidth
          var h = screen.bounds.h = element[0].offsetHeight

          // Developer error, let's try to reduce debug time
          if (!w || !h) {
            throw new Error(
              'Unable to read bounds; container must have dimensions'
            )
          }

          var newAdjustedBoundSize = (function() {
            switch (screen.rotation) {
            case 90:
            case 270:
              return adjustBoundedSize(h, w)
            case 0:
            case 180:
              /* falls through */
            default:
              return adjustBoundedSize(w, h)
            }
          })()

          if (!adjustedBoundSize ||
            newAdjustedBoundSize.w !== adjustedBoundSize.w ||
            newAdjustedBoundSize.h !== adjustedBoundSize.h) {
            adjustedBoundSize = newAdjustedBoundSize
            onScreenInterestAreaChanged()
          }
        }

        function shouldUpdateScreen() {
          return (
            // NO if the user has disabled the screen.
            scope.$parent.showScreen &&
            // NO if we're not even using the device anymore.
            device.using &&
            // NO if the page is not visible (e.g. background tab).
            !PageVisibilityService.hidden &&
            // NO if we don't have a connection yet.
            ws.readyState === WebSocket.OPEN
            // YES otherwise
          )
        }

        function checkEnabled() {
          var newEnabled = shouldUpdateScreen()

          if (newEnabled === cachedEnabled) {
            updateBounds()
          }
          else if (newEnabled) {
            updateBounds()
            onScreenInterestGained()
          }
          else {
            g.clearRect(0, 0, canvas.width, canvas.height)
            onScreenInterestLost()
          }

          cachedEnabled = newEnabled
        }

        function onScreenInterestGained() {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('size ' + adjustedBoundSize.w + 'x' + adjustedBoundSize.h)
            ws.send('on')
          }
        }

        function onScreenInterestAreaChanged() {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('size ' + adjustedBoundSize.w + 'x' + adjustedBoundSize.h)
          }
        }

        function onScreenInterestLost() {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('off')
          }
        }

        ws.onmessage = (function() {
          var cachedScreen = {
            rotation: 0
          , bounds: {
              x: 0
            , y: 0
            , w: 0
            , h: 0
            }
          }

          var cachedImageWidth = 0
          var cachedImageHeight = 0
          var cssRotation = 0
          var alwaysUpright = false
          var imagePool = new ImagePool(10)

          function applyQuirks(banner) {
            element[0].classList.toggle(
              'quirk-always-upright', alwaysUpright = banner.quirks.alwaysUpright)
          }

          function hasImageAreaChanged(img) {
            return cachedScreen.bounds.w !== screen.bounds.w ||
              cachedScreen.bounds.h !== screen.bounds.h ||
              cachedImageWidth !== img.width ||
              cachedImageHeight !== img.height ||
              cachedScreen.rotation !== screen.rotation
          }

          function isRotated() {
            return screen.rotation === 90 || screen.rotation === 270
          }

          function updateImageArea(img) {
            if (!hasImageAreaChanged(img)) {
              return
            }

            cachedImageWidth = img.width
            cachedImageHeight = img.height

            if (options.autoScaleForRetina) {
              canvas.width = cachedImageWidth * frontBackRatio
              canvas.height = cachedImageHeight * frontBackRatio
              g.scale(frontBackRatio, frontBackRatio)
            }
            else {
              canvas.width = cachedImageWidth
              canvas.height = cachedImageHeight
            }

            cssRotation += rotator(cachedScreen.rotation, screen.rotation)

            canvas.style[cssTransform] = 'rotate(' + cssRotation + 'deg)'

            cachedScreen.bounds.h = screen.bounds.h
            cachedScreen.bounds.w = screen.bounds.w
            cachedScreen.rotation = screen.rotation

            canvasAspect = canvas.width / canvas.height

            if (isRotated() && !alwaysUpright) {
              canvasAspect = img.height / img.width
              element[0].classList.add('rotated')
            }
            else {
              canvasAspect = img.width / img.height
              element[0].classList.remove('rotated')
            }

            if (alwaysUpright) {
              // If the screen image is always in upright position (but we
              // still want the rotation animation), we need to cancel out
              // the rotation by using another rotation.
              positioner.style[cssTransform] = 'rotate(' + -cssRotation + 'deg)'
            }

            maybeFlipLetterbox()
          }

          return function messageListener(message) {
            screen.rotation = device.display.rotation

            if (message.data instanceof Blob) {
              if (shouldUpdateScreen()) {
                if (scope.displayError) {
                  scope.$apply(function() {
                    scope.displayError = false
                  })
                }

                var blob = new Blob([message.data], {
                  type: 'image/jpeg'
                })

                var img = imagePool.next()

                img.onload = function() {
                  updateImageArea(this)

                  g.drawImage(img, 0, 0, img.width, img.height)

                  // Try to forcefully clean everything to get rid of memory
                  // leaks. Note that despite this effort, Chrome will still
                  // leak huge amounts of memory when the developer tools are
                  // open, probably to save the resources for inspection. When
                  // the developer tools are closed no memory is leaked.
                  img.onload = img.onerror = null
                  img.src = BLANK_IMG
                  img = null
                  blob = null

                  URL.revokeObjectURL(url)
                  url = null
                }

                img.onerror = function() {
                  // Happily ignore. I suppose this shouldn't happen, but
                  // sometimes it does, presumably when we're loading images
                  // too quickly.

                  // Do the same cleanup here as in onload.
                  img.onload = img.onerror = null
                  img.src = BLANK_IMG
                  img = null
                  blob = null

                  URL.revokeObjectURL(url)
                  url = null
                }

                var url = URL.createObjectURL(blob)
                img.src = url
              }
            }
            else if (/^start /.test(message.data)) {
              applyQuirks(JSON.parse(message.data.substr('start '.length)))
            }
            else if (message.data === 'secure_on') {
              scope.$apply(function() {
                scope.displayError = 'secure'
              })
            }
          }
        })()

        // NOTE: instead of fa-pane-resize, a fa-child-pane-resize could be better
        scope.$on('fa-pane-resize', _.debounce(updateBounds, 1000))
        scope.$watch('device.using', checkEnabled)
        scope.$on('visibilitychange', checkEnabled)
        scope.$watch('$parent.showScreen', checkEnabled)

        scope.retryLoadingScreen = function() {
          if (scope.displayError === 'secure') {
            control.home()
          }
        }

        scope.$on('guest-portrait', function() {
          control.rotate(0)
        })

        scope.$on('guest-landscape', function() {
          control.rotate(90)
        })

      })()

      /**
       * KEYBOARD HANDLING
       *
       * This should be moved elsewhere, but due to shared dependencies and
       * elements it's currently here. So basically due to laziness.
       *
       * For now, try to keep the whole section as a separate unit as much
       * as possible.
       */
      ;(function() {
        function isChangeCharsetKey(e) {
          // Add any special key here for changing charset
          //console.log('e', e)

          // Chrome/Safari/Opera
          if (
            // Mac | Kinesis keyboard | Karabiner | Latin key, Kana key
          e.keyCode === 0 && e.keyIdentifier === 'U+0010' ||

            // Mac | MacBook Pro keyboard | Latin key, Kana key
          e.keyCode === 0 && e.keyIdentifier === 'U+0020' ||

            // Win | Lenovo X230 keyboard | Alt+Latin key
          e.keyCode === 246 && e.keyIdentifier === 'U+00F6' ||

            // Win | Lenovo X230 keyboard | Convert key
          e.keyCode === 28 && e.keyIdentifier === 'U+001C'
          ) {
            return true
          }

          // Firefox
          switch (e.key) {
            case 'Convert': // Windows | Convert key
            case 'Alphanumeric': // Mac | Latin key
            case 'RomanCharacters': // Windows/Mac | Latin key
            case 'KanjiMode': // Windows/Mac | Kana key
              return true
          }

          return false
        }

        function handleSpecialKeys(e) {
          if (isChangeCharsetKey(e)) {
            e.preventDefault()
            control.keyPress('switch_charset')
            return true
          }

          return false
        }

        function keydownListener(e) {
          // Prevent tab from switching focus to the next element, we only want
          // that to happen on the device side.
          if (e.keyCode === 9) {
            e.preventDefault()
          }
          control.keyDown(e.keyCode)
        }

        function keyupListener(e) {
          if (!handleSpecialKeys(e)) {
            control.keyUp(e.keyCode)
          }
        }

        function pasteListener(e) {
          // Prevent value change or the input event sees it. This way we get
          // the real value instead of any "\n" -> " " conversions we might see
          // in the input value.
          e.preventDefault()
          control.paste(e.clipboardData.getData('text/plain'))
        }

        function copyListener(e) {
          e.preventDefault()
          // This is asynchronous and by the time it returns we will no longer
          // have access to setData(). In other words it doesn't work. Currently
          // what happens is that on the first copy, it will attempt to fetch
          // the clipboard contents. Only on the second copy will it actually
          // copy that to the clipboard.
          control.getClipboardContent()
          if (control.clipboardContent) {
            e.clipboardData.setData('text/plain', control.clipboardContent)
          }
        }

        function inputListener() {
          // Why use the input event if we don't let it handle pasting? The
          // reason is that on latest Safari (Version 8.0 (10600.1.25)), if
          // you use the "Romaji" Kotoeri input method, we'll never get any
          // keypress events. It also causes us to lose the very first keypress
          // on the page. Currently I'm not sure if we can fix that one.
          control.type(this.value)
          this.value = ''
        }

        input.bind('keydown', keydownListener)
        input.bind('keyup', keyupListener)
        input.bind('input', inputListener)
        input.bind('paste', pasteListener)
        input.bind('copy', copyListener)
      })()

      /**
       * TOUCH HANDLING
       *
       * This should be moved elsewhere, but due to shared dependencies and
       * elements it's currently here. So basically due to laziness.
       *
       * For now, try to keep the whole section as a separate unit as much
       * as possible.
       */
      ;(function() {
        var slots = []
        var slotted = Object.create(null)
        var fingers = []
        var seq = -1
        var cycle = 100
        var fakePinch = false
        var lastPossiblyBuggyMouseUpEvent = 0

        function nextSeq() {
          return ++seq >= cycle ? (seq = 0) : seq
        }

        function createSlots() {
          // The reverse order is important because slots and fingers are in
          // opposite sort order. Anyway don't change anything here unless
          // you understand what it does and why.
          for (var i = 9; i >= 0; --i) {
            var finger = createFinger(i)
            element.append(finger)
            slots.push(i)
            fingers.unshift(finger)
          }
        }

        function activateFinger(index, x, y, pressure) {
          var scale = 0.5 + pressure
          fingers[index].classList.add('active')
          fingers[index].style[cssTransform] =
            'translate3d(' + x + 'px,' + y + 'px,0) ' +
            'scale(' + scale + ',' + scale + ')'
        }

        function deactivateFinger(index) {
          fingers[index].classList.remove('active')
        }

        function deactivateFingers() {
          for (var i = 0, l = fingers.length; i < l; ++i) {
            fingers[i].classList.remove('active')
          }
        }

        function createFinger(index) {
          var el = document.createElement('span')
          el.className = 'finger finger-' + index
          return el
        }

        function calculateBounds() {

          if (isIOS) {
            var ele = document.getElementById('screen-container')
            scaler = ScalingService.coordinator(
              ele.offsetWidth
              , ele.offsetHeight
            )
          }
          var el = element[0]

          screen.bounds.w = el.offsetWidth
          screen.bounds.h = el.offsetHeight
          screen.bounds.x = 0
          screen.bounds.y = 0

          while (el.offsetParent) {
            screen.bounds.x += el.offsetLeft
            screen.bounds.y += el.offsetTop
            el = el.offsetParent
          }
        }

        function mouseDownListener(event) {
          var e = event
          if (e.originalEvent) {
            e = e.originalEvent
          }

          // Skip secondary click
          if (e.which === 3) {
            return
          }

          e.preventDefault()

          fakePinch = e.altKey

          calculateBounds()
          startMousing()

          var x = e.pageX - screen.bounds.x
          var y = e.pageY - screen.bounds.y
          var pressure = 0.5
          var scaled = scaler.coords(
                screen.bounds.w
              , screen.bounds.h
              , x
              , y
              , screen.rotation
              )

          control.touchDown(nextSeq(), 0, scaled.xP, scaled.yP, pressure)

          if (fakePinch) {
            control.touchDown(nextSeq(), 1, 1 - scaled.xP, 1 - scaled.yP,
              pressure)
          }

          control.touchCommit(nextSeq())

          activateFinger(0, x, y, pressure)

          if (fakePinch) {
            activateFinger(1, -e.pageX + screen.bounds.x + screen.bounds.w,
              -e.pageY + screen.bounds.y + screen.bounds.h, pressure)
          }

          element.bind('mousemove', mouseMoveListener)
          $document.bind('mouseup', mouseUpListener)
          $document.bind('mouseleave', mouseUpListener)

          if (lastPossiblyBuggyMouseUpEvent &&
              lastPossiblyBuggyMouseUpEvent.timeStamp > e.timeStamp) {
            // We got mouseup before mousedown. See mouseUpBugWorkaroundListener
            // for details.
            mouseUpListener(lastPossiblyBuggyMouseUpEvent)
          }
          else {
            lastPossiblyBuggyMouseUpEvent = null
          }
        }

        function mouseMoveListener(event) {
          var e = event
          if (e.originalEvent) {
            e = e.originalEvent
          }

          // Skip secondary click
          if (e.which === 3) {
            return
          }
          e.preventDefault()

          var addGhostFinger = !fakePinch && e.altKey
          var deleteGhostFinger = fakePinch && !e.altKey

          fakePinch = e.altKey

          var x = e.pageX - screen.bounds.x
          var y = e.pageY - screen.bounds.y
          var pressure = 0.5
          var scaled = scaler.coords(
                screen.bounds.w
              , screen.bounds.h
              , x
              , y
              , screen.rotation
              )

          control.touchMove(nextSeq(), 0, scaled.xP, scaled.yP, pressure)

          if (addGhostFinger) {
            control.touchDown(nextSeq(), 1, 1 - scaled.xP, 1 - scaled.yP, pressure)
          }
          else if (deleteGhostFinger) {
            control.touchUp(nextSeq(), 1)
          }
          else if (fakePinch) {
            control.touchMove(nextSeq(), 1, 1 - scaled.xP, 1 - scaled.yP, pressure)
          }

          control.touchCommit(nextSeq())

          activateFinger(0, x, y, pressure)

          if (deleteGhostFinger) {
            deactivateFinger(1)
          }
          else if (fakePinch) {
            activateFinger(1, -e.pageX + screen.bounds.x + screen.bounds.w,
              -e.pageY + screen.bounds.y + screen.bounds.h, pressure)
          }
        }

        function mouseUpListener(event) {
          var e = event
          if (e.originalEvent) {
            e = e.originalEvent
          }

          // Skip secondary click
          if (e.which === 3) {
            return
          }
          e.preventDefault()

          control.touchUp(nextSeq(), 0)

          if (fakePinch) {
            control.touchUp(nextSeq(), 1)
          }

          control.touchCommit(nextSeq())

          deactivateFinger(0)

          if (fakePinch) {
            deactivateFinger(1)
          }

          stopMousing()
        }

        /**
         * Do NOT remove under any circumstances. Currently, in the latest
         * Safari (Version 8.0 (10600.1.25)), if an input field is focused
         * while we do a tap click on an MBP trackpad ("Tap to click" in
         * Settings), it sometimes causes the mouseup event to trigger before
         * the mousedown event (but event.timeStamp will be correct). It
         * doesn't happen in any other browser. The following minimal test
         * case triggers the same behavior (although less frequently). Keep
         * tapping and you'll eventually see see two mouseups in a row with
         * the same counter value followed by a mousedown with a new counter
         * value. Also, when the bug happens, the cursor in the input field
         * stops blinking. It may take up to 300 attempts to spot the bug on
         * a MacBook Pro (Retina, 15-inch, Mid 2014).
         *
         *     <!doctype html>
         *
         *     <div id="touchable"
         *       style="width: 100px; height: 100px; background: green"></div>
         *     <input id="focusable" type="text" />
         *
         *     <script>
         *     var touchable = document.getElementById('touchable')
         *       , focusable = document.getElementById('focusable')
         *       , counter = 0
         *
         *     function mousedownListener(e) {
         *       counter += 1
         *       console.log('mousedown', counter, e, e.timeStamp)
         *       e.preventDefault()
         *     }
         *
         *     function mouseupListener(e) {
         *       e.preventDefault()
         *       console.log('mouseup', counter, e, e.timeStamp)
         *       focusable.focus()
         *     }
         *
         *     touchable.addEventListener('mousedown', mousedownListener, false)
         *     touchable.addEventListener('mouseup', mouseupListener, false)
         *     </script>
         *
         * I believe that the bug is caused by some kind of a race condition
         * in Safari. Using a textarea or a focused contenteditable does not
         * get rid of the bug. The bug also happens if the text field is
         * focused manually by the user (not with .focus()).
         *
         * It also doesn't help if you .blur() before .focus().
         *
         * So basically we'll just have to store the event on mouseup and check
         * if we should do the browser's job in the mousedown handler.
         */
        function mouseUpBugWorkaroundListener(e) {
          lastPossiblyBuggyMouseUpEvent = e
        }

        function startMousing() {
          control.gestureStart(nextSeq())
          input[0].focus()
        }

        function stopMousing() {
          element.unbind('mousemove', mouseMoveListener)
          $document.unbind('mouseup', mouseUpListener)
          $document.unbind('mouseleave', mouseUpListener)
          deactivateFingers()
          control.gestureStop(nextSeq())
        }

        function touchStartListener(event) {
          var e = event
          e.preventDefault()

          //Make it jQuery compatible also
          if (e.originalEvent) {
            e = e.originalEvent
          }

          calculateBounds()

          if (e.touches.length === e.changedTouches.length) {
            startTouching()
          }

          var currentTouches = Object.create(null)
          var i, l

          for (i = 0, l = e.touches.length; i < l; ++i) {
            currentTouches[e.touches[i].identifier] = 1
          }

          function maybeLostTouchEnd(id) {
            return !(id in currentTouches)
          }

          // We might have lost a touchend event due to various edge cases
          // (literally) such as dragging from the bottom of the screen so that
          // the control center appears. If so, let's ask for a reset.
          if (Object.keys(slotted).some(maybeLostTouchEnd)) {
            Object.keys(slotted).forEach(function(id) {
              slots.push(slotted[id])
              delete slotted[id]
            })
            slots.sort().reverse()
            control.touchReset(nextSeq())
            deactivateFingers()
          }

          if (!slots.length) {
            // This should never happen but who knows...
            throw new Error('Ran out of multitouch slots')
          }

          for (i = 0, l = e.changedTouches.length; i < l; ++i) {
            var touch = e.changedTouches[i]
            var slot = slots.pop()
            var x = touch.pageX - screen.bounds.x
            var y = touch.pageY - screen.bounds.y
            var pressure = touch.force || 0.5
            var scaled = scaler.coords(
                  screen.bounds.w
                , screen.bounds.h
                , x
                , y
                , screen.rotation
                )

            slotted[touch.identifier] = slot
            control.touchDown(nextSeq(), slot, scaled.xP, scaled.yP, pressure)
            activateFinger(slot, x, y, pressure)
          }

          element.bind('touchmove', touchMoveListener)
          $document.bind('touchend', touchEndListener)
          $document.bind('touchleave', touchEndListener)

          control.touchCommit(nextSeq())
        }

        function touchMoveListener(event) {
          var e = event
          e.preventDefault()

          if (e.originalEvent) {
            e = e.originalEvent
          }

          for (var i = 0, l = e.changedTouches.length; i < l; ++i) {
            var touch = e.changedTouches[i]
            var slot = slotted[touch.identifier]
            var x = touch.pageX - screen.bounds.x
            var y = touch.pageY - screen.bounds.y
            var pressure = touch.force || 0.5
            var scaled = scaler.coords(
                  screen.bounds.w
                , screen.bounds.h
                , x
                , y
                , screen.rotation
                )

            control.touchMove(nextSeq(), slot, scaled.xP, scaled.yP, pressure)
            activateFinger(slot, x, y, pressure)
          }

          control.touchCommit(nextSeq())
        }

        function touchEndListener(event) {
          var e = event
          if (e.originalEvent) {
            e = e.originalEvent
          }

          var foundAny = false

          for (var i = 0, l = e.changedTouches.length; i < l; ++i) {
            var touch = e.changedTouches[i]
            var slot = slotted[touch.identifier]
            if (typeof slot === 'undefined') {
              // We've already disposed of the contact. We may have gotten a
              // touchend event for the same contact twice.
              continue
            }
            delete slotted[touch.identifier]
            slots.push(slot)
            control.touchUp(nextSeq(), slot)
            deactivateFinger(slot)
            foundAny = true
          }

          if (foundAny) {
            control.touchCommit(nextSeq())
            if (!e.touches.length) {
              stopTouching()
            }
          }
        }

        function startTouching() {
          control.gestureStart(nextSeq())
        }

        function stopTouching() {
          element.unbind('touchmove', touchMoveListener)
          $document.unbind('touchend', touchEndListener)
          $document.unbind('touchleave', touchEndListener)
          deactivateFingers()
          control.gestureStop(nextSeq())
        }

        element.on('touchstart', touchStartListener)
        element.on('mousedown', mouseDownListener)
        element.on('mouseup', mouseUpBugWorkaroundListener)

        createSlots()
      })()
    }
  }
}
