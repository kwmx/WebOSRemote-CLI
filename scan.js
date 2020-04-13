/*
Scan for WebOS tvs 
Part of this code was used from https://github.com/msloth/lgtv.js
However, it has been edited to work and fit the new nodeJS standard
*/
var dgram = require('dgram');
/*---------------------------------------------------------------------------*/
// send the SSDP discover message that the TV will respond to.
function _send_ssdp_discover(socket)
{
  var ssdp_rhost = "239.255.255.250";
  var ssdp_rport = 1900;

  // these fields are all required
  var ssdp_msg = 'M-SEARCH * HTTP/1.1\r\n';
  ssdp_msg += 'HOST: 239.255.255.250:1900\r\n';
  ssdp_msg += 'MAN: "ssdp:discover"\r\n';
  ssdp_msg += 'MX: 5\r\n';
  ssdp_msg += "ST: urn:dial-multiscreen-org:service:dial:1\r\n";
  ssdp_msg += "USER-AGENT: iOS/5.0 UDAP/2.0 iPhone/4\r\n\r\n";
  var message = Buffer.from(ssdp_msg);

  socket.send(message, 0, message.length, ssdp_rport, ssdp_rhost, function(err, bytes) {
    if (err) throw err;
    //console.log('SSDP message sent to ' + ssdp_rhost +':'+ ssdp_rport);
    //console.log(message.toString());
  });
};
/*---------------------------------------------------------------------------*/
function discover_ip(retry_timeout_seconds, ignore, tv_ip_found_callback)
{
  var server = dgram.createSocket('udp4');
  var timeout = 0;
  var cb = tv_ip_found_callback || undefined;
  var closed = false
  // sanitize parameters and set default otherwise
  if (retry_timeout_seconds && typeof(retry_timeout_seconds) === 'number') {
    timeout = retry_timeout_seconds;
  } else if (!tv_ip_found_callback && typeof(retry_timeout_seconds) === 'function') {
    // overloading, the first parameter was not a timeout, but the callback
    // and we thus assume no timeout is given
    cb = retry_timeout_seconds;
  }

  // when server has opened, send a SSDP discover message
  server.on('listening', function() {
    _send_ssdp_discover(server);
    setTimeout(function(){
        // after timeout seconds, invoke callback indicating failure
        if(closed) return;
        server.close();
        cb(false, "");
    }, timeout * 1000);
  });

  // scan incoming messages for the magic string, close when we've got it
  server.on('message', function(message, remote) {
    //console.log(message.toString('utf8'));
    if (message.indexOf("WebOS") >= 0 && !ignore.includes(remote.address) && !closed) {
        closed = true;
        server.close();
        if (cb) {
            cb(true, remote.address);
        }
    }
  });
  
  server.bind(); // listen to 0.0.0.0:random
  return server;
};
/**
 * Scan the local network for any WebOS TV that is not in the ignore list.
 * If none is found and the time is up call back the function with false.
 * @param {int} timeout 
 * @param {array} ignore 
 * @param {function(bool,string)} cb 
 */
function scanWebOS(timeout, ignore, cb) {
    discover_ip(timeout, ignore, cb)
}

module.exports = scanWebOS;