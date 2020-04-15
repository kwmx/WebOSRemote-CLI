#!/usr/bin/env node

const scan = require("./scan.js")
const Configstore = require('configstore');
const packageJson = require('./package.json');
const chalk = require("chalk")
var inquirer = require('inquirer');
const Table = require('cli-table');
const lgtv = require("lgtv2")
const execSync = require('child_process').execSync;
var wol = require('wake_on_lan');

var selected_tv = undefined
var current_tv;
var current_screen;
// Create a Configstore instance
const config = new Configstore(packageJson.name)
var tv_list = config.get("tv_list")
function banner() {
    process.stdout.write('\x1b[2J\n\x1b[0f')
    console.log(chalk.underline.bold.italic.keyword("orange")("\t\t\t\tLG CLI Remote\n") + chalk.cyan(current_screen+"\t\t\t\t\t\t\t") + chalk.blue("v: 1.0.0\n\n\n"))
}
function get_mac_address(ip) {
    if (process.platform === "win32") code = execSync('arp /g ' + ip);
    else code = execSync('arp -n ' + ip)
    code = code.toString('utf8')
    var re = new RegExp(/((([a-zA-Z0-9])|([a-zA-Z0-9])){1,2})((:)|(-))((([a-zA-Z0-9])|([a-zA-Z0-9])){1,2})((:)|(-))((([a-zA-Z0-9])|([a-zA-Z0-9])){1,2})((:)|(-))((([a-zA-Z0-9])|([a-zA-Z0-9])){1,2})((:)|(-))((([a-zA-Z0-9])|([a-zA-Z0-9])){1,2})((:)|(-))((([a-zA-Z0-9])|([a-zA-Z0-9])){1,2})/i);
    var r  = (code).match(re);
    if(r)
        return r[0]
    else return undefined

}
function send_notfication(message) {
    selected_tv.request("ssap://system.notifications/createToast", {message:message})
}
function send_notification_screen() {
    banner();
    inquirer.prompt([
        {
            type: 'input',
            name: 'message',
            message: "Enter a message to send",
        }
    ])
    .then(answers => {
        send_notfication(answers.message)
        tv_control(current_tv.alias, chalk.cyan("Message sent"))
    })
    .catch(error => {
        if(error.isTtyError) {
            console.error(chalk.red("Error") + ": Prompt couldn't be rendered in the current environment")
        } else {
            console.error(chalk.red("Error") + ": Unable to create menu.\nDetails:\n" + error)
        }
    });
}

