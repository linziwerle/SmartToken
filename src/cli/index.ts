#!/usr/bin/env bun

const HELP = `
  smart-token — compress prompts, save tokens

  Proxy:
    smart-token start              Start proxy (foreground)
    smart-token start -d           Start proxy as daemon
    smart-token stop               Stop daemon
    smart-token restart            Restart daemon
    smart-token status             Show proxy status + session stats
    smart-token install            Install as auto-start service (launchd)
    smart-token uninstall          Remove auto-start service

  Mode:
    smart-token mode               Show current mode
    smart-token mode <mode>        Switch mode (off, quiet, default, dev)

  CLI:
    smart-token sharpen <file>     Compress a file (--dev, --quiet, --tier, --watch)
    smart-token stats <file>       Show historical savings dashboard

  Logs:
    smart-token logs               Show recent proxy log
    smart-token logs --clear       Clear session log

  Options:
    -h, --help                     Show this help
    -v, --version                  Show version
`;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const rest = args.slice(1);

  if (!command || command === "--help" || command === "-h") {
    console.log(HELP);
    return;
  }

  if (command === "--version" || command === "-v") {
    const pkg = await Bun.file(new URL("../../package.json", import.meta.url).pathname).json();
    console.log(`  smart-token v${pkg.version}`);
    return;
  }

  switch (command) {
    case "start": {
      const { startCommand } = await import("./daemon.ts");
      await startCommand(rest);
      break;
    }
    case "stop": {
      const { stopCommand } = await import("./daemon.ts");
      await stopCommand();
      break;
    }
    case "restart": {
      const { restartCommand } = await import("./daemon.ts");
      await restartCommand(rest);
      break;
    }
    case "status": {
      const { statusCommand } = await import("./daemon.ts");
      await statusCommand();
      break;
    }
    case "install": {
      const { installCommand } = await import("./daemon.ts");
      await installCommand();
      break;
    }
    case "uninstall": {
      const { uninstallCommand } = await import("./daemon.ts");
      await uninstallCommand();
      break;
    }
    case "mode": {
      const { modeCommand } = await import("./mode.ts");
      await modeCommand(rest);
      break;
    }
    case "logs": {
      const { logsCommand } = await import("./daemon.ts");
      await logsCommand(rest);
      break;
    }
    case "sharpen": {
      // Forward to existing sharpen CLI
      // Re-run with sharpen.ts, passing remaining args
      const sharpenPath = new URL("./sharpen.ts", import.meta.url).pathname;
      const proc = Bun.spawn([process.argv[0]!, sharpenPath, ...rest], {
        stdio: ["inherit", "inherit", "inherit"],
      });
      await proc.exited;
      process.exit(proc.exitCode ?? 0);
      break;
    }
    case "stats": {
      const statsPath = new URL("./stats.ts", import.meta.url).pathname;
      const proc = Bun.spawn([process.argv[0]!, statsPath, ...rest], {
        stdio: ["inherit", "inherit", "inherit"],
      });
      await proc.exited;
      process.exit(proc.exitCode ?? 0);
      break;
    }
    default:
      // If the arg looks like a file path, assume they mean sharpen
      if (command.includes("/") || command.includes(".")) {
        const sharpenPath = new URL("./sharpen.ts", import.meta.url).pathname;
        const proc = Bun.spawn([process.argv[0]!, sharpenPath, command, ...rest], {
          stdio: ["inherit", "inherit", "inherit"],
        });
        await proc.exited;
        process.exit(proc.exitCode ?? 0);
      } else {
        console.error(`  Unknown command: "${command}". Run 'smart-token --help' for usage.`);
        process.exit(1);
      }
  }
}

main();
