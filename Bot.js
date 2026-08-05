const mineflayer = require('mineflayer');
const { pathfinder, Movements } = require('mineflayer-pathfinder');
const { Build, builder } = require('mineflayer-schem');
const { Schematic } = require('prismarine-schematic');
const fs = require('fs').promises;
const path = require('path');

// Initialize the bot with Microsoft authentication for your specific email
const bot = mineflayer.createBot({
    host: 'play.6b6t.org',
    port: 25565,
    auth: 'microsoft',
    username: 'A7mad.2k3@outlook.com', // Ties the oauth flow to your account
    version: '1.20.4'                // Match server version
});

bot.loadPlugin(pathfinder);
bot.loadPlugin(builder);

bot.once('spawn', async () => {
    console.log('[+] Bot successfully authenticated and spawned into 6b6t.');
    
    // Set up pathfinder movements and allow breaking obstacles in the way
    const defaultMove = new Movements(bot);
    defaultMove.canDig = true; 
    bot.pathfinder.setMovements(defaultMove);

    try {
        // Resolve schematic file path
        const filePath = path.resolve(__dirname, './dupe_stash.litematic');
        console.log(`[+] Reading schematic file from: ${filePath}`);
        
        const schematicBuffer = await fs.readFile(filePath);
        const schematic = await Schematic.read(schematicBuffer, bot.version);

        // Calculate and print required block manifest to terminal
        printMaterialRequirements(schematic);
        
        // Wait until bot hits the ground safely
        while (!bot.entity.onGround) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Anchor the build origin to the bot's current standing coordinates
        const buildPosition = bot.entity.position.floored();
        console.log(`[+] Starting schematic build execution at coordinates: ${buildPosition}`);

        const build = new Build(schematic, bot.world, buildPosition);
        
        const options = {
            buildSpeed: 1.0,
            onError: 'pause',       // Pauses if a block placement fails
            retryCount: 3,          // Retries placement actions
            useNearestChest: true,  // Pulls inventory blocks automatically from nearby chests
            bots: [bot]
        };

        bot.emit('start_build', build, options);

        // Track progress events
        bot.on('builder_progress', (progress) => {
            const percent = Math.floor((progress.completed / progress.total) * 100);
            console.log(`[Progress] Built: ${percent}% (${progress.completed}/${progress.total} blocks)`);
        });

        bot.on('builder_finished', () => {
            console.log('[+] Schematic build sequence successfully completed!');
        });

    } catch (err) {
        console.error(`[-] Schematic execution error: ${err.message}`);
    }
});

// Helper function to extract and print required material counts
function printMaterialRequirements(schematic) {
    const materialCounts = {};
    
    for (const regionName of Object.keys(schematic.regions)) {
        const region = schematic.regions[regionName];
        region.forEach((block, position) => {
            if (block && block.name && block.name !== 'air') {
                materialCounts[block.name] = (materialCounts[block.name] || 0) + 1;
            }
        });
    }

    console.log('\n=========================================');
    console.log('       REQUIRED MATERIALS MANIFEST       ');
    console.log('=========================================');
    for (const [blockName, count] of Object.entries(materialCounts)) {
        console.log(`- ${blockName}: ${count}`);
    }
    console.log('========================================-\n');
}

// Chat listener for server verification codes or messages
bot.on('chat', (username, message) => {
    if (message.toLowerCase().includes('verify') || message.toLowerCase().includes('code')) {
        console.log(`\n[!] Verification prompt detected in chat: "${message}"\n`);
    }
});

bot.on('kicked', (reason) => {
    console.warn(`[-] Bot disconnected from server. Reason: ${reason}`);
});

bot.on('error', (err) => {
    console.error(`[-] Socket error: ${err.message}`);
});
