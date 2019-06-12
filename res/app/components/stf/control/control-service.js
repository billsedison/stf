var _ = require('lodash')

var iosPoints = {}

module.exports = function ControlServiceFactory(
  $upload
, $http
, socket
, TransactionService
, $rootScope
, gettext
, KeycodesMapped
) {
  var controlService = {
  }

  function ControlService(target, channel) {
    var iOSHost = 'http://' + target.host + ':8100/'

    var getStatus = function() {
      return $http.get(iOSHost + 'status').then(ret => {
        return ret.data.sessionId
      })
    }

    function sendOneWay(action, data) {
      if(target.platform === 'iOS') {
        target.display = target.display || {}
        target.display.rotation = target.display.rotation || 0
        var isLandscape = function() {
          return target && target.display && (
            target.display.rotation === 90 || target.display.rotation === 270
          )
        }

        var isIpad = function() {
          return target && target.product && target.product.indexOf('iPad') >= 0
        }
        var rootContainer = document.getElementById('screen-container')
        var videoEle = document.getElementById('screenshot')
        var cordConvert = (p) => {
          var scale = videoEle.style.transform.substr('scale('.length)
          scale = scale.substr(0, scale.length - 1)
          scale = parseFloat(scale)
          var vw = videoEle.offsetWidth
          var vh = videoEle.offsetHeight
          if (isLandscape()) {
            vw = videoEle.offsetHeight
            vh = videoEle.offsetWidth
          }

          var offsetX = (rootContainer.offsetWidth - vw * scale) * 0.5
          var offsetY = (rootContainer.offsetHeight - vh * scale) * 0.5
          var ret = {
            x: (p.x * rootContainer.offsetWidth - offsetX) / scale,
            y: (p.y * rootContainer.offsetHeight - offsetY) / scale,
          }
          if (ret.x < 0) {
            ret.x = 0
          }
          if (ret.x > vw) {
            ret.x = vw
          }
          if (ret.y < 0) {
            ret.y = 0
          }
          if (ret.y > vh) {
            ret.y = vh
          }

          if (target.display.rotation === 180) { // revert y
            ret.y = vh - ret.y
            ret.x = vw - ret.x
          }
          else if (target.display.rotation === 90 || target.display.rotation === 270) {
            if (isIpad()) {
              var t = ret.x
              ret.x = ret.y
              ret.y = t
              if (target.display.rotation === 90) {
                ret.x = vh - ret.x
              }
              else {
                ret.y = vw - ret.y
              }
            }
          }
          return ret
        }

        var tap = function(data, pIndex) {
          var p = cordConvert(data)
          getStatus().then(sessionId => {
            $http.post(iOSHost + 'session/' + sessionId + '/wda/tap/' + pIndex,
              JSON.stringify(p), {
                headers: {'Content-Type': 'text/plain'}
              })
          })
        }

        var drag = function(d1, d2, duration, pIndex) {
          var fp = cordConvert(d1)
          var ep = cordConvert(d2)
          getStatus().then(sessionId => {
            $http.post(iOSHost + 'session/' +
              sessionId + `/wda/element/${pIndex}/dragfromtoforduration`,
              JSON.stringify({
                fromX: fp.x,
                fromY: fp.y,
                toX: ep.x,
                toY: ep.y,
                duration: duration,
              }), {
                headers: {'Content-Type': 'text/plain'}
              })
          })
        }

        if(action === 'input.keyDown' && data) {
          if(data.key === 'home') {
            $http.post(iOSHost + 'wda/homescreen')
          } else if (data.key === 'enter' || data.key === 'del') {
            $http.get(iOSHost + 'status').then(ret => {
              var sessionId = ret.data.sessionId
              $http.post(iOSHost + 'session/' + sessionId + '/wda/keys',
                JSON.stringify({
                  value: [data.key === 'enter' ? '\u000d' : '\u007F']
                }), {
                  headers: {'Content-Type': 'text/plain'}
                })
            })
          }
        }

        var pointIndex = data.contact
        if (action === 'input.touchDown') {
          iosPoints[pointIndex] = {
            p: Object.assign({}, data, {timestamp: Date.now()}),
            e: null,
            isMoving: false,
            over: false,
          }
        }
        else if (action === 'input.touchMove') {
          iosPoints[pointIndex].isMoving = true
          iosPoints[pointIndex].e = Object.assign({}, data, {timestamp: Date.now()})
        }
        else if (action === 'input.touchUp') {
          var size = _.size(iosPoints)
          if (size <= 1) {
            if (!iosPoints[pointIndex].isMoving) {
              tap(iosPoints[pointIndex].p, pointIndex)
            }
            else if (iosPoints[pointIndex].p && iosPoints[pointIndex].e) {
              var p = iosPoints[pointIndex].p
              var e = iosPoints[pointIndex].e
              drag(p, e, (e.timestamp - p.timestamp) / 1000, pointIndex)
            }
            iosPoints[pointIndex] = {}
          }
          else {
            iosPoints[pointIndex].over = true
            var left = _.filter(iosPoints, pp => pp.over)
            if (left.length === size) {

              var distance = function(p, e) {
                return Math.sqrt((p.x - e.x) * (p.x - e.x) + (p.y - e.y) * (p.y - e.y))
              }
              var path1 = iosPoints[0]
              var path2 = iosPoints[1]
              var d1 = distance(path1.p, path2.p)
              var d2 = distance(path2.e, path1.e)
              var scale = 1 + d2 - d1
              var v = ((path1.e.timestamp - path1.p.timestamp) / 1000) * (scale < 1 ? -1 : 1) * 2
              console.log('pinch, scale = ' + scale + ', velocity' + v)
              getStatus().then(sessionId => {
                $http.post(iOSHost + 'session/' + sessionId + '/wda/pinch',
                  JSON.stringify({velocity: v, scale: scale}), {
                    headers: {'Content-Type': 'text/plain'}
                  })
              })
              iosPoints = {}
            }
          }
        }
        else if (action === 'input.keyPress') {
          $http.post(iOSHost + 'keyPress?key=' + data.key)
        }
        if (action === 'display.rotate') {
          getStatus().then(sessionId => {
            $http.post(iOSHost + 'session/' + sessionId + '/orientation',
              JSON.stringify({orientation: data.rotation === 90 ? 'LANDSCAPE' : 'PORTRAIT'}), {
                headers: {'Content-Type': 'text/plain'}
              })
          })
        }
      } else {
        socket.emit(action, channel, data)
      }
    }

    function sendTwoWay(action, data) {
      if (target.platform === 'iOS') {
        if (action === 'device.reboot') {
          return $http.post('/api/v1/devices/rebootDevice?name=' + target.serial)
        }
        else if (action === 'screen.capture') {
          return new Promise((resolve) => {
            return $http.get(iOSHost + 'deviceSS').then(rsp => {
              resolve({
                body: {
                  date: new Date(),
                  href: 'data:image/jpeg;base64,' + rsp.data
                }
              })
            })
          })
        }
      }
      else {
        var tx = TransactionService.create(target)
        socket.emit(action, channel, tx.channel, data)
        return tx.promise
      }
    }

    function keySender(type, fixedKey) {
      return function(key) {
        if (typeof key === 'string') {
          sendOneWay(type, {
            key: key
          })
        }
        else {
          var mapped = fixedKey || KeycodesMapped[key]
          if (mapped) {
            sendOneWay(type, {
              key: mapped
            })
          }
        }
      }
    }

    this.gestureStart = function(seq) {
      sendOneWay('input.gestureStart', {
        seq: seq
      })
    }

    this.gestureStop = function(seq) {
      sendOneWay('input.gestureStop', {
        seq: seq
      })
    }

    this.touchDown = function(seq, contact, x, y, pressure) {
      sendOneWay('input.touchDown', {
        seq: seq
      , contact: contact
      , x: x
      , y: y
      , pressure: pressure
      })
    }

    this.touchMove = function(seq, contact, x, y, pressure) {
      sendOneWay('input.touchMove', {
        seq: seq
      , contact: contact
      , x: x
      , y: y
      , pressure: pressure
      })
    }

    this.touchUp = function(seq, contact) {
      sendOneWay('input.touchUp', {
        seq: seq
      , contact: contact
      })
    }

    this.touchCommit = function(seq) {
      sendOneWay('input.touchCommit', {
        seq: seq
      })
    }

    this.touchReset = function(seq) {
      sendOneWay('input.touchReset', {
        seq: seq
      })
    }

    this.keyDown = keySender('input.keyDown')
    this.keyUp = keySender('input.keyUp')
    this.keyPress = keySender('input.keyPress')

    this.home = keySender('input.keyPress', 'home')
    this.menu = keySender('input.keyPress', 'menu')
    this.back = keySender('input.keyPress', 'back')
    this.appSwitch = keySender('input.keyPress', 'app_switch')

    this.type = function(text) {
      return sendOneWay('input.type', {
        text: text
      })
    }

    this.paste = function(text) {
      return sendTwoWay('clipboard.paste', {
        text: text
      })
    }

    this.copy = function() {
      return sendTwoWay('clipboard.copy')
    }

    //@TODO: Refactor this please
    var that = this
    this.getClipboardContent = function() {
      that.copy().then(function(result) {
        $rootScope.$apply(function() {
          if (result.success) {
            if (result.lastData) {
              that.clipboardContent = result.lastData
            } else {
              that.clipboardContent = gettext('No clipboard data')
            }
          } else {
            that.clipboardContent = gettext('Error while getting data')
          }
        })
      })
    }

    this.shell = function(command) {
      return sendTwoWay('shell.command', {
        command: command
      , timeout: 10000
      })
    }

    this.identify = function() {
      return sendTwoWay('device.identify')
    }

    this.install = function(options) {
      return sendTwoWay('device.install', options)
    }

    this.uninstall = function(pkg) {
      return sendTwoWay('device.uninstall', {
        packageName: pkg
      })
    }

    this.reboot = function() {
      return sendTwoWay('device.reboot')
    }

    this.rotate = function(rotation, lock) {
      return sendOneWay('display.rotate', {
        rotation: rotation,
        lock: lock
      })
    }

    this.testForward = function(forward) {
      return sendTwoWay('forward.test', {
        targetHost: forward.targetHost
      , targetPort: Number(forward.targetPort)
      })
    }

    this.createForward = function(forward) {
      return sendTwoWay('forward.create', {
        id: forward.id
      , devicePort: Number(forward.devicePort)
      , targetHost: forward.targetHost
      , targetPort: Number(forward.targetPort)
      })
    }

    this.removeForward = function(forward) {
      return sendTwoWay('forward.remove', {
        id: forward.id
      })
    }

    this.startLogcat = function(filters) {
      return sendTwoWay('logcat.start', {
        filters: filters
      })
    }

    this.stopLogcat = function() {
      return sendTwoWay('logcat.stop')
    }

    this.startRemoteConnect = function() {
      return sendTwoWay('connect.start')
    }

    this.stopRemoteConnect = function() {
      return sendTwoWay('connect.stop')
    }

    this.openBrowser = function(url, browser) {
      return sendTwoWay('browser.open', {
        url: url
      , browser: browser ? browser.id : null
      })
    }

    this.clearBrowser = function(browser) {
      return sendTwoWay('browser.clear', {
        browser: browser.id
      })
    }

    this.openStore = function() {
      return sendTwoWay('store.open')
    }

    this.screenshot = function() {
      return sendTwoWay('screen.capture')
    }

    this.fsretrieve = function(file) {
      return sendTwoWay('fs.retrieve', {
        file: file
      })
    }

    this.fslist = function(dir) {
      return sendTwoWay('fs.list', {
        dir: dir
      })
    }

    this.checkAccount = function(type, account) {
      return sendTwoWay('account.check', {
        type: type
      , account: account
      })
    }

    this.removeAccount = function(type, account) {
      return sendTwoWay('account.remove', {
        type: type
      , account: account
      })
    }

    this.addAccountMenu = function() {
      return sendTwoWay('account.addmenu')
    }

    this.addAccount = function(user, password) {
      return sendTwoWay('account.add', {
        user: user
      , password: password
      })
    }

    this.getAccounts = function(type) {
      return sendTwoWay('account.get', {
        type: type
      })
    }

    this.getSdStatus = function() {
      return sendTwoWay('sd.status')
    }

    this.setRingerMode = function(mode) {
      return sendTwoWay('ringer.set', {
        mode: mode
      })
    }

    this.getRingerMode = function() {
      return sendTwoWay('ringer.get')
    }

    this.setWifiEnabled = function(enabled) {
      return sendTwoWay('wifi.set', {
        enabled: enabled
      })
    }

    this.getWifiStatus = function() {
      return sendTwoWay('wifi.get')
    }

    window.cc = this
  }

  controlService.create = function(target, channel) {
    iosPoints = {}
    return new ControlService(target, channel)
  }

  return controlService
}
