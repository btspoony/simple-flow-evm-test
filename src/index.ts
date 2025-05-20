import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import minimist from "minimist";
import type { LatencyData, LatencyResult, ParsedLatency, ResultJson } from "./types/outputs";
import { generateFlattenJson } from "./utils";

const runners = [
    // {
    //     providerKey: undefined,
    //     tasks: [
    //         "transfer-test",
    //         "transfer-erc20-test",
    //         "transfer-cadence-soft-finality-test",
    //         "transfer-cadence-test",
    //     ],
    //     network: "testnet",
    // },
    // {
    //     providerKey: undefined,
    //     tasks: ["transfer-test", "transfer-cadence-soft-finality-test"],
    //     network: "mainnet",
    // },
    // {
    //     providerKey: "ALCHEMY_URL",
    //     tasks: ["transfer-test", "transfer-erc20-test"],
    //     network: "testnet",
    // },
    // {
    //     providerKey: "ALCHEMY_URL",
    //     tasks: ["transfer-test"],
    //     network: "mainnet",
    // },
    // {
    //     providerKey: "QUICKNODE_URL",
    //     tasks: ["transfer-test", "transfer-erc20-test"],
    //     network: "testnet",
    // },
    // {
    //     providerKey: "QUICKNODE_URL",
    //     tasks: ["transfer-test"],
    //     network: "mainnet",
    // },
    {
        providerKey: undefined,
        tasks: ["headless-kittypunch-swap-2", "headless-kittypunch-swap-1"],
        network: "mainnet",
    },
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runScript(scriptPath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const outputs: string[] = [];
        const process = spawn("bun", [scriptPath], {
            stdio: ["inherit", "pipe", "inherit"],
        });

        process.stdout.on("data", (data) => {
            const output = data.toString().trim();
            if (output) {
                console.log(output);
                outputs.push(...output.split("\n"));
            }
        });

        process.on("close", (code) => {
            if (code === 0) {
                resolve(outputs);
            } else {
                reject(new Error(`Process exited with code ${code}`));
            }
        });

        process.on("error", (err) => {
            reject(err);
        });
    });
}

function parseLatencyLine(line: string, index: number): ParsedLatency | null {
    const match = line.match(/- (.+): (\d+)ms\(waiting\) - (\d+)ms\(completed\)/);
    if (!match) return null;

    const [, name, waiting, completed] = match;
    if (!name || !waiting || !completed) return null;

    return {
        order: index,
        name,
        waiting: Number.parseInt(waiting, 10),
        completed: Number.parseInt(completed, 10),
    };
}

// Filter runners by run-types
function filterRunnersByRunTypes(runTypes: string[] | null) {
    if (!runTypes || runTypes.length === 0) return runners;
    return runners.filter((runner) => {
        // Filter by network
        if (runTypes.includes("testnet") && runner.network === "testnet") return true;
        if (runTypes.includes("mainnet") && runner.network === "mainnet") return true;
        // Filter by providerKey
        if (runTypes.includes("default") && !runner.providerKey) return true;
        if (runTypes.includes("alchemy") && runner.providerKey === "ALCHEMY_URL") return true;
        if (runTypes.includes("quicknode") && runner.providerKey === "QUICKNODE_URL") return true;
        // Filter for headless-kittypunch
        if (
            runTypes.includes("headless-kittypunch") &&
            runner.tasks?.some((task) => task.startsWith("headless-kittypunch"))
        )
            return true;
        return false;
    });
}