function get_app_list(cb) {
    selected_tv.request("ssap://com.webos.applicationManager/listLaunchPoints", {}, cb, "launcher")
}
function authrize(alias, address) {
    console.log("Connecting...")
    selected_tv = lgtv({
        url: 'ws://' + address +':3000'
    })
    inquirer.prompt([
        {
        type: 'list',
        name: 'action',
        message: chalk.magenta("Look up on your screen and allow the application."),
        choices: ["Done! I gave it permission (This will save your tv)", "Scan again", "Go back to main menu"],
        filter: function(val) {
                return val.toLowerCase();
            }
        }
    ])
    .then(answers => {
        if(answers.action.includes("done")){
            if(!Array.isArray(tv_list)) tv_list = []
            tv_list.push({
                "alias": alias,
                "address": address
            })
            config.set("tv_list", tv_list)
            interactive_menu()
        }
        else if (answers.action.includes("scan again")) scan_screen(15);
        else interactive_menu()
    })
    .catch(error => {
        if(error.isTtyError) {
            console.error(chalk.red("Error") + ": Prompt couldn't be rendered in the current environment")
        } else {
            console.error(chalk.red("Error") + ": Unable to create menu.\nDetails:\n" + error)
        }
    });
}
function auth_screen(address = undefined) {
    current_screen = "Authrization Menu"
    banner()
    if(address) {
        console.log("Authrizing " + chalk.green(address))
        inquirer.prompt([
            {
                type: 'input',
                name: 'alias',
                message: "What would you to make the alias for this TV?"
            }
        ])
        .then(answers => {
            authrize(answers.alias, address)
        })
        .catch(error => {
            if(error.isTtyError) {
                console.error(chalk.red("Error") + ": Prompt couldn't be rendered in the current environment")
            } else {
                console.error(chalk.red("Error") + ": Unable to create menu.\nDetails:\n" + error)
            }
        });
    } else {
        inquirer.prompt([
            {
                type: 'input',
                name: 'address',
                message: "Please enter the address for the TV",
                validate: function(value) {
                    var pass = value.match(
                        /(?:[0-9]{1,3}\.){3}[0-9]{1,3}/i
                    );
                    if (pass) {
                      return true;
                    }
              
                    return 'Please enter a valid IPv4 address';
                  }
            },
            {
                type: 'input',
                name: 'alias',
                message: "What would you to make the alias for this TV?"
            }
        ])
        .then(answers => {
            authrize(answers.alias, answers.address)
        })
        .catch(error => {
            if(error.isTtyError) {
                console.error(chalk.red("Error") + ": Prompt couldn't be rendered in the current environment")
            } else {
                console.error(chalk.red("Error") + ": Unable to create menu.\nDetails:\n" + error)
            }
        });
    }
}
function interactive_scan_callback(status, address) {
    banner();
    if(status) {
        console.log("Found a WebOS tv. Would you like to authrize it? (" + chalk.green(address) + ")")
        inquirer.prompt([
            {
            type: 'list',
            name: 'action',
            message: chalk.magenta("What would you like to do?"),
            choices: ["Authrize " + chalk.green(address), "Scan again", "Go back to main menu"],
            filter: function(val) {
                    return val.toLowerCase();
                }
            }
        ])
        .then(answers => {
            if(answers.action.includes("authrize")) auth_screen(address);
            else if (answers.action.includes("scan again")) scan_screen(15);
            else interactive_menu()
        })
        .catch(error => {
            if(error.isTtyError) {
                console.error(chalk.red("Error") + ": Prompt couldn't be rendered in the current environment")
            } else {
                console.error(chalk.red("Error") + ": Unable to create menu.\nDetails:\n" + error)
            }
        });
    } else {
        console.log("No WebOS tv was " + chalk.red("found") + ".")
        inquirer.prompt([
            {
            type: 'list',
            name: 'action',
            message: chalk.magenta("Would you like to try again?"),
            choices: ["Yes", "No"],
            filter: function(val) {
                    return val.toLowerCase();
                }
            }
        ])
        .then(answers => {
            if(answers.action == 'yes') scan_screen();
            else interactive_menu();
        })
        .catch(error => {
            if(error.isTtyError) {
                console.error(chalk.red("Error") + ": Prompt couldn't be rendered in the current environment")
            } else {
                console.error(chalk.red("Error") + ": Unable to create menu.\nDetails:\n" + error)
            }
        });
    }
}
function scan_screen(timeout = 5) {
    current_screen = "Scan Menu"
    banner();
    ignore = []
    if(Array.isArray(tv_list)) {
        tv_list.forEach(element => {
            ignore.push(element.address);
        });
    }
    scan(timeout,ignore,interactive_scan_callback)
    console.log(chalk.green("Scanning..."))
}
function is_tv(alias) {
    if(!Array.isArray(tv_list)) return false
    for(var i = 0; i < tv_list.length; ++i) {
        if(tv_list[i].alias.includes(alias)) return true;
    }
    return false
}
function find_tv(alias) {
    if(!Array.isArray(tv_list)) return undefined
    for(var i = 0; i < tv_list.length; ++i) {
        if(tv_list[i].alias.includes(alias)) return tv_list[i];
    }
    return undefined
}
function app_list_callback(err,data){
    if(err) {
        tv_control(current_tv.alias, chalk.red(err.toString()))
    }
    const table = new Table({
        head: [chalk.cyan('App title'), chalk.cyan('App id'), chalk.cyan('System app')]
      , colWidths: [50, 50, 15]
    });
    
    // table is an Array, so you can `push`, `unshift`, `splice` and friends
    for(var i = 0; i < data.launchPoints.length; ++i) {
        table.push(
            [data.launchPoints[i].title, data.launchPoints[i].id, data.launchPoints[i].systemApp ? chalk.green("●") : chalk.red("●")]
        );
    }
    tv_control(current_tv.alias, "App list recievd:\n\n" + table.toString())
}
function mute(m = true) {
    selected_tv.request("ssap://audio/setMute", {"mute": m})
    tv_control(current_tv.alias, chalk.green("Commnand sent"))
}
function volume_control(volume) {
    selected_tv.request("ssap://audio/setVolume", {"volume": volume})
}
function turn_on(s) {
    if(s) {
        //Turn it on
        mac_address = get_mac_address(current_tv.address);
        if(mac_address == undefined){
            tv_control(current_tv.alias, chalk.red("Oh no! seems like fetching the mac address to turn the tv on has failed!"))
            return;
        }
        else 
            wol.wake(mac_address);
    }
    else {
        selected_tv.request("ssap://system/turnOff")
    }
    tv_control(current_tv.alias, chalk.green("Signal sent!"))
}
function volume_control_screen() {
    banner();
    inquirer.prompt([
        {
            type: 'input',
            name: 'volume',
            message: "Enter the volume you wish to set",
            validate: function(value) {
                var valid = !isNaN(parseFloat(value));
                return valid || 'Please enter a number';
              },
              filter: Number
        }
    ])
    .then(answers => {
        volume_control(answers.volume)
        tv_control(current_tv.alias, chalk.green("Command executed"))
    })
    .catch(error => {
        if(error.isTtyError) {
            console.error(chalk.red("Error") + ": Prompt couldn't be rendered in the current environment")
        } else {
            console.error(chalk.red("Error") + ": Unable to create menu.\nDetails:\n" + error)
        }
    });
}
function go_to_url_browser(url) {
    selected_tv.request("ssap://system.launcher/open", {"target": url})
}
function go_to_url_browser_screen() {
    banner();
    inquirer.prompt([
        {
            type: 'input',
            name: 'url',
            message: "Enter a url to open",
            validate: function(value) {
                var pass = value.match(/^(http[s]?:\/\/){0,1}(www\.){0,1}[a-zA-Z0-9\.\-]+\.[a-zA-Z]{2,5}[\.]{0,1}/);
                if (pass) {
                  return true;
                }
          
                return 'Please enter a URL';
              }
        }
    ])
    .then(answers => {
        go_to_url_browser(answers.url)
        tv_control(current_tv.alias, chalk.green("Url sent"))
    })
    .catch(error => {
        if(error.isTtyError) {
            console.error(chalk.red("Error") + ": Prompt couldn't be rendered in the current environment")
        } else {
            console.error(chalk.red("Error") + ": Unable to create menu.\nDetails:\n" + error)
        }
    });
}
function start_app(id) {
    selected_tv.request("ssap://system.launcher/launch", {'id': id})
    tv_control(current_tv.alias, chalk.green("Command sent to TV"))
}
function start_app_screen() {
    banner()
    inquirer.prompt([
        {
            type: 'input',
            name: 'url',
            message: "Enter app id",
        }
    ])
    .then(answers => {
        start_app(answers.url)
    })
    .catch(error => {
        if(error.isTtyError) {
            console.error(chalk.red("Error") + ": Prompt couldn't be rendered in the current environment")
        } else {
            console.error(chalk.red("Error") + ": Unable to create menu.\nDetails:\n" + error)
        }
    });
}
function stop() {
    selected_tv.request("ssap://media.controls/stop");
    tv_control(current_tv.alias, chalk.green("Commnand sent"))
}
function play(p) {
    if(p) selected_tv.request("ssap://media.controls/play");
    else selected_tv.request("ssap://media.controls/pause");
    tv_control(current_tv.alias, chalk.green("Commnand sent"))
}
function tv_control(alias, data = undefined) {
    if(current_tv == undefined || !current_tv.alias.includes(alias)) tv = find_tv(alias)
    else tv = current_tv
    if(tv == undefined) {
        interactive_menu(chalk.red("Failed on finding the tv: '" + alias + "'"))
        return;
    }
    current_screen = "TV Control: " + tv.alias
    selected_tv = selected_tv = lgtv({
        url: 'ws://' + tv.address +':3000'
    })
    current_tv = tv;
    banner()
    get_mac_address(tv.address)
    if(data) console.log(data)
    inquirer.prompt([
        {
        type: 'list',
        name: 'action',
        message: chalk.magenta("What would you like to do?"),
        choices: ["Play", "Pause","Stop", "Turn on", "Turn off","Mute", "Unmute", "Change volume", "Send a notification", "Open url", "Open Netflix", "Open Youtube", "Start app", "Get apps list", "Go back to main menu"],
        filter: function(val) {
                return val.toLowerCase();
            }
        }
    ])
    .then(answers => {
        if(answers.action.includes("send a notification")) send_notification_screen();
        else if (answers.action.includes("youtube")) start_app('youtube.leanback.v4')
        else if(answers.action.includes("get apps list")) get_app_list(app_list_callback)
        else if(answers.action.includes("turn on")) turn_on(true)
        else if(answers.action.includes("turn off")) turn_on(false)
        else if(answers.action.includes("mute")) mute(true)
        else if(answers.action.includes("unmute")) mute(false)
        else if(answers.action.includes("volume")) volume_control_screen()
        else if(answers.action.includes("open url")) go_to_url_browser_screen()
        else if(answers.action.includes("open netflix")) start_app('netflix')
        else if(answers.action.includes("start app")) start_app_screen()
        else if(answers.action.includes("play")) play(true)
        else if(answers.action.includes("pause")) play(false)
        else if(answers.action.includes("pause")) stop()
        else interactive_menu()
    })
    .catch(error => {
        if(error.isTtyError) {
            console.error(chalk.red("Error") + ": Prompt couldn't be rendered in the current environment")
        } else {
            console.error(chalk.red("Error") + ": unknown error has occured details below\n" + error)
        }
    });
}
function handle_main_menu_choice(choice){
    console.log("choice")
    if(choice == "scan") {
        scan_screen()
    } else if (choice == "authrize") {
        auth_screen();
    }
    else if (choice.includes("exit")) {
        process.stdout.write('\x1b[2J\n\x1b[0f')
        process.exit(0)
    }
    else if(is_tv(choice)) {
        tv_control(choice)
    }
    else {
        tv_list = config.get("tv_list")
        interactive_menu(chalk.red("Unable to process choice"))
    }
}
function interactive_menu(message = undefined) {
    current_screen = "Main Menu"
    banner()
    if(message) console.log(message)
    choices = ["Scan", "Authrize"];
    if(Array.isArray(tv_list)) { 
        choices.push(new inquirer.Separator())
        tv_list.forEach(element => {
        choices.push(element.alias);
    });
    choices.push(new inquirer.Separator())
    choices.push(chalk.red("Exit"))
    }
    if(!tv_list) console.log(chalk.red("No TVs were authrized."))
    inquirer
    .prompt([
        {
        type: 'list',
        name: 'action',
        message: chalk.magenta("Choose what to do") + tv_list ? ' or what TV to control' : '',
        choices: choices,
        filter: function(val) {
                return val.toLowerCase();
            }
        }
    ])
    .then(answers => {
        banner();
        handle_main_menu_choice(answers.action)
    })
    .catch(error => {
        if(error.isTtyError) {
            console.error(chalk.red("Error") + ": Prompt couldn't be rendered in the current environment")
        } else {
            console.error(chalk.red("Error") + ": Unable to create menu.\nDetails:\n" + error)
        }
    });

}

interactive_menu()