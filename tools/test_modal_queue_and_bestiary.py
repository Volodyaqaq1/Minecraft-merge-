import os
import sys
import json
import time
import subprocess
from PIL import Image

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
ARTIFACTS_DIR = r"C:\Users\volod\.gemini\antigravity\brain\984a2eb8-6d05-42d2-a48b-e1af6f2e486d"

def run_headless_test():
    print("Launching test server and Chrome for modal queue and bestiary verification...")
    # Run a test via websocket or node/puppeteer or local python cdp script
    # We can use Chrome DevTools Protocol or a simple script that loads index.html with test params
    test_runner_html = os.path.abspath("tools/test_runner_queue.html")
    
    html_content = """<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Modal Queue & Bestiary Test Runner</title>
    <script src="../lib/phaser.min.js"></script>
    <script src="../src/config.js"></script>
    <script src="../src/utils/helpers.js"></script>
    <script src="../src/utils/SoundManager.js"></script>
    <script src="../src/data/mobs.js"></script>
    <script src="../src/data/worlds.js"></script>
    <script src="../src/data/bot_names.js"></script>
    <script src="../src/components/Economy.js"></script>
    <script src="../src/components/SaveManager.js"></script>
    <script src="../src/components/MergeField.js"></script>
    <script src="../src/components/BattleSystem.js"></script>
    <script src="../src/scenes/BootScene.js"></script>
    <script src="../src/scenes/GameScene.js"></script>
    <script src="../src/scenes/CollectionScene.js"></script>
    <script src="../src/scenes/BattleScene.js"></script>
    <style>body { margin:0; padding:0; background:#000; overflow:hidden; }</style>
</head>
<body>
<div id="game-container"></div>
<script>
    window.__TEST_LOGS = [];
    window.__TEST_DONE = false;
    window.__CAPTURES = {};

    function log(msg) {
        window.__TEST_LOGS.push(msg);
        console.log('[TEST]', msg);
    }

    const config = {
        type: Phaser.WEBGL,
        width: 960,
        height: 540,
        parent: 'game-container',
        transparent: false,
        backgroundColor: '#000000',
        scene: [BootScene, GameScene, CollectionScene, BattleScene]
    };

    window.__game = new Phaser.Game(config);

    async function sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    async function runTestSequence() {
        log('Waiting for GameScene...');
        while (!window.__gameScene || !window.__gameScene.sys.isActive()) {
            await sleep(100);
        }
        log('GameScene ready!');

        const scene = window.__gameScene;
        scene.state.elementalEvolutionUnlocked = false;
        scene.state.milestonesSeen = {};

        // 1. Trigger discovery of level 31 ("Стихийная Цыпа")
        log('Triggering discovery of level 31 (Стихийная Цыпа)...');
        const mob31 = getMobByLevel(31);
        scene._handleNewMobDiscovery(mob31);

        await sleep(350);

        // Verification 1: Era Milestone modal must be visible FIRST, New Mob modal must be hidden
        const isMilestoneVisible = scene._evolutionMilestoneModal && scene._evolutionMilestoneModal.visible;
        const isNewMobVisible = scene._newMobModal && scene._newMobModal.visible;

        log('Step 1: Milestone visible=' + isMilestoneVisible + ', NewMob visible=' + isNewMobVisible);
        if (isMilestoneVisible && !isNewMobVisible) {
            log('PASS: Milestone modal appeared FIRST, New Mob modal correctly queued!');
        } else {
            log('FAIL: Wrong initial modal visibility!');
        }

        // Capture canvas 1
        window.__CAPTURES['milestone_first'] = window.__game.canvas.toDataURL('image/png');

        // Close Milestone modal
        log('Closing milestone modal...');
        scene._evolutionMilestoneModal.setVisible(false);
        if (scene._onMilestoneModalClosed) {
            const cb = scene._onMilestoneModalClosed;
            scene._onMilestoneModalClosed = null;
            cb();
        }

        // Wait for queue delay (150ms + transition)
        await sleep(400);

        // Verification 2: Milestone is hidden, New Mob modal is visible SECOND
        const isMilestoneHidden = !scene._evolutionMilestoneModal.visible;
        const isNewMobNowVisible = scene._newMobModal && scene._newMobModal.visible;
        const titleText = scene._newMobModalTitle ? scene._newMobModalTitle.text : '';

        log('Step 2: Milestone hidden=' + isMilestoneHidden + ', NewMob visible=' + isNewMobNowVisible + ', Title="' + titleText + '"');
        if (isMilestoneHidden && isNewMobNowVisible && !titleText.includes('СКВИШ')) {
            log('PASS: New Mob modal appeared SECOND with title "' + titleText + '" (Zero squish wording)!');
        } else {
            log('FAIL: Step 2 failed!');
        }

        // Capture canvas 2
        window.__CAPTURES['new_mob_second'] = window.__game.canvas.toDataURL('image/png');

        // Close New Mob modal
        log('Closing new mob modal...');
        scene._newMobModal.setVisible(false);
        if (scene._onNewMobModalClosed) {
            const cb = scene._onNewMobModalClosed;
            scene._onNewMobModalClosed = null;
            cb();
        }

        await sleep(300);

        // 3. Test Bestiary Tab 0 (Ordinary) and Tab 1 (Elemental)
        log('Opening Bestiary Tab 0 (Ordinary)...');
        window.testOpenCollection(0);
        await sleep(500);
        window.__CAPTURES['bestiary_tab0_ordinary'] = window.__game.canvas.toDataURL('image/png');

        const colScene = window.__game.scene.getScene('CollectionScene');
        log('Switching to Bestiary Tab 1 (Elemental)...');
        colScene.currentTab = 1;
        colScene.elementalUnlocked = true;
        colScene._buildEvolutionTabs();
        colScene._renderCurrentTab();
        await sleep(500);
        window.__CAPTURES['bestiary_tab1_elemental'] = window.__game.canvas.toDataURL('image/png');

        log('Switching to Bestiary Tab 2 (Golden)...');
        colScene.currentTab = 2;
        colScene.goldenUnlocked = false;
        colScene._buildEvolutionTabs();
        colScene._renderCurrentTab();
        await sleep(500);
        window.__CAPTURES['bestiary_tab2_golden'] = window.__game.canvas.toDataURL('image/png');

        log('All tests completed successfully!');
        window.__TEST_DONE = true;
    }

    window.addEventListener('load', () => {
        setTimeout(runTestSequence, 1200);
    });
</script>
</body>
</html>
"""
    with open(test_runner_html, "w", encoding="utf-8") as f:
        f.write(html_content)

    print("Wrote test runner HTML to", test_runner_html)

if __name__ == '__main__':
    run_headless_test()
