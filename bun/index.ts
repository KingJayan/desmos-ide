import Electrobun, { ApplicationMenu, BrowserView, BrowserWindow, Utils } from 'electrobun/bun';
import { basename } from 'path';
import type { DesmosIdeRPC } from '../src/shared/rpc-schema';
import { exportImage, exportJson, exportTex, openFile, openJsonFile, readFileAt, saveFile, unwatchAll, unwatchFile, watchFile } from './files';
import { showConfirm, showFolderDialog, showPrompt } from './dialogs';
import { fetchRegistry, installPlugin, listPlugins, pluginIcon, pluginReadme, setPluginEnabled, uninstallPlugin } from './plugins';
import {
  deletePluginSecret, getPluginSecret, pluginState, storePluginSecret, updatePluginState,
} from './plugin-storage';
import { allowRoot, loadAllowed } from './paths';
import { ensureConfig, readConfig, watchConfig, writeConfig } from './config';
import { searchFolder, searchPaths } from './search';
import { deleteSecret, getSecret, secretsAvailable, setSecret } from './secrets';
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

await loadAllowed();
await ensureConfig();

// git push/pull and provider calls far exceed the 1s rpc default
const rpc = BrowserView.defineRPC<DesmosIdeRPC>({
  maxRequestTime: 60_000,
  handlers: {
    requests: {
      openFile: () => openFile(),
      saveFile: ({ path, content }) => saveFile(path, content),
      exportJson: ({ content, defaultName }) => exportJson(content, defaultName),
      openJsonFile: () => openJsonFile(),
      exportTex: ({ content, defaultName }) => exportTex(content, defaultName),
      exportImage: ({ data, defaultName, format }) => exportImage(data, defaultName, format),
      pickFolder: async () => allowRoot(await showFolderDialog()),
      watchFile: ({ path }) => {
        watchFile(path, (changedPath, content) =>
          rpc.send.fileChanged({ path: changedPath, content }));
      },
      unwatchFile: ({ path }) => unwatchFile(path),
      readFileAt: ({ path }) => readFileAt(path),
      searchFiles: ({ paths, query, useRegex }) => searchPaths(paths, query, useRegex),
      searchFolder: ({ root, query, useRegex }) => searchFolder(root, query, useRegex),

      secretsAvailable: () => secretsAvailable(),
      secretGet: ({ account }) => getSecret(account),
      secretSet: ({ account, value }) => setSecret(account, value),
      secretDelete: ({ account }) => deleteSecret(account),

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

      pluginList: () => listPlugins(),
      pluginSetEnabled: ({ id, enabled }) => setPluginEnabled(id, enabled),
      pluginUninstall: ({ id }) => uninstallPlugin(id),
      pluginRegistry: () => fetchRegistry(),
      pluginInstall: ({ id }) => installPlugin(id),
      pluginIcon: ({ id }) => pluginIcon(id),
      pluginReadme: ({ id }) => pluginReadme(id),
      pluginState: ({ id, workspace }) => pluginState(id, workspace),
      pluginStateUpdate: ({ id, scope, workspace, key, value }) =>
        updatePluginState(id, scope, workspace, key, value),
      pluginSecret: ({ id, key }) => getPluginSecret(id, key),
      pluginSecretStore: ({ id, key, value }) => storePluginSecret(id, key, value),
      pluginSecretDelete: ({ id, key }) => deletePluginSecret(id, key),

      configRead: ({ file }) => readConfig(file),
      configWrite: ({ file, content }) => writeConfig(file, content),

      openExternal: ({ url }) => {
        if (/^https?:\/\//i.test(url)) Utils.openExternal(url);
      },
      setRecentFiles: ({ paths }) => setRecentFiles(paths),
      confirm: ({ message }) => showConfirm(message),
      promptInput: ({ message, defaultValue }) => showPrompt(message, defaultValue),
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

watchConfig((file, content) => rpc.send.configChanged({ file, content }));

async function resolveViewUrl(): Promise<string> {
  if (process.env['DESMOS_IDE_DEV']) {
    try {
      await fetch(DEV_SERVER_URL, { method: 'HEAD' });
      return DEV_SERVER_URL;
    } catch {
      console.warn('vite dev server not running, falling back to bundled view');
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

// the recent list lives in the renderer, so the menu is rebuilt whenever it changes
let recentPaths: string[] = [];

function setRecentFiles(paths: string[]): void {
  recentPaths = Array.isArray(paths) ? paths.filter(p => typeof p === 'string' && p).slice(0, 12) : [];
  buildMenu();
}

function buildMenu(): void {
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
      { label: 'Export TeX Figure…', accelerator: 'CmdOrCtrl+Shift+T', action: 'menu:exportTex' },
      { label: 'Export PNG…', accelerator: 'CmdOrCtrl+Shift+E', action: 'menu:exportPng' },
      { label: 'Export SVG…', action: 'menu:exportSvg' },
      { label: 'Copy Share Link', action: 'menu:share' },
      { type: 'separator' },
      { label: 'Plugins…', accelerator: 'CmdOrCtrl+7', action: 'menu:plugins' },
      { type: 'separator' },
      {
        label: 'Open Recent',
        submenu: recentPaths.length
          ? recentPaths.map(path => ({ label: basename(path), action: `menu:recent:${path}` }))
          : [{ label: 'No Recent Files', enabled: false }],
      },
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
}

buildMenu();

ApplicationMenu.on('application-menu-clicked', (event: unknown) => {
  const action = (event as { data?: { action?: string } })?.data?.action;
  if (action === 'menu:new') rpc.send.menuNew();
  else if (action === 'menu:open') rpc.send.menuOpen();
  else if (action === 'menu:save') rpc.send.menuSave();
  else if (action === 'menu:saveAs') rpc.send.menuSaveAs();
  else if (action === 'menu:exportTex') rpc.send.menuExportTex();
  else if (action === 'menu:exportPng') rpc.send.menuExportImage({ format: 'png' });
  else if (action === 'menu:exportSvg') rpc.send.menuExportImage({ format: 'svg' });
  else if (action === 'menu:share') rpc.send.menuShare();
  else if (action === 'menu:plugins') rpc.send.menuPlugins();
  else if (action?.startsWith('menu:recent:')) rpc.send.menuOpenRecent({ path: action.slice('menu:recent:'.length) });
});

// the marketplace on the website opens a plugin in the app with dsmx://plugin/<id>
Electrobun.events.on('open-url', (event: unknown) => {
  const url = (event as { data?: { url?: string } })?.data?.url;
  const id = /^dsmx:\/\/plugin\/([a-z0-9-]{2,40})\/?$/i.exec(url ?? '')?.[1];
  if (id) rpc.send.openPluginPage({ id: id.toLowerCase() });
});

win.on('close', () => {
  unwatchAll();
});
