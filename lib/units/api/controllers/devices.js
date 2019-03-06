var _ = require('lodash')
var Promise = require('bluebird')

var dbapi = require('../../../db/api')
var logger = require('../../../util/logger')
var datautil = require('../../../util/datautil')

var log = logger.createLogger('api:controllers:devices')

var iosDB = require('../iosDB')
var request = require('request')

module.exports = {
  getDevices: getDevices
, getDeviceBySerial: getDeviceBySerial
}


var cachedIOSDevices = {}

/**
 * get ios device data
 * @param iosEntry the ios db entry
 */
function getIOSDevices(iosEntry) {

  const cachedDevice = _.find(cachedIOSDevices,
      d => d.ios === iosEntry.ios && d.stream === iosEntry.stream)

  return new Promise((resolve) => {
    request(`${iosEntry.ios}/device`, {method: 'GET'}, (error, response, body) => {
      if (error || !response || !body) {
        log.error('cannot get ios device from ' + iosEntry.ios)
        resolve({})

        if (cachedDevice) { // switch to offline
          log.info(cachedDevice.serial + 'switch to offline')
          cachedDevice.ready = false
          cachedDevice.present = false
          cachedDevice.remoteConnect = false
          cachedDevice.using = false
          cachedDevice.owner = null
        }
      }
      else {
        const device = JSON.parse(body)
        if (!cachedIOSDevices[device.serial]) {
          cachedIOSDevices[device.serial] = device
        }
        else {
          cachedIOSDevices[device.serial].ready = true
          cachedIOSDevices[device.serial].present = true
          cachedIOSDevices[device.serial].remoteConnect = true
        }

        cachedIOSDevices[device.serial].ios = iosEntry.ios
        cachedIOSDevices[device.serial].stream = iosEntry.stream
        resolve(device)
      }
    })
  })
}

function getDevices(req, res) {
  var fields = req.swagger.params.fields.value

  dbapi.loadDevices()
    .then(function(cursor) {
      return Promise.promisify(cursor.toArray, cursor)()
        .then(function(list) {
          var deviceList = []

          list.forEach(function(device) {
            datautil.normalize(device, req.user)
            var responseDevice = device

            if (fields) {
              responseDevice = _.pick(device, fields.split(','))
            }
            deviceList.push(responseDevice)
          })

          var iosServers = iosDB.iosServers

          Promise.all(_.map(iosServers, entry => getIOSDevices(entry))).then(() => {
            _.each(cachedIOSDevices, v => {
              deviceList.push(v)
            })
            res.json({
              success: true
              , devices: deviceList
            })
          })
        })
    })
    .catch(function(err) {
      log.error('Failed to load device list: ', err.stack)
      res.status(500).json({
        success: false
      })
    })
}

function getDeviceBySerial(req, res) {
  var serial = req.swagger.params.serial.value
  var fields = req.swagger.params.fields.value

  var action = null
  if (fields) {
    var args = fields.split(',')
    var index = _.findIndex(args, arg => arg === 'action')
    if (index >= 0) {
      action = args[index + 1]
      if (args.length <= 2) {
        fields = null
      }
    }
  }
  // find ios first
  const iosDevice = _.find(cachedIOSDevices, (v, k) => k === serial)
  if (iosDevice) {
    var responseDevice = iosDevice
    log.info('get ios device with action = ' + action)
    if (action === 'invite') {
      responseDevice.using = true
      responseDevice.owner = {
        email: 'test@gmail.com'
        , group: 'group id'
        , name: 'test user'
      }
    }
    else if (action === 'kick') {
      responseDevice.using = false
      responseDevice.owner = null
    }
    if (fields) {
      responseDevice = _.pick(iosDevice, fields.split(','))
    }
    res.json({
      success: true
      , device: responseDevice
    })
    return
  }

  dbapi.loadDevice(serial)
    .then(function(device) {
      if (!device) {
        return res.status(404).json({
          success: false
        , description: 'Device not found'
        })
      }

      datautil.normalize(device, req.user)
      var responseDevice = device

      if (fields) {
        responseDevice = _.pick(device, fields.split(','))
      }

      res.json({
        success: true
      , device: responseDevice
      })
    })
    .catch(function(err) {
      log.error('Failed to load device "%s": ', req.params.serial, err.stack)
      res.status(500).json({
        success: false
      })
    })
}
