const exec = require('child_process').exec
const _ = require('lodash')
var logger = require('../../../util/logger')

var log = logger.createLogger('api:helpers:iosDevice')

/**
 * execute command
 * @param command the command
 * @param callback thhe command run callback
 * @return {Promise}
 */
function execute(command, callback) {
  return new Promise((resolve, reject) => {
    exec(command, function(error, stdout, stderr) {
      if (error || stderr) {
        return reject(error || stderr)
      }
      return resolve(stdout)
    })
  })
}

/**
 * get device name
 * @param uuid the device uuid
 * @return {*}
 */
function getDeviceName(uuid) {
  return execute('idevicename -u ' + uuid).then(name => {
    return {
      uuid: uuid,
      name: name.substr(0, name.length - 1)
    }
  })
}

// // The field names that we need to extract
// // from getDeviceInfo
// const DEVICE_INFO_DOMAINs = [
//   'com.apple.disk_usage',
//   'com.apple.disk_usage.factory',
//   'com.apple.mobile.battery',
//   com.apple.iqagent
//   com.apple.purplebuddy
//   com.apple.PurpleBuddy
//   com.apple.mobile.chaperone
//   com.apple.mobile.third_party_termination
//   com.apple.mobile.lockdownd
//   com.apple.mobile.lockdown_cache
//   com.apple.xcode.developerdomain
//   com.apple.international
//   com.apple.mobile.data_sync
//   com.apple.mobile.tethered_sync
//   com.apple.mobile.mobile_application_usage
//   com.apple.mobile.backup
//   com.apple.mobile.nikita
//   com.apple.mobile.restriction
//   com.apple.mobile.user_preferences
//   com.apple.mobile.sync_data_class
//   com.apple.mobile.software_behavior
//   com.apple.mobile.iTunes.SQLMusicLibraryPostProcessCommands
//   com.apple.mobile.iTunes.accessories
//   com.apple.mobile.internal
//   com.apple.mobile.wireless_lockdown
//   com.apple.fairplay
//   com.apple.iTunes
//   com.apple.mobile.iTunes.store
//   com.apple.mobile.iTunes
// ]

function _getIndentation(infoTextRow) {
  return infoTextRow.search(/\S/)
}

function _parseKeyValue(infoTextRow) {
  var trimmedRow = infoTextRow.trim()
  var firstColonIndex = trimmedRow.indexOf(':')
  if (firstColonIndex === -1) {
    return {}
  }
  var info = {}
  var key = trimmedRow.substr(0, firstColonIndex)
  // Check if key is an array
  var arrayResult = key.match(/\[\d+\]/)
  if (arrayResult) {
    var arrayKey = key.substr(0, arrayResult.index)
    var arrayLength = parseInt(key.substr(arrayResult.index + 1), 10)
    if (!isNaN(arrayLength)) {
      info.arrayLength = arrayLength
    }
    key = arrayKey
  }
  var value = trimmedRow.substr(firstColonIndex + 1).trim()
  info.key = key
  if (value !== '') {
    info.value = value
  }
  return info
}

function _parseDeviceInfoTextToJSON(infoTextList, indexInfo, indentation, ret) {
  var i = indexInfo.startIndex
  var rowObj
  var thisIndentation = indentation
  while (i < indexInfo.endIndex) {
    var infoTextRow = infoTextList[i]
    var curIndentation = _getIndentation(infoTextRow)
    var parsedKeyValueInfo = _parseKeyValue(infoTextRow)

    if (parsedKeyValueInfo.key) {
      if (curIndentation === thisIndentation) {
        thisIndentation = curIndentation
        if (parsedKeyValueInfo.value) {
          // Normal value
          ret[parsedKeyValueInfo.key] = parsedKeyValueInfo.value
        }
        else if (parsedKeyValueInfo.arrayLength || parsedKeyValueInfo.arrayLength === 0) {
          // Array
          ret[parsedKeyValueInfo.key] = new Array(parsedKeyValueInfo.arrayLength)
          rowObj = ret[parsedKeyValueInfo.key]
        }
        else {
          // Object
          ret[parsedKeyValueInfo.key] = {}
          rowObj = ret[parsedKeyValueInfo.key]
        }
        ++i
        indexInfo.startIndex = i
      }
      else if (curIndentation > thisIndentation && rowObj) {
        var prevIndentation = thisIndentation
        _parseDeviceInfoTextToJSON(infoTextList, indexInfo, curIndentation, rowObj)
        i = indexInfo.startIndex
        rowObj = null
        thisIndentation = prevIndentation
      }
      else {
        return
      }
    }
    else {
      ++i
      indexInfo.startIndex = i
    }
  }
}