async function main() {
    // Use minimist to parse CLI arguments
    const argv = minimist(process.argv.slice(2));
    let runTypes: string[] | null = null;
    if (argv["run-types"] && argv["run-types"] !== true) {
        if (Array.isArray(argv["run-types"])) {
            // Support comma-separated and repeated --run-types
            runTypes = argv["run-types"].flatMap((v: string) =>
                v
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
            );
        } else {
            // Support comma-separated values
            runTypes = String(argv["run-types"])
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
        }
    }
    const filteredRunners = filterRunnersByRunTypes(runTypes);

    const results: LatencyData[] = [];

    for (const runner of filteredRunners) {
        // TODO: This should not be how env vars are used, we should consider
        // using a config file or some other method to manage these provider URLs

        // Set environment variables based on provider key
        if (runner.providerKey) {
            process.env.EVM_MAINNET_RPC_ENDPOINT_URL = process.env[`MAINNET_${runner.providerKey}`];
            process.env.EVM_TESTNET_RPC_ENDPOINT_URL = process.env[`TESTNET_${runner.providerKey}`];
        } else {
            // If no provider key, we have to delete the variables to ensure proper
            // selection of the default provider
            process.env.EVM_MAINNET_RPC_ENDPOINT_URL = undefined;
            process.env.EVM_TESTNET_RPC_ENDPOINT_URL = undefined;
        }

        if (typeof runner.network === "string") {
            process.env.NETWORK = runner.network;
        }

        let printableEndpoint: string | undefined = undefined;
        const endpoint =
            (runner.network === "mainnet"
                ? process.env.EVM_MAINNET_RPC_ENDPOINT_URL
                : process.env.EVM_TESTNET_RPC_ENDPOINT_URL) ?? undefined;
        if (endpoint) {
            // Update printable url with * to hide api key
            if (runner.providerKey === "ALCHEMY_URL") {
                // Replace the api key with asterisks for security
                printableEndpoint = endpoint.replace(/\/v2\/.*$/, "/v2/******");
            } else if (runner.providerKey === "QUICKNODE_URL") {
                // Replace the subdomain with asterisks for security, ensuring https
                printableEndpoint = endpoint.replace(/^https?:\/\/[^.\/]+/, "https://******");
            }
        }

        for (const task of runner.tasks) {
            const scriptPath = path.join(__dirname, `${task}.ts`);
            try {
                console.log(
                    `\n\n---\n\nRunning script: ${scriptPath} @${runner.providerKey || "default"} - ${runner.network}`,
                );
                console.log(`Endpoint: ${printableEndpoint ?? "Not set, use default"}`);
                const outputs = await runScript(scriptPath);
                await delay(2000); // 2 second delay between executions

                // Find the latency section
                const latencyIndex = outputs.findIndex((line) =>
                    line.includes("---- Latencies ----"),
                );
                if (latencyIndex !== -1) {
                    const latencyOutputs = outputs.slice(latencyIndex + 1);
                    results.push({
                        network: runner.network,
                        providerKey: runner.providerKey || "default",
                        runner: task,
                        outputs: latencyOutputs,
                    });
                }
            } catch (error) {
                console.error(`Error running ${scriptPath}:`, error);
            }
        }
    }

    // Parse all latency data
    const parsedResults = results.map((result) => {
        const parsedOutputs = result.outputs
            .map(parseLatencyLine)
            .filter((output): output is ParsedLatency => output !== null);
        return {
            network: result.network,
            providerKey: result.providerKey,
            runner: result.runner,
            latencies: parsedOutputs,
        };
    });

    // Get all unique latency names in a consistent order
    const allNames = Array.from(
        new Set(parsedResults.flatMap((result) => result.latencies.map((latency) => latency.name))),
    ).sort();

    // Generate CSV
    const csvRows: string[] = [];

    // Header
    const header = [
        "network",
        "providerKey",
        "runner",
        ...allNames.flatMap((name) => [`${name}(waiting)`, `${name}(completed)`]),
    ];
    csvRows.push(header.join(","));

    // Data rows
    for (const result of parsedResults) {
        const row = [
            result.network,
            result.providerKey,
            result.runner,
            ...allNames.flatMap((name) => {
                const latency = result.latencies.find((l) => l.name === name);
                return latency ? [String(latency.waiting), String(latency.completed)] : ["", ""];
            }),
        ];
        csvRows.push(row.join(","));
    }

    // Create outputs directory if it doesn't exist
    const outputsDir = path.join(process.cwd(), "outputs");
    const csvOutputsDir = path.join(outputsDir, "csvs");
    if (!fs.existsSync(csvOutputsDir)) {
        fs.mkdirSync(csvOutputsDir, { recursive: true });
    }

    // Generate timestamp for unique filename
    const nowStr = new Date().toISOString();
    const timestamp = nowStr.replace(/[:.]/g, "-");
    const outputPath = path.join(csvOutputsDir, `latency_results_${timestamp}.csv`);

    if (csvRows.length > 1) {
        // Write to csv file
        fs.writeFileSync(outputPath, csvRows.join("\n"));
        console.log(`Results have been saved to ${outputPath}`);
    }

    // merge the data into latency_results.json
    // Load existing latency results from JSON file
    const existingResultsPath = path.join(outputsDir, "latency_results.json");
    let existingResults = require(existingResultsPath);
    if (!existingResults) {
        existingResults = { last_updated: nowStr, results: [] };
    }

    // Convert parsedResults to the format expected in latency_results.json
    const formattedResults = parsedResults.map((result) => ({
        network: result.network ?? "testnet",
        providerKey: result.providerKey,
        runner: result.runner,
        metrics: result.latencies.reduce(
            (acc, latency) => {
                acc[latency.name] = {
                    waiting: latency.waiting,
                    completed: latency.completed,
                };
                return acc;
            },
            {} as Record<string, { waiting: number; completed: number }>,
        ),
    }));

    if (formattedResults.length > 0) {
        // Add the formatted results to the existing results
        existingResults.results.push({
            timestamp: nowStr,
            tests: formattedResults,
        });
    } else {
        console.log("No new results to merge.");
    }

    // Optimize the existingResults.results array, only keep the last 1 month of data
    const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const archiveResults = existingResults.results.filter(
        (result: LatencyResult) => new Date(result.timestamp).getTime() < oneMonthAgo,
    );
    existingResults.results = existingResults.results.filter(
        (result: LatencyResult) => new Date(result.timestamp).getTime() >= oneMonthAgo,
    );

    if (formattedResults.length > 0 || archiveResults.length > 0) {
        // Update the last_updated timestamp
        existingResults.last_updated = nowStr;

        if (archiveResults.length > 0) {
            console.log(
                `Archiving results from the last 1 month, amount: ${archiveResults.length}`,
            );
            // Merge the archive results into the previous results
            const firstArchiveDate = new Date(archiveResults[0].timestamp);
            const firstArchiveQuarterFileName = `${firstArchiveDate.getFullYear()}Q${Math.ceil(firstArchiveDate.getMonth() / 3)}_latency_results.json`;
            const lastQuarterResultsFilePath = path.join(
                outputsDir,
                "archived",
                firstArchiveQuarterFileName,
            );
            // Load the previous results
            let lastQuarterResults: ResultJson = { last_updated: nowStr, results: [] };
            // check if the file exists
            if (fs.existsSync(lastQuarterResultsFilePath)) {
                lastQuarterResults = require(lastQuarterResultsFilePath) as ResultJson;
            }
            lastQuarterResults.results.push(...archiveResults);
            fs.writeFileSync(
                lastQuarterResultsFilePath,
                JSON.stringify(lastQuarterResults, null, 4),
            );
        }

        // Write the updated results back to the JSON file
        fs.writeFileSync(existingResultsPath, JSON.stringify(existingResults, null, 4));
        console.log(`Results have been merged into ${existingResultsPath}`);

        // Export flattened output json file
        const flattenedOutputPath = path.join(outputsDir, "flattened_output.json");

        // Load and process the latency results
        const flattenedResults = generateFlattenJson(existingResults.results);

        // Write flattened results to file
        fs.writeFileSync(flattenedOutputPath, JSON.stringify(flattenedResults, null, 4));
        console.log(`Flattened results have been saved to ${flattenedOutputPath}`);
    }
}

main().catch(console.error);
