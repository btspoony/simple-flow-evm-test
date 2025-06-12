import { buildHeadlessBrowerContextWithFlowWallet, enableKittypunch } from "./headless/context";
import { Batch } from "./utils";

import {
    DoSigningTransaction,
    InitKittypunchSwap,
    SwapFlowToUsdf,
    WaitForCompleted,
} from "./actions/kittypunch";

async function start() {
    const ctx = await buildHeadlessBrowerContextWithFlowWallet();
    await enableKittypunch(ctx);

    const batch = new Batch(ctx, [
        new InitKittypunchSwap(0),
        new SwapFlowToUsdf(1, 120000),
        new DoSigningTransaction(2, 300000),
        new WaitForCompleted(3, 300000),
    ]);

    await batch.run();

    batch.printLatencies();
}

// Run the main function
try {
    await start();
} catch (error) {
    console.error("Error:", error);
} finally {
    process.exit(0);
}