function parseDeviceInfo(infoText) {
  var infoTextList = infoText.split('\n')
  var ret = {}
  var indexInfo = {
    startIndex: 0,
    endIndex: infoTextList.length,
  }
  _parseDeviceInfoTextToJSON(infoTextList, indexInfo, 0, ret)
  return ret
}


/**
 * get device info
 * @param uuid the device uuid
 * @return {*}
 */
function getDeviceInfo(stfDeviceName) {
  return new Promise((resolve, reject) => {
    getPluginDevices().then(devices => {
      log.info(`found plugin devices ${JSON.stringify(devices)}`)
      var targetUUID
      for (var i = 0; i < devices.length; i++) {
        var uuid = devices[i].uuid
        var name = devices[i].name
        log.info(`found device => ${uuid} ${name}`)
        if (stfDeviceName === name) {
          targetUUID = uuid
          break
        }
      }
      if (targetUUID) {
        var deviceDefaultInfoPromise = execute('ideviceinfo -u ' + targetUUID).then(infoText => {
          var deviceInfo = parseDeviceInfo(infoText)
          return deviceInfo
        })

        var devicBatteryInfoPromise = execute('ideviceinfo -q com.apple.mobile.battery -u ' + targetUUID).then(infoText => {
          var deviceInfo = parseDeviceInfo(infoText)
          return deviceInfo
        })

        Promise.all([
          deviceDefaultInfoPromise
          , devicBatteryInfoPromise
        ]).then(infoList => {
          var deviceInfo = {
            uuid: targetUUID,
          }
          infoList.forEach(info => {
            Object.assign(deviceInfo, info)
          })
          return resolve(deviceInfo)
        })
      }
      else {
        log.error('not found device with name ' + stfDeviceName)
        reject('not found device with name ' + stfDeviceName)
      }
    })
  })
}

/**
 * get Plugin Devices
 * @return {*}
 */
function getPluginDevices() {
  return execute('idevice_id -l').then(rsp => {
    return Promise.all(_.map(_.uniq(_.filter(rsp.split('\n'),
      item => !_.isEmpty(item))), uuid => getDeviceName(uuid)))
  })
}

/**
 * reboot ios device
 * @param stfDeviceName the stf device name
 * @return {Promise}
 */
function rebootDevice(stfDeviceName) {
  return new Promise((resolve, reject) => {
    getPluginDevices().then(devices => {
      log.info(`found plugin devices ${JSON.stringify(devices)}`)
      var isFound = false
      for (var i = 0; i < devices.length; i++) {
        var uuid = devices[i].uuid
        var name = devices[i].name
        log.info(`found device => ${uuid} ${name}`)
        if (stfDeviceName.indexOf(name.replace(/ /gi, '-').replace(/'/gi, '')) === 0) {
          var cmd = 'idevicediagnostics restart -u ' + uuid
          log.info(`match device uuid = ${uuid}, start reboot device with command ${cmd}`)
          execute(cmd)
            .then(rsp => resolve(rsp)).catch(err => reject(err))
          isFound = true
        }
      }
      if (!isFound) {
        log.error('not found device with name ' + stfDeviceName);
        reject('not found device with name ' + stfDeviceName)
      }
    })
  })
}


module.exports = {
  rebootDevice
  , getDeviceInfo
}
