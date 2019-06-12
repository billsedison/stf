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
      let isFound = false
      for (let i = 0; i < devices.length; i++) {
        const uuid = devices[i].uuid
        const name = devices[i].name
        log.info(`found device => ${uuid} ${name}`)
        if (stfDeviceName.indexOf(name.replace(/ /gi, '-').replace(/'/gi, '')) === 0) {
          const cmd = 'idevicediagnostics restart -u ' + uuid
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
}
