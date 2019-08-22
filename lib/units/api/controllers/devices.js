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

// Extend the device info, mainly for iOS device
function extendDeviceInfo(device) {
  return new Promise((resolve, reject) => {
    var tmp = (device.channel || '').split('-')
    // Android
    if (tmp.length < 3 || tmp[1] !== 'iOS') {
      device.host = device.serial
      return resolve(device)
    }
    // iOS
    device.host = tmp[2]
    var deviceName = tmp.splice(3).join('-')
    device.name = deviceName
    iosDeviceHelper.getDeviceInfo(deviceName).then(deviceInfo => {
      // carrier info
      if (deviceInfo.CarrierBundleInfoArray && deviceInfo.CarrierBundleInfoArray.length > 0) {
        device.operator = deviceInfo.CarrierBundleInfoArray[0]
          .CFBundleIdentifier.substr('com.apple.'.length) + ' ' +
          deviceInfo.CarrierBundleInfoArray[0].CFBundleVersion
      }
      device.uuid = deviceInfo.uuid
      device.product = deviceInfo.ProductType
      device.model = device.serial + '(' + deviceInfo.ModelNumber + ')'
      if (deviceInfo.PhoneNumber) {
        if (!device.phone) {
          device.phone = {}
        }
        device.phone.phoneNumber = deviceInfo.PhoneNumber
      }
      // ICCID
      if (deviceInfo.IntegratedCircuitCardIdentity) {
        if (!device.phone) {
          device.phone = {}
        }
        device.phone.iccid = deviceInfo.IntegratedCircuitCardIdentity
      }
      // IMEI
      if (deviceInfo.InternationalMobileEquipmentIdentity) {
        if (!device.phone) {
          device.phone = {}
        }
        device.phone.imei = deviceInfo.InternationalMobileEquipmentIdentity
      }
      // IMSI
      if (deviceInfo.InternationalMobileSubscriberIdentity) {
        if (!device.phone) {
          device.phone = {}
        }
        device.phone.imsi = deviceInfo.InternationalMobileSubscriberIdentity
      }
      // Battery level
      if (deviceInfo.BatteryCurrentCapacity) {
        if (!device.battery) {
          device.battery = {}
        }
        device.battery.level = Number(deviceInfo.BatteryCurrentCapacity)
        device.battery.scale = 100
      }

      // Battery status
      if (deviceInfo.FullyCharged === 'true') {
        if (!device.battery) {
          device.battery = {}
        }
        device.battery.status = 'full'
      }
      else if (deviceInfo.BatteryIsCharging === 'true') {
        if (!device.battery) {
          device.battery = {}
        }
        device.battery.status = 'charging'
      }
      else {
        if (!device.battery) {
          device.battery = {}
        }
        device.battery.status = 'not_charging'
      }
      return resolve(device)
    }).catch(err => {
      reject('Failed to get device info: ', deviceName)
    })
  }).catch(err => {
    log.error(err)
    return
  })
}

function getDevices(req, res) {
  var fields = req.swagger.params.fields.value

  dbapi.loadDevices()
    .then(function(cursor) {
      return Promise.promisify(cursor.toArray, cursor)()
        .then(function(list) {
          const extendDeviceInfoPromises = []
          list.forEach(function(device) {
            datautil.normalize(device, req.user)
            var responseDevice = device
            extendDeviceInfoPromises.push(extendDeviceInfo(responseDevice))
          })

          Promise.all(extendDeviceInfoPromises).then(extendDeviceInfoResponseList => {
            if (!extendDeviceInfoResponseList) {
              return
            }
            var deviceList = []
            extendDeviceInfoResponseList.forEach(device => {
              var responseDevice = device
              if (fields) {
                responseDevice = _.pick(device, fields.split(','))
              }
              deviceList.push(responseDevice)
            })
            res.json({
              success: true
            , devices: deviceList
            })
          }).catch(err => log.error(err))
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
    .then((device) => {
      if (!device) {
        return res.status(404).json({
          success: false
        , description: 'Device not found'
        })
      }

      datautil.normalize(device, req.user)
      var responseDevice = device
      return extendDeviceInfo(responseDevice).then(device => {
        var responseDevice = device
        if (fields) {
          responseDevice = _.pick(device, fields.split(','))
        }

        return res.json({
          success: true
        , device: responseDevice
        })
      }).catch(err => log.error(err))
    })
    .catch(function(err) {
      log.error('Failed to load device "%s": ', req.params.serial, err.stack)
      res.status(500).json({
        success: false
      })
    })
}
