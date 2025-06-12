import type { HeadlessBrowser } from "../brower";
import { FLOW_EVM_TOKENS, type SupportedToken } from "../constants";

export class KittyPunch {
    static getSwapUrl(from: SupportedToken, to: SupportedToken) {
        logWithTimestamp(`Generating swap URL from ${from} to ${to}`);
        if (from === to) {
            logWithTimestamp("Error: From and to tokens cannot be the same");
            throw new Error("From and to tokens cannot be the same");
        }
        const url = `https://swap.kittypunch.xyz/swap?tokens=${FLOW_EVM_TOKENS[from]}-${FLOW_EVM_TOKENS[to]}`;
        logWithTimestamp(`Swap URL generated: ${url}`);
        return url;
    }

    constructor(private readonly browser: HeadlessBrowser) { }

    async openSwapFlowToUsdfUrl() {
        logWithTimestamp("Opening swap page for FLOW to USDF...");
        const url = KittyPunch.getSwapUrl("FLOW", "USDF");
        await this.browser.openNewPageWithUrl(url);
        logWithTimestamp("Swap page opened.");
    }

    async connectWallet() {
        logWithTimestamp("Attempting to connect wallet...");
        const page = this.browser.getCurrentPage();
        await page.waitForTimeout(1000);
        // check if the wallet is already connected
        const connectBtn = page.getByRole("button", { name: "Connect Wallet" });
        if (!(await connectBtn.isVisible())) {
            logWithTimestamp("Wallet already connected. Skipping connect.");
            return;
        }
        logWithTimestamp("Clicking 'Connect Wallet' button...");
        await connectBtn.click();
        logWithTimestamp("Selecting installed wallet option...");
        await page.getByTestId(/rk-wallet-option-(com|io)\.*/).first().click();
        logWithTimestamp("Waiting for wallet notification and confirming...");
        // wait for notification page to be opened
        await this.browser.waitForNotificationPageAndClickConfirm();
        logWithTimestamp("Wallet connected.");
    }

    async doSwap(from: SupportedToken, to: SupportedToken, amountButtonText: string) {
        logWithTimestamp(`Starting swap: ${from} -> ${to}, amount: ${amountButtonText}`);
        const url = KittyPunch.getSwapUrl(from, to);
        await this.browser.setPageWithUrl(url);
        logWithTimestamp(`Navigated to swap page: ${url}`);
        const page = this.browser.getCurrentPage();
        await page.waitForLoadState("networkidle");
        logWithTimestamp(`Page loaded, clicking amount button: ${amountButtonText}`);
        // Input amount
        await page.getByRole("button", { name: amountButtonText }).isEnabled();
        await page.getByRole("button", { name: amountButtonText }).click();
        logWithTimestamp("Amount button clicked.");
        // Get swap button
        const swapBtn = page
            .locator("div")
            .filter({ hasText: /^Swap$/ })
            .getByRole("button");
        logWithTimestamp("Waiting for the swap button to be enabled...");
        // Wait for the swap button to be visible
        await swapBtn.waitFor({ state: "visible", timeout: 10000 });
        // Wait for the swap button to be enabled
        const timeout = 60000;
        const startTime = Date.now();
        while (await swapBtn.isDisabled()) {
            if (Date.now() - startTime > timeout) {
                logWithTimestamp("Error: Swap button is not enabled after timeout");
                throw new Error("Swap button is not enabled");
            }
            await page.waitForTimeout(100);
        }
        logWithTimestamp("Swap button is enabled, clicking...");
        // Click on the swap button
        await swapBtn.click();
        logWithTimestamp("Swap button clicked. Waiting for transaction...");
    }

    async inTransactionFailedCheck() {
        logWithTimestamp("Checking if transaction failed...");
        const page = this.browser.getCurrentPage();
        const closeVisible = await page
            .locator("button")
            .filter({ hasText: /^Close$/ })
            .isVisible();
        const reasonVisible = await page
            .locator("p")
            .filter({ hasText: "reverted with the following reason" })
            .isVisible();
        if (closeVisible && reasonVisible) {
            logWithTimestamp("Transaction failed detected.");
            return true;
        }
        logWithTimestamp("No transaction failure detected.");
        return false;
    }

    async isApprovingTokens() {
        logWithTimestamp("Checking if tokens are being approved...");
        const page = this.browser.getCurrentPage();
        const approving = await page.locator("p").filter({ hasText: "Approving" }).isVisible();
        logWithTimestamp(`Approving tokens: ${approving}`);
        return approving;
    }

    async waitForTransactionCompleted() {
        logWithTimestamp("Waiting for transaction to complete...");
        const page = this.browser.getCurrentPage();
        await page
            .locator("p")
            .filter({ hasText: /^Transaction completed$/ })
            .waitFor({ state: "visible", timeout: 60000 });
        logWithTimestamp("Transaction completed!");
    }
}

function logWithTimestamp(message: string) {
    const now = new Date();
    const timestamp = now.toISOString();
    // Add some color and formatting for better visibility
    console.log(`\x1b[36m[KittyPunch][${timestamp}]\x1b[0m ${message}`);
}
