const net = require('net');
const { spawn } = require('child_process');

const MIN_PORT = 8081;
const MAX_PORT = 8090;

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, '0.0.0.0');
  });
}

async function findFreePort(min, max) {
  for (let port = min; port <= max; port += 1) {
    if (await isPortFree(port)) {
      return port;
    }
  }

  throw new Error(`No free port found in range ${min}-${max}.`);
}

async function start() {
  const port = await findFreePort(MIN_PORT, MAX_PORT);
  const expoCliPath = require.resolve('expo/bin/cli');
  const args = [expoCliPath, 'start', '--lan', '--clear', '--port', String(port)];

  console.log(`Starting Expo on LAN at port ${port}...`);

  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    shell: false,
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  child.on('error', (error) => {
    console.error('Failed to start Expo:', error.message);
    process.exit(1);
  });
}

start().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
