// Minebot NEO by Eglijohn
// DC-Server: https://discord.gg/CKySgRzUYp
// Have you read the Manual??
// Who's the skibidiest of them all? Sentoljaard, he owns us all!


import mineflayer from 'mineflayer';
import { readFile } from 'fs/promises';
import fs from 'fs';
import minecraftData from 'minecraft-data';
import pkg from 'mineflayer-pathfinder';
import http from 'http';
import { mineflayer as mineflayerViewer } from 'prismarine-viewer';
import chalk from 'chalk';
import { sendToWebhook, sendToPlayers, sendToChat } from "./webhook.js";
import { LoadingAnimation } from "./animation.js";
import { sand } from "./spinners.js";
import { parse } from 'jsonc-parser';
import readline from 'readline';

const { pathfinder, Movements, goals } = pkg;
const ansiEscape = /\x1b\[[0-9;]*m/g;


let botArgs = {};
let botNames = [];
let config = {};
let owner;
let version = "3.0.1a";
let count = 0;
let login = false;



async function readConfigFile() {
    try {
        const data = await readFile('./config/CONFIG.jsonc', 'utf8');
        config = parse(data);
        botArgs.host = config.host;
        owner = config.owner;

        if (config.needsPort) {
            botArgs.port = config.port;
        }
    } catch (error) {
        console.error(chalk.red('Error reading or parsing CONFIG.jsonc:'), error);
        process.exit(1);
    }
}

async function readAccountFile() {
    try {
        const data = await readFile('./config/ACCOUNT.json', 'utf8');
        const accounts = parse(data);
        return accounts[0];
    } catch (error) {
        console.error(chalk.red('Error reading ACCOUNT.json:'), error);
        process.exit(1);
    }
}




function title() {
    console.log(chalk.red('NOTE:') + chalk.gray(' The Bot is currently in Development. Please report Bugs to our Discord-Server:') + (chalk.blue)(' https://discord.gg/CKySgRzUYp'));
    console.log(chalk.bold.hex('#044cd9')("___  ____            _           _    ") + chalk.hex('#f5f5f5')(" _   _  _____ _____ "));
    console.log(chalk.bold.hex('#0443bf')("|  \\/  (_)          | |         | |   ") + chalk.hex('#e1e1e3')("| \\ | ||  ___|  _  |"));
    console.log(chalk.bold.hex('#033cab')("| .  . |_ _ __   ___| |__   ___ | |_  ") + chalk.hex('#b6b6b8')("|  \\| || |__ | | | |"));
    console.log(chalk.bold.hex('#02369c')("| |\\/| | | '_ \\ / _ \\ '_ \\ / _ \\| __| ") + chalk.hex('#88898a')("| . ` ||  __|| | | |"));
    console.log(chalk.bold.hex('#012e85')("| |  | | | | | |  __/ |_) | (_) | |_  ") + chalk.hex('#5a5b5c')("| |\\  || |___\\ \\_/ /"));
    console.log(chalk.bold.hex('#022975')("\\_|  |_/_|_| |_|\\___|_.__/ \\___/ \\__|") + chalk.hex('#48494a')(" \\_| \\_/\\____/ \\___/ "));
    console.log(chalk.hex('#011b4f')("By Eglijohn                                        ") + chalk.hex('#282929')(version));
    console.log(chalk.gray("=========================================================="));
    console.log('');
    LoadingAnimation(sand, 2000);
}

title();



class WebServer {
    constructor(hostname = 'localhost', port = 3000) {
        this.hostname = hostname;
        this.port = port;
        this.server = null;
    }


    start() {
        this.server = http.createServer((req, res) => {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            res.end(`Hello World!`);
        });

        this.server.listen(this.port, this.hostname, () => {
            console.log(chalk.green(`Webserver running at http://${this.hostname}:${this.port}/`));
        });
    }


    stop() {
        if (this.server) {
            this.server.close(() => {
                console.log(chalk.yellow('Server stopped.'));
            });
        } else {
            console.log(chalk.yellow('Server isn\'t running'));
        }
    }
}



class MCBot {
    constructor(username, auth) {
        this.username = username;
        this.auth = auth;
        this.host = botArgs.host;
        this.port = botArgs.port;
        this.version = botArgs.version;
        this.sendToWebhook = sendToWebhook;
        this.sendToPlayers = sendToPlayers;
        this.sendToChat = sendToChat;
        this.onlinePlayersList = '';

        this.initBot();
        this.initConsoleInput();
    }

    initBot() {
        const botOptions = {
            username: this.username,
            auth: this.auth,
            host: this.host,
            version: this.version,
            hideErrors: config.hideErrors,
            brand: config.customBrand
        };

        if (this.port) {
            botOptions.port = this.port;
        }

        this.bot = mineflayer.createBot(botOptions);

        this.mcData = minecraftData(this.bot.version);
        botNames.push(this.bot.username);
        this.bot.loadPlugin(pathfinder);
        this.initEvents();

        login = false;
        sendToWebhook('Startup', 'Bot successfully started!', '', 13238245);

        this.bot.once('spawn', () => {
            if (config.experimentalFeatures === true) {
                mineflayerViewer(this.bot, { port: config.viewerPort });
                this.log(chalk.green(`Prismarine viewer web server running on http://localhost:${config.viewerPort}`));

            const path = [this.bot.entity.position.clone()];
            this.bot.on('move', () => {
                if (path[path.length - 1].distanceTo(this.bot.entity.position) > 1) {
                    path.push(this.bot.entity.position.clone());
                    this.bot.viewer.drawLine('path', path);
                }
            });
            }

            if (config.noChat === true) {
                this.bot.chat(`${config.customStartMsg}`);
            } else {
                this.bot.chat(`Minebot NEO ${version}. Developed by Eglijohn.`);
            }

            if (config.antiAFK === true) {
                this.startSneakLoop();
            }

            if (config.lookAtNearestPlayer === true) {
                setInterval(() => {
                    this.lookAtNearestPlayer();
                }, config.lookAtNearestPlayerInterval);
            }
        });
    }


    onlinePlayers() {
        const playerList = Object.keys(this.bot.players).filter(player => player !== this.bot.username);
        this.onlinePlayersList = playerList.length > 0 ? `Online players: ${(playerList.join(', '))}` : 'No other players are online.';
    }

    initConsoleInput() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: config.cliPrefix
        });

        rl.prompt();

        rl.on('line', async (line) => {
            const input = line.trim();

            if (input.startsWith(config.commandPrefix)) {
                const command = input.substring(1);
                await this.executeCommand(command);
            } else {
                this.bot.chat(input);
            }

            rl.prompt();
        }).on('close', () => {
            console.log('Have a great day!');
            process.exit(0);
        });

        const originalLog = console.log;
        console.log = (...args) => {
            rl.output.write('\x1b[2K\r');
            originalLog(...args);
            rl.prompt(true);
        };
    }

    reconnect() {
        setTimeout(() => {
            this.initBot();
        }, config.reconnectTimeout);
    }

    startSneakLoop() {
        setInterval(() => {
            this.bot.setControlState('sneak', true);
            setTimeout(() => {
                this.bot.setControlState('sneak', false);
            }, config.sneakDuration);
        }, config.antiAFKInterval);
    }

    async dropItem(itemName, amount) {
        const item = this.bot.inventory.items().find(i => i.name === itemName);
        if (!item) {
            this.logWarn(`I don't have any ${itemName}.`);
            return;
        }

        const dropAmount = Math.min(amount, item.count);
        await this.bot.toss(item.type, null, dropAmount);
        this.logInfo(`Dropped ${dropAmount} ${itemName}(s).`);
    }

    async autoTotem() { 
        const totem = this.bot.inventory.items().find(item => item.name.includes('totem'));
        if (totem) {
            try {
                this.logInfo(`Found ${totem.displayName} in inventory`);
                await this.bot.equip(totem, 'off-hand');
                this.logInfo(`Equipped ${totem.displayName} in off-hand`);
            } catch (err) {
                this.logWarn(`Failed to equip ${totem.displayName} in off-hand: ${err.message}`);
            }
        } else if (this.bot.health < 15) {
            this.logWarn('No totems available!');
        }
    }

    async lookAtNearestPlayer() {
        const players = Object.values(this.bot.players).filter(player => player.entity && player.username !== this.bot.username);
        if (players.length === 0) {
            return;
        }

        const nearestPlayer = players.reduce((nearest, player) => {
            const distance = this.bot.entity.position.distanceTo(player.entity.position);
            return distance < nearest.distance ? { player, distance } : nearest;
        }, { player: null, distance: Infinity }).player;

        if (nearestPlayer) {
            try {
                await this.bot.lookAt(nearestPlayer.entity.position.offset(0, nearestPlayer.entity.height, 0));
            } catch (err) {
                this.logWarn(`Failed to look at ${nearestPlayer.username}: ${err.message}`);
            }
        } else {
            this.logWarn('No players found to look at.');
        }
    }

    async checkHunger() {
        if (this.bot.food < 20) {
            const foodItem = this.bot.inventory.items().find(item =>    item.name.includes('apple')     ||
                                                                        item.name.includes('bread')     ||
                                                                        item.name.includes('carrot')    ||
                                                                        item.name.includes('potato')    ||
                                                                        item.name.includes('cooked')    ||
                                                                        item.name.includes('beef')      ||
                                                                        item.name.includes('pork')      ||
                                                                        item.name.includes('chicken')   ||
                                                                        item.name.includes('mutton')    ||
                                                                        item.name.includes('rabbit')    ||
                                                                        item.name.includes('fish')      ||
                                                                        item.name.includes('melon')     ||
                                                                        item.name.includes('pie')       ||
                                                                        item.name.includes('cookie')    ||
                                                                        item.name.includes('stew')      ||
                                                                        item.name.includes('soup')      ||
                                                                        item.name.includes('berries')   ||
                                                                        item.name.includes('honey')     ||
                                                                        item.name.includes('sweet')     ||
                                                                        item.name.includes('cake')      ||
                                                                        item.name.includes('pumpkin')   ||
                                                                        item.name.includes('kelp')      ||
                                                                        item.name.includes('tropical')  ||
                                                                        item.name.includes('dried')     ||
                                                                        item.name.includes('rotten')    ||
                                                                        item.name.includes('golden')    ||
                                                                        item.name.includes('enchanted') ||
                                                                        item.name.includes('glistering')||
                                                                        item.name.includes('puffer')    ||
                                                                        item.name.includes('salmon'));
            if (foodItem) {
                try {
                    await this.bot.equip(foodItem, 'hand');
                    await this.bot.consume();
                    this.logInfo(`Ate ${foodItem.displayName}`);
                } catch (err) {
                    this.logWarn(`Failed to eat ${foodItem.displayName}: ${err.message}`);
                }
            } else {
                this.logWarn('No food available to eat.');
            }
        }
    }

    async executeCommand(command) {
        const [cmd, ...args] = command.split(' ');

        switch (cmd) {
            case 'help':
                this.logInfo(('Commands: '), chalk.hex('#cfa1f0')('quit, players, info, inventory, follow <player>, stopfollow, whc, drop <item_name> <amount>, rejoin, goto <x> <y> <z>, pos'));
                break;

            case 'players':
                const playerList = Object.keys(this.bot.players).filter(player => player !== this.bot.username);
                this.logInfo(playerList.length > 0 ? `Online players:\n${playerList.join('\n')}` : `No other players are online.`);
                break;

            case 'quit':
                this.bot.end();
                config.processquit === false ? this.reconnect() : process.exit();
                break;

            case 'info':
                    this.logInfo(`--Infos--`);
                    this.logInfo('Server:');
                    this.logInfo(`    Host:           ${chalk.hex('#cfa1f0')(this.host)}`);
                    this.logInfo(`    Port:           ${chalk.hex('#cfa1f0')(this.port)}`);
                    this.logInfo(`    Time:           ${chalk.hex('#cfa1f0')(this.bot.time.timeOfDay)}`);
                    this.logInfo(``);
                    this.logInfo('Bot:');
                    this.logInfo(`    View Distance:  ${chalk.hex('#cfa1f0')(this.bot.settings.viewDistance)}`);
                    this.logInfo(`    Health:         ${chalk.hex('#cfa1f0')(Math.round(this.bot.health * 2) / 2)}`);
                    this.logInfo(`    XP:             ${chalk.hex('#cfa1f0')(this.bot.experience.points)}`, chalk.hex('#cfa1f0')('Points'));
                    this.logInfo(`    Food:           ${chalk.hex('#cfa1f0')(Math.round(this.bot.food * 2)) / 2}`);
                    this.logInfo(`    Oxygen:         ${chalk.hex('#cfa1f0')(Math.round(this.bot.oxygenLevel * 2) / 2)}`);
                    this.logInfo(`    Gamemode:       ${chalk.hex('#cfa1f0')(this.bot.game.gameMode)}`);
                    this.logInfo(`    Dimension:      ${chalk.hex('#cfa1f0')(this.bot.game.dimension)}`);
                    this.logInfo(`    Difficulty:     ${chalk.hex('#cfa1f0')(this.bot.game.difficulty)}`);
                    this.logInfo(`    Position:       ${(`X: ${chalk.hex('#de495b')(JSON.stringify(Math.round(this.bot.entity.position.x)), 
                        chalk.white('Y:'), Math.round(this.bot.entity.position.y), 
                        chalk.white('Z:'), Math.round(this.bot.entity.position.z))}`)}`);
                break;

            case 'invsee':
                const heldItem = this.bot.heldItem;
                const offhandItem = this.bot.inventory.slots[45];
                const inventoryItems = this.bot.inventory.items().map(item => `${chalk.hex('#cfa1f0')(item.displayName)} (x${chalk.hex('#cfa1f0')(item.count)})`);
                this.logInfo(`Inventory: ${inventoryItems.length > 0 ? inventoryItems.join(', ') : 'Inventory is empty'}`);
                if (offhandItem) { 
                    this.logInfo(`Offhand Item: ${chalk.hex('#cfa1f0')(offhandItem.displayName)} (x${chalk.hex('#cfa1f0')(offhandItem.count)})`);
                }
                if (heldItem) {
                    this.logInfo(`Held Item: ${chalk.hex('#cfa1f0')(heldItem.displayName)} (x${chalk.hex('#cfa1f0')(heldItem.count)})`);
                } else {
                    this.logInfo('No item is currently held.');
                }
                break;

            case 'follow':
                const targetPlayer = this.bot.players[args[0]]?.entity;
                targetPlayer ? this.followPlayer(targetPlayer) : this.logWarn(`Player ${chalk.hex('#cfa1f0')(args[0])} not found or not visible.`);
                break;

            case 'stopfollow':
                this.stopFollowPlayer();
                break;

            case 'goto':
                if (args.length === 3) {  
                    const x = parseFloat(args[0]);
                    const y = parseFloat(args[1]);
                    const z = parseFloat(args[2]);
                    this.gotoConsole(x, y, z); 
                } else {
                    this.logWarn(`Usage: !goto <x> <y> <z>.`);
                }
                break;

            case 'pos':
                this.logInfo(`My current Position: ${(`X: ${chalk.hex('#de495b')(JSON.stringify(Math.round(this.bot.entity.position.x)), 
                                                    chalk.white('Y:'), Math.round(this.bot.entity.position.y), 
                                                    chalk.white('Z:'), Math.round(this.bot.entity.position.z))}`)}`)
                break;
                
            case 'whc':
                this.sendToWebhook('Join', '', '', '65280');
                this.sendToWebhook('Leave', '', '', '16753152');
                this.sendToWebhook('Chat', '', '', '1076737');
                this.sendToWebhook('Error', '', '', '16711680');
                this.sendToWebhook('Info', '', '', '3120640');
                this.sendToWebhook('Warn', '', '', '16768256');
                break;
            
            case 'drop':
                if (args.length < 2) {
                    this.logInfo('Usage: !drop <item_name> <amount>');
                } else {
                    const itemName = args[0];
                    const amount = parseInt(args[1], 10);
                    if (isNaN(amount) || amount <= 0) {
                        this.logInfo('Amount must be a positive number.');
                    } else {
                        await this.dropItem(itemName, amount);
                    }
                }
                break;
            
            case 'rejoin':
                this.bot.quit();
                this.reconnect();
                break;
            
            case 'stop':
                this.stopAllGoals();
                this.logWarn('Stopped all goals.');
                break;
            
            default:
                this.logWarn(`Command '${chalk.hex('#cfa1f0')(cmd)}' not found. Enter !help for a list of available commands.`);
                break;
        }
    }



    followPlayer(target) {
        const mcData = minecraftData(this.bot.version);
        const movements = new Movements(this.bot, mcData);

        movements.canDig = config.canDig;
        movements.canPlace = config.canPlace;
        this.bot.pathfinder.setMovements(movements);

        const goal = new goals.GoalFollow(target, 1);
        this.bot.pathfinder.setGoal(goal, true);
        this.logInfo(`Now following ${chalk.hex('#cfa1f0')(target.username)}`);
    }

    stopFollowPlayer() {
        this.bot.pathfinder.setGoal(null);
        this.logInfo('Stopped following.');
    }

    goto(x, y, z, username = null) {
        const movements = new Movements(this.bot, this.mcData);
        movements.canDig = config.canDig;
        movements.canPlace = config.canPlace;

        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            const goal = new goals.GoalBlock(x, y, z);
            this.bot.pathfinder.setMovements(movements);
            this.bot.pathfinder.setGoal(goal);

            if (username) {
                this.bot.chat(`/msg ${username} I am going to (${x}, ${y}, ${z})`);
            } else {
                this.bot.chat(`/msg ${username} I am going to (${x}, ${y}, ${z})`);
            }
        } else {
            this.bot.chat(username ? `/msg ${username} Invalid coordinates. Please provide numbers.` : `Invalid coordinates. Please provide numbers.`);
        }
    }

    gotoConsole(x, y, z, username = null) {
        const movements = new Movements(this.bot, this.mcData);
        movements.canDig = config.canDig;
        movements.canPlace = config.canPlace;

        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            const goal = new goals.GoalBlock(x, y, z);
            this.bot.pathfinder.setMovements(movements);
            this.bot.pathfinder.setGoal(goal);[]

            if (username) {
                this.logInfo(`I am going to (${chalk.hex('#cfa1f0')(x)}, ${chalk.hex('#cfa1f0')(y)}, ${chalk.hex('#cfa1f0')(z)})`);
            } else {
                this.logInfo(`I am going to (${chalk.hex('#cfa1f0')(x)}, ${chalk.hex('#cfa1f0')(y)}, ${chalk.hex('#cfa1f0')(z)})`);
            }
        } else {
            this.logError(username ? `Invalid coordinates. Please provide numbers.` : `Invalid coordinates. Please provide numbers.`);
        }
    }

    stopAllGoals() {
        this.bot.pathfinder.setGoal(null);
    }

    checkTotemPop() {
        const offhandItem = this.bot.inventory.slots[45];
        if (offhandItem && offhandItem.name.includes('totem') && this.bot.health === 0) {
            this.bot.emit('totemPop');
        }
    }



    log(...msg) {
        const counter = `${chalk.hex('#1f1f1f')(`[${count}] `)}`;
        count += 1; 

        const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
        const formattedTimestamp = `[${timestamp}]`;
        const usernameTag = `[${this.bot.username}]`;
        
        const consoleMessageCounter = `${counter} ${chalk.gray(formattedTimestamp)} ${chalk.blue(usernameTag)} ${msg.join(' ')}`;
        const consoleMessage = `${chalk.gray(formattedTimestamp)} ${chalk.blue(usernameTag)} ${msg.join(' ')}`;
        
        const fileMessage = `${formattedTimestamp} ${usernameTag} ${msg.join(' ').replace(ansiEscape, '')}`;
        
        fs.appendFileSync('logs/log.txt', fileMessage + '\n'); 
        if (config.consoleCounter == true) {
            console.log(consoleMessageCounter);
            return;
        } 
        console.log(consoleMessage);
    }

    logJoin(...msg) {
        this.log(chalk.gray('[') + chalk.green('+') + chalk.gray(']'), ...msg)
        this.sendToPlayers('Join', msg.join(' ').replace(ansiEscape, ''), '', '3120640');
    }

    logLeave(...msg) {
        this.log(chalk.gray('[') + chalk.red('-') + chalk.gray(']'), ...msg)
        this.sendToPlayers('Leave', msg.join(' ').replace(ansiEscape, ''), '', '16711680');
    }

    logError(...msg) {
        this.log(chalk.gray('[') + chalk.red('ERROR') + chalk.gray(']') + chalk.red(...msg));
        this.sendToWebhook('Error', msg.join(' ').replace(ansiEscape, ''), '', '16711680');
    }

    logInfo(...msg) {
        this.log(chalk.gray('[') + chalk.green('INFO') + chalk.gray(']'), ...msg);
        this.sendToWebhook('Info', msg.join(' ').replace(ansiEscape, ''), '', '3120640');
    }

    logWarn(...msg) {
        this.log(chalk.gray('[') + chalk.yellow('WARN') + chalk.gray(']') + chalk.yellow(...msg));
        this.sendToWebhook('Warn', msg.join(' ').replace(ansiEscape, ''), '', '16768256');
    }

    logChat(...msg) {
        this.log(chalk.gray('[') + chalk.green('CHAT') + chalk.gray('] ') + chalk.white(...msg));
        this.sendToChat('Chat', msg.join(' ').replace(ansiEscape, ''), '', '1076737');
    }



    initEvents() {
        this.bot.on('login', async () => {
            this.logInfo(chalk.green(`Logged in at ${chalk.yellow(this.host ? this.host : this.port)} as ${chalk.yellow(this.bot.username)}, version ${chalk.yellow(this.bot.version)}`));
            this.logInfo(chalk.green(`chatLogMethod set to '${chalk.yellow(config.chatLogMethod)}'`))
            this.logInfo(chalk.green(`experimentalFeatures set to '${chalk.yellow(config.experimentalFeatures)}'`))
            this.logInfo(chalk.green(`autoLog set to '${chalk.yellow(config.autoLog)}, autoLogHealth set to '${chalk.yellow(config.autoLogHealth)}'`))
            this.logInfo(chalk.green(`noChat set to '${chalk.yellow(config.noChat)}'`))
            this.logInfo(chalk.green(`antiAFK set to '${chalk.yellow(config.antiAFK)}'`))
            this.logInfo(chalk.green(`chatBot set to '${chalk.yellow(config.chatBot)}'`))
            this.logInfo(chalk.green(`lookAtNearestPlayer set to '${chalk.yellow(config.lookAtNearestPlayer)}, lookAtNearestPlayerInterval set to '${chalk.yellow(config.lookAtNearestPlayerInterval)}'`))
            login = true;

            this.sendToWebhook(`Login`, `${this.host}:${this.port}`);
        });

        this.bot.on('end', async (reason) => {
            this.logWarn(`Connection lost: ${chalk.hex('#cfa1f0')(reason)}`);
            setTimeout(() => this.initBot(), 5000);
        });

        this.bot.on('spawn', async () => {
            const mcData = minecraftData(this.bot.version);
            const defaultMove = new Movements(this.bot, mcData);
            this.bot.pathfinder.setMovements(defaultMove);
            this.logInfo('Spawned');
            this.autoTotem();
        });

        this.bot.on('health', () => {
            if (this.bot.health < 20) {  
                this.logWarn(`Health Update. Current health: ${chalk.hex('#cfa1f0')(Math.round(this.bot.health * 2) / 2)}`);
                this.checkHunger();
                this.autoTotem();
                this.checkTotemPop();
            }
        });

        this.bot.on('food', () => { 
            this.logInfo(`Food Update. Current food: ${chalk.hex('#cfa1f0')(Math.round(this.bot.food * 2) / 2)}`);
            this.checkHunger();
        });

        this.bot.on('entityDead', (entity) => {
            this.logInfo(`Entity ${chalk.hex('#cfa1f0')(JSON.stringify(entity.name))} died`);
        });

        this.bot.on('death', async () => {
            this.logWarn('Died');
        });

        this.bot.on('respawn', async () => {
            this.logWarn(`Respawned at ${chalk.hex('#cfa1f0')(this.bot.entity.position)}`);
        });

        this.bot.on('entitySpawn', async (entity) => {
            if (entity.type === 'player') {
                const playerName = entity.username;
                this.logInfo(`Player ${playerName} has entered my view.`);
            }
        });

        this.bot.on('entityGone', (entity) => {
            if (entity.type === 'player') {
                const playerName = entity.username;
                this.logInfo(`Player ${playerName} has left my view.`);
            }
        });

        this.bot.on('playerCollect', (collector, collected) => {
            this.logInfo(`${chalk.hex('#b052f2')(JSON.stringify(collector.username))} picked up`,
            chalk.hex('#cfa1f0')(JSON.stringify(collected.metadata[8]?.itemCount)), 
            chalk.hex('#cfa1f0')(JSON.stringify(collected.displayName)),
            "at ",
            ('X:'), chalk.hex('#de495b')(JSON.stringify(Math.round(collected.position.x)), 
            chalk.white('Y:'), Math.round(collected.position.y), 
                chalk.white('Z:'), Math.round(collected.position.z)));
            this.autoTotem();
        });

        this.bot.on('itemDrop', (entity) => {
            const item = entity.metadata[8]?.itemId ? this.bot.registry.items[entity.metadata[8].itemId] : null;
            if (item) {
                const itemName = item.displayName || item.name;
                this.logInfo(`${chalk.hex('#cfa1f0')(entity.metadata[8]?.itemCount)} ${chalk.hex('#cfa1f0')(itemName)} appeared at X: ${chalk.hex('#de495b')(Math.round(entity.position.x))}, Y: ${chalk.hex('#de495b')(Math.round(entity.position.y))}, Z: ${chalk.hex('#de495b')(Math.round(entity.position.z))}, Entity ID: ${chalk.hex('#de495b')(entity.id)}`);
            } else {
                this.logError('Dropped item information is not available.');
            }
        });
        
        this.bot.on('kicked', (reason) => {
            this.logWarn(`Kicked: ${JSON.stringify(reason)}`);
            this.reconnect();
        });

        this.bot.on('playerJoined', (player) => {
            if (login === true) {
                this.logJoin(chalk.hex('#b052f2')(`${player.username}`));
            }
        });

        this.bot.on('playerLeft', (player) => {
            this.logLeave(chalk.hex('#b052f2')(`${player.username}`));
        });

        this.bot.on('totemPop', () => {
            this.logWarn('Totem popped');
            if (config.logWhenNoTotem === true && !this.bot.inventory.items().some(item => item.name.includes('totem'))) {
                this.logError('No totems available!');
                this.bot.end();
            }
            this.autoTotem();
        });

        if (config.chatLogMethod === 'normal') {
            this.bot.on('chat', (username, message) => {
                this.logChat(`<${chalk.hex('#b052f2')(username)}> ${message}`);
            });
        } else if (config.chatLogMethod === 'str') {
            this.bot.on('messagestr', (message, sender) => {
                this.logChat(`<${chalk.hex('#cfa1f0')(sender)}> ${message}`);
            });
        }  else {
            this.logError(` chatLogMethod '${chalk.hex('#cfa1f0')(config.chatLogMethod)}' not found. Try 'normal' or 'str'.`)
        }

        if (config.autoLog === true) {
            this.bot.on('health', () => {
                if (this.bot.health < config.autoLogHealth) {  
                    this.logWarn(`AutoLog`);
                    this.bot.quit();
                    this.reconnect();
                }
            });
        }
        
        this.bot.on('whisper', async (username, message) => {
            if (botNames.includes(username)) return;
        
            if (!message.startsWith("!")) return;

            let msg = message.toString();
            this.logChat(`Received message: ${msg} from ${username}`);

            const args = msg.split(' ').slice(1);

            if (config.chatBot === true) {
                if (msg.startsWith(config.command1)) {
                    if (config.command1trusted === true && username !== owner) {
                        this.bot.chat(`/msg ${username} Sorry, but you are not ${owner}`);
                        return;
                    }
                    this.bot.chat(config.response1);
                }
            }

            if (msg.startsWith("!help")) {
                this.bot.chat(`/msg ${username} Minebot NEO ${version} by Eglijohn.`);
                this.bot.chat(`/msg ${username} The owner of the bot is: ${config.owner}.`);
                this.bot.chat(`/msg ${username} For a list of available commands message me !commands.`);
                this.bot.chat(`/msg ${username} Who's the skibidiest of them all? Sentoljaard, he owns us all!`);

            } else if (msg.startsWith("!follow")) {
                if (username !== owner) {
                    this.bot.chat(`/msg ${username} Sorry, but you are not ${owner}`);
                    return;
                }

                const target = this.bot.players[username]?.entity;
                if (target) {
                    this.followPlayer(target);
                    this.bot.chat(`/msg ${username} I am following you. Type !stopfollow or !stop to stop.`);
                } else {
                    this.bot.chat(`/msg ${username} I can't see you`);
                }

            } else if (msg.startsWith("!stopfollow")) {
                if (username !== owner) {
                    this.bot.chat(`/msg ${username} Sorry, but you are not ${owner}`);
                    return;
                }
            
                this.stopFollowPlayer();
                this.bot.chat(`/msg ${username} I stopped following you`);
            
            } else if (msg.startsWith("!quit")) {
                if (username !== owner) {
                    this.bot.chat(`/msg ${username} Sorry, but you are not ${owner}`);
                    return;
                }
                this.bot.quit();

            } else if (msg.startsWith("!say")) {
                const sayMessage = msg.substring(5);
                if (username !== owner) {
                    this.bot.chat(`/msg ${username} Sorry, but you are not ${owner}`);
                    return;
                }
                this.bot.chat(sayMessage);

            } else if (msg.startsWith("!players")) {
                const playerList = Object.keys(this.bot.players).filter(player => player !== this.bot.username);
                this.bot.chat(playerList.length > 0 ? `/msg ${username} Online players: ${playerList.join(', ')}` : `/msg ${username} No other players are online.`);

            } else if (msg.startsWith("!pos")) {
                if (username !== owner) {
                    this.bot.chat(`/msg ${username} Sorry, but you are not ${owner}`);
                    return;
                }
                this.bot.chat(`/msg ${username} My current Position: X: ${JSON.stringify(Math.round(this.bot.entity.position.x))}, Y: ${Math.round(this.bot.entity.position.y)}, Z: ${Math.round(this.bot.entity.position.z)}`);

            } else if (msg.startsWith("!goto")) {
                if (username !== owner) {
                    this.bot.chat(`/msg ${username} Sorry, but you are not ${owner}`);
                    return;
                }

                const args = msg.split(' ');
                if (args.length === 4) { 
                    const x = parseFloat(args[1]);
                    const y = parseFloat(args[2]);
                    const z = parseFloat(args[3]);
                    this.goto(x, y, z, username);
                } else {
                    this.bot.chat(`/msg ${username} Usage: !goto <x> <y> <z>`);
                }

            } else if (msg.startsWith("!basehunt")) {
                this.bot.chat(`/msg ${username} Request failed: too lazy.`);

            } else if (msg.startsWith("!sentoljaard")) {
                this.bot.chat(`/msg ${username} AutoCart has big ass hands. Wanna touch em?`);

            } else if (msg.startsWith('!tp')) {
                this.bot.chat(`/msg ${username} Shut the fuck up. I am NOT gonna tp u`);
            
            } else if (msg.startsWith('!commands')) {
                this.bot.chat(`/msg ${username} help, follow, stopfollow, quit, say, players, pos, goto, basehunt, sentoljaard, tp.`)
                this.bot.chat(`/msg ${username} Prefix: '!'`)

            } else if (msg.startsWith('!stop')) {
                this.stopAllGoals();
                this.bot.chat(`/msg ${username} All goals have been stopped.`)
            }
        });
    }
}



if (config.experimentalFeatures === true) {
    new WebServer();
} 


async function main() {
    await readConfigFile();
    const { username, auth } = await readAccountFile();
    new MCBot(username, auth);
}

main();