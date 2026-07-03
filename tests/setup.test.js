'use strict';

const cp = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { which } = require('../src/setup/util');
const claudeAdapter = require('../src/setup/adapters/claude');
const geminiAdapter = require('../src/setup/adapters/gemini');
const antigravityAdapter = require('../src/setup/adapters/antigravity');
const opencodeAdapter = require('../src/setup/adapters/opencode');
const cursorAdapter = require('../src/setup/adapters/cursor');

describe('Setup Utility & Adapters', () => {
  const originalPlatform = process.platform;
  const originalEnv = { ...process.env };
  let spawnSyncSpy;

  beforeEach(() => {
    spawnSyncSpy = jest.spyOn(cp, 'spawnSync');
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    spawnSyncSpy.mockRestore();
  });

  afterAll(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    process.env = originalEnv;
  });

  describe('which() utility', () => {
    it('should locate a binary on Windows using where', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      spawnSyncSpy.mockReturnValue({
        status: 0,
        stdout: 'C:\\Program Files\\nodejs\\node.exe\r\n',
      });

      const res = which('node');
      expect(res).toBe('C:\\Program Files\\nodejs\\node.exe');
      expect(spawnSyncSpy).toHaveBeenCalledWith('where', ['node'], expect.any(Object));
    });

    it('should locate a binary on Unix/Linux/macOS using which binary first', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      spawnSyncSpy.mockReturnValueOnce({
        status: 0,
        stdout: '/usr/bin/node\n',
      });

      const res = which('node');
      expect(res).toBe('/usr/bin/node');
      expect(spawnSyncSpy).toHaveBeenCalledWith('which', ['node'], expect.any(Object));
    });

    it('should fallback to command -v on Unix/Linux/macOS when which binary fails', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      // First call (which) fails
      spawnSyncSpy.mockReturnValueOnce({ status: 1 });
      // Second call (command -v) succeeds
      spawnSyncSpy.mockReturnValueOnce({
        status: 0,
        stdout: '/usr/bin/node\n',
      });

      const res = which('node');
      expect(res).toBe('/usr/bin/node');
      expect(spawnSyncSpy).toHaveBeenNthCalledWith(1, 'which', ['node'], expect.any(Object));
      expect(spawnSyncSpy).toHaveBeenNthCalledWith(2, 'command', ['-v', 'node'], expect.objectContaining({ shell: true }));
    });

    it('should return null if all Unix probes fail', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      spawnSyncSpy.mockReturnValue({ status: 1 });

      const res = which('node');
      expect(res).toBeNull();
    });
  });

  describe('Adapter Detection with Config Dir exist checks', () => {
    it('Claude: detects via binary or CLAUDE_CONFIG_DIR presence', () => {
      // Mock which('claude') to return null
      spawnSyncSpy.mockReturnValue({ status: 1 });
      
      const fsExistsMock = jest.spyOn(fs, 'existsSync');
      
      // Case 1: Config dir exists, binary doesn't
      fsExistsMock.mockReturnValueOnce(true);
      const det1 = claudeAdapter.detect();
      expect(det1.installed).toBe(true);
      expect(det1.configDir).toBe(path.join(os.homedir(), '.claude'));
      
      // Case 2: Config dir does not exist, respect CLAUDE_CONFIG_DIR env
      process.env.CLAUDE_CONFIG_DIR = '/custom/claude/dir';
      fsExistsMock.mockReturnValueOnce(false);
      const det2 = claudeAdapter.detect();
      expect(det2.installed).toBe(false);
      expect(det2.configDir).toBe('/custom/claude/dir');
      
      fsExistsMock.mockRestore();
    });

    it('Gemini: detects via binary or GEMINI_CLI_HOME presence', () => {
      // Mock which('gemini') to return null
      spawnSyncSpy.mockReturnValue({ status: 1 });
      
      const fsExistsMock = jest.spyOn(fs, 'existsSync');
      
      // Case 1: Config dir exists, binary doesn't
      fsExistsMock.mockReturnValueOnce(true);
      const det1 = geminiAdapter.detect();
      expect(det1.installed).toBe(true);
      expect(det1.configDir).toBe(path.join(os.homedir(), '.gemini'));
      
      // Case 2: Config dir does not exist, respect GEMINI_CLI_HOME env
      process.env.GEMINI_CLI_HOME = '/custom/gemini/dir';
      fsExistsMock.mockReturnValueOnce(false);
      const det2 = geminiAdapter.detect();
      expect(det2.installed).toBe(false);
      expect(det2.configDir).toBe(path.join('/custom/gemini/dir', '.gemini'));
      
      fsExistsMock.mockRestore();
    });

    it('Antigravity: detects via binary or config dir presence', () => {
      spawnSyncSpy.mockReturnValue({ status: 1 });
      const fsExistsMock = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      
      const det = antigravityAdapter.detect();
      expect(det.installed).toBe(true);
      
      fsExistsMock.mockRestore();
    });

    it('OpenCode: detects via binary or config dir presence', () => {
      spawnSyncSpy.mockReturnValue({ status: 1 });
      const fsExistsMock = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      
      const det = opencodeAdapter.detect();
      expect(det.installed).toBe(true);
      
      fsExistsMock.mockRestore();
    });
  });
});
