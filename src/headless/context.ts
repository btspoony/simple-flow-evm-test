import type { BrowserContext } from "../types/context";
import { HeadlessBrowser } from "./brower";
import { KittyPunch } from "./websites";

export async function buildHeadlessBrowerContextWithMetamask() {
    const browser = new HeadlessBrowser("metamask");

    try {
        console.log("Initializing browser...");
        await browser.initialize();
        console.log("Ensuring extension is loaded...");
        await browser.ensureExtensionLoaded();
        console.log("Activating metamask...");
        await browser.activateMetamask();
        console.log("Switching to flow mainnet...");
        await browser.switchToFlowMainnet();
        console.log("Browser initialized successfully");
    } catch (error) {
        await browser.close();
        console.error("Error initializing browser:", error);
        throw error;
    }

    return { browser, websites: {}, latencies: {} } as BrowserContext;
}


export async function buildHeadlessBrowerContextWithFlowWallet() {
    const browser = new HeadlessBrowser("flowwallet");

    try {
        console.log("Initializing browser...");
        await browser.initialize();
        console.log("Ensuring extension is loaded...");
        await browser.ensureExtensionLoaded();
        console.log("Activating flow wallet...");
        await browser.activateFlowWallet();
        console.log("Switching to flow mainnet...");
        await browser.switchToFlowMainnet();
        console.log("Browser initialized successfully");
    } catch (error) {
        await browser.close();
        console.error("Error initializing browser:", error);
        throw error;
    }

    return { browser, websites: {}, latencies: {} } as BrowserContext;
}


export async function enableKittypunch(ctx: BrowserContext) {
    const kittypunch = new KittyPunch(ctx.browser);
    ctx.websites.kittypunch = kittypunch;
}
