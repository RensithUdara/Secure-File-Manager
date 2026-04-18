const { spawn } = require('child_process');

function openCmdAt(targetPath) {
  if (process.platform === 'win32') {
    spawn('cmd.exe', ['/K', 'cd', '/d', targetPath], { detached: true });
    return;
  }

  if (process.platform === 'darwin') {
    spawn('open', ['-a', 'Terminal', targetPath], { detached: true });
    return;
  }

  spawn('x-terminal-emulator', ['--working-directory', targetPath], { detached: true });
}

module.exports = { openCmdAt };
