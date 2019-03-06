module.exports = function IOSService($http) {
  var iosService = {}

  var cacheStatus = null

  /**
   * get device status
   * @param device the ios device
   * @returns {*}
   */
  iosService.getStatus = function(device) {
    if (cacheStatus) {
      return Promise.resolve(cacheStatus)
    }
    else {
      return $http.get(`${device.ios}/status`).then(rsp => {
        cacheStatus = rsp.data
        return cacheStatus
      })
    }
  }

  /**
   * goto home
   * @param device the ios device
   * @returns {*}
   */
  iosService.home = function(device) {
    return $http.post(`${device.ios}/wda/homescreen`, {}).then(rsp => rsp.data)
  }

  /**
   * user drag to controller is
   * @param device the ios device
   * @param fromX the from x value
   * @param fromY the from y value
   * @param toX the to x value
   * @param toY the to y value
   * @param duration the time user pressed
   * @return {*}
   */
  iosService.drag = function(device, fromX, fromY, toX, toY, duration) {
    return this.getStatus(device).then(status => {
      var url = `${device.ios}/session/${status.sessionId}/wda/element/0/dragfromtoforduration`
      return $http.post(url, {
        'fromX': fromX,
        'fromY': fromY,
        'toX': toX,
        'toY': toY,
        'duration': duration
      }).then(rsp => rsp.data)
    })
  }

  /**
   * user tap screen
   * @param device the device
   * @param x the x value
   * @param y the y value
   * @return {*}
   */
  iosService.tap = function(device, x, y) {
    return this.getStatus(device).then(status => {
      var url = device.ios + '/session/' + status.sessionId + '/wda/tap/0'
      return $http.post(url, {
        'x': x,
        'y': y,
      }).then(rsp => rsp.data)
    })
  }

  /**
   * user key triggered
   * @param device the device
   * @param key the key value
   * @return {*}
   */
  iosService.key = function(device, key) {
    return this.getStatus(device).then(status => {
      var url = device.ios + '/session/' + status.sessionId + '/wda/keys'
      return $http.post(url, {
        'value': [key],
      }).then(rsp => rsp.data)
    })
  }

  return iosService
}
