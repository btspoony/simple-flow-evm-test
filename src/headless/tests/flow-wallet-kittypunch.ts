import { HeadlessBrowser } from "../brower";
import { KittyPunch } from "../websites/kittypunch";

async function testMetaMask() {
    const browser = new HeadlessBrowser("flowwallet");
    try {
        await browser.initialize();
        await browser.ensureExtensionLoaded();
        await browser.activateFlowWallet();
        await browser.switchToFlowMainnet();

        // const kittypunch = new KittyPunch(browser);
        // await kittypunch.openSwapFlowToUsdfUrl();
        // await kittypunch.connectWallet();

        // await kittypunch.doSwap("FLOW", "USDF", "25%");
        // await browser.waitForNotificationPageAndClickConfirm({
        //     failCheck: () => kittypunch.inTransactionFailedCheck(),
        //     failMessage: "Transaction Request reverted or failed, App shows an error",
        // });
        // await kittypunch.waitForTransactionCompleted();

        // await kittypunch.doSwap("USDF", "FLOW", "Max");
        // // Wait for the notification page to be opened
        // await browser.waitForNotificationPageAndClickConfirm({
        //     failCheck: () => kittypunch.inTransactionFailedCheck(),
        //     failMessage: "Transaction Request reverted or failed, App shows an error",
        // });
        // if (await kittypunch.isApprovingTokens()) {
        //     await browser.waitForNotificationPageAndClickConfirm();
        // }
        // await kittypunch.waitForTransactionCompleted();

        console.log("Test completed successfully!");
    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        // await browser.close();
    }
}

testMetaMask().catch(console.error);
