import { ApplicationMenu, BrowserView, BrowserWindow, Utils } from 'electrobun/bun';
import type { DesmosIdeRPC } from '../src/shared/rpc-schema';
import { exportJson, openFile, saveFile, unwatchAll, unwatchFile, watchFile } from './files';
import { showConfirm } from './dialogs';
import {
  getGitBranches, getGitHistory, getGitRemotes, getGitStatus,
  gitCheckoutBranch, gitCreateBranch, gitFetch, gitPull, gitPush,
  gitRemoteAdd, gitRemoteRemove, setGitContext,
} from './git';
import {
  buildSystemText, compactConversation, copilotGetModels, copilotPollDeviceFlow,
  copilotRevoke, copilotStartDeviceFlow, logAiError, sanitizeConfig,
  sanitizeMemories, sanitizeMessages, streamOpenAICompatible, titleConversation,
  toProviderErrorMessage,
} from './ai';

const DEV_SERVER_URL = 'http://localhost:5173';

// git push/pull and provider calls far exceed the 1s rpc default
const rpc = BrowserView.defineRPC<DesmosIdeRPC>({
  maxRequestTime: 60_000,
  handlers: {
    requests: {
      openFile: () => openFile(),
      saveFile: ({ path, content }) => saveFile(path, content),
      exportJson: ({ content }) => exportJson(content),
      watchFile: ({ path }) => {
        watchFile(path, (changedPath, content) =>
          rpc.send.fileChanged({ path: changedPath, content }));
      },
      unwatchFile: ({ path }) => unwatchFile(path),

      aiCompact: ({ messages, config, memories }) =>
        compactConversation(sanitizeMessages(messages), sanitizeConfig(config), sanitizeMemories(memories)),
      aiTitle: ({ messages, config }) =>
        titleConversation(sanitizeMessages(messages), sanitizeConfig(config)),

      setGitContext: ({ path }) => setGitContext(path),
      gitStatus: () => getGitStatus(),
      gitBranches: () => getGitBranches(),
      gitHistory: ({ limit }) => getGitHistory(limit),
      gitRemotes: () => getGitRemotes(),
      gitCheckoutBranch: ({ name }) => gitCheckoutBranch(name),
      gitCreateBranch: ({ name }) => gitCreateBranch(name),
      gitRemoteAdd: ({ name, url }) => gitRemoteAdd(name, url),
      gitRemoteRemove: ({ name }) => gitRemoteRemove(name),
      gitFetch: ({ remote }) => gitFetch(remote),
      gitPull: ({ remote, branch }) => gitPull(remote, branch),
      gitPush: ({ remote, branch, setUpstream }) => gitPush(remote, branch, setUpstream),

      copilotStartDeviceFlow: () => copilotStartDeviceFlow(),
      copilotPollDeviceFlow: ({ deviceCode }) => copilotPollDeviceFlow(deviceCode),
      copilotRevoke: () => copilotRevoke(),
      copilotGetModels: ({ githubToken }) => copilotGetModels(githubToken),

      openExternal: ({ url }) => {
        if (/^https?:\/\//i.test(url)) Utils.openExternal(url);
      },
      confirm: ({ message }) => showConfirm(message),
    },
    messages: {
      aiChat: async payload => {
        const reqId = typeof payload?.reqId === 'string' ? payload.reqId : '';
        if (!reqId) return;
        const config = sanitizeConfig(payload.config);
        try {
          const messages = sanitizeMessages(payload.messages);
          const systemText = buildSystemText(sanitizeMemories(payload.memories));
          await streamOpenAICompatible(config, messages, systemText, text =>
            rpc.send.aiChunk({ reqId, text }));
          rpc.send.aiDone({ reqId });
        } catch (err) {
          logAiError('ai:chat', reqId, config, err);
          rpc.send.aiError({ reqId, error: toProviderErrorMessage(err, config) });
        }
      },
    },
  },
});

async function resolveViewUrl(): Promise<string> {
  if (process.env['DESMOS_IDE_DEV']) {
    try {
      await fetch(DEV_SERVER_URL, { method: 'HEAD' });
      return DEV_SERVER_URL;
    } catch {
      console.log('vite dev server not running, falling back to bundled view');
    }
  }
  return 'views://mainview/index.html';
}

const win = new BrowserWindow({
  title: 'Desmos IDE',
  url: await resolveViewUrl(),
  frame: { x: 100, y: 100, width: 1440, height: 900 },
  titleBarStyle: 'hiddenInset',
  rpc,
});

ApplicationMenu.setApplicationMenu([
  {
    label: 'desmos-ide',
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'quit' },
    ],
  },
  {
    label: 'File',
    submenu: [
      { label: 'New', accelerator: 'CmdOrCtrl+N', action: 'menu:new' },
      { label: 'Open…', accelerator: 'CmdOrCtrl+O', action: 'menu:open' },
      { label: 'Save', accelerator: 'CmdOrCtrl+S', action: 'menu:save' },
      { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', action: 'menu:saveAs' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' }, { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
    ],
  },
  {
    label: 'View',
    submenu: [
      { role: 'toggleFullScreen' },
      { role: 'zoom' },
      { role: 'minimize' },
    ],
  },
]);

ApplicationMenu.on('application-menu-clicked', (event: unknown) => {
  const action = (event as { data?: { action?: string } })?.data?.action;
  if (action === 'menu:new') rpc.send.menuNew();
  else if (action === 'menu:open') rpc.send.menuOpen();
  else if (action === 'menu:save') rpc.send.menuSave();
  else if (action === 'menu:saveAs') rpc.send.menuSaveAs();
});

win.on('close', () => {
  unwatchAll();
});
