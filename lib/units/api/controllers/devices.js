var _ = require('lodash')
var Promise = require('bluebird')

var dbapi = require('../../../db/api')
var logger = require('../../../util/logger')
var datautil = require('../../../util/datautil')
var iosDeviceHelper = require('../helpers/iosDevice')

var log = logger.createLogger('api:controllers:devices')

module.exports = {
  getDevices: getDevices
, getDeviceBySerial: getDeviceBySerial, rebootDeviceByName: rebootDeviceByName
}

function extendIOSDevice(device) {
  var tmp = (device.channel || '').split('-')
  if (tmp.length < 3 || tmp[1] !== 'iOS') {
    device.host = device.serial
    return
  }
  device.host = tmp[2]
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
            extendIOSDevice(responseDevice)
            if (fields) {
              responseDevice = _.pick(device, fields.split(','))
            }
            deviceList.push(responseDevice)
          })

          res.json({
            success: true
          , devices: deviceList
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


function rebootDeviceByName(req, res) {
  var name = req.swagger.params.name.value
  iosDeviceHelper.rebootDevice(name).then(rsp => {
    res.json({
      success: true
      , message: rsp
    })
  }).catch(err => {
    log.error('Failed to reboot device: ', name, err)
    res.status(500).json({
      success: false
      , message: err
    })
  })
}
function getDeviceBySerial(req, res) {
  var serial = req.swagger.params.serial.value
  var fields = req.swagger.params.fields.value

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
      extendIOSDevice(responseDevice)
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
