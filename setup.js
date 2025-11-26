const fs = require('fs');
const path = require('path');

// 1. package.json 내용
const packageJson = {
  "name": "my-productivity-app",
  "version": "1.0.0",
  "description": "Markdown Memo + Todo + ChatGPT App",
  "main": "main.js",
  "scripts": {
    "start": "electron ."
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "devDependencies": {
    "electron": "^28.0.0" 
  },
  "dependencies": {
    "@toast-ui/editor": "^3.2.2",
    "sortablejs": "^1.15.0"
  }
};

// 2. main.js 내용
const mainJs = `
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 900,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webviewTag: true
        }
    });

    win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('save-file', async (event, content) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        filters: [{ name: 'Markdown', extensions: ['md'] }]
    });
    if (!canceled && filePath) {
        fs.writeFileSync(filePath, content);
        return filePath;
    }
    return null;
});

ipcMain.handle('open-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Markdown', extensions: ['md'] }]
    });
    if (!canceled && filePaths.length > 0) {
        const content = fs.readFileSync(filePaths[0], 'utf-8');
        return { path: filePaths[0], content };
    }
    return null;
});
`;

// 3. index.html 내용
const indexHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>My Productivity App</title>
    <link rel="stylesheet" href="node_modules/@toast-ui/editor/dist/toastui-editor.css" />
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <div class="left-panel">
            <div class="toolbar-extra">
                <button id="btn-load">📂 불러오기</button>
                <button id="btn-save">💾 저장하기</button>
                <span id="status-msg"></span>
            </div>
            <div id="editor"></div>
        </div>
        <div class="right-panel">
            <div class="todo-section">
                <h3>✅ To-Do List</h3>
                <div class="todo-input-area">
                    <input type="text" id="todo-input" placeholder="할 일 입력 (Enter)" />
                    <select id="todo-category">
                        <option value="immediate">🔥 바로 할 일</option>
                        <option value="backlog">📥 일단 접수</option>
                    </select>
                    <button id="btn-add-todo">추가</button>
                </div>
                <div class="todo-columns">
                    <div class="todo-col">
                        <h4>🔥 바로 할 일</h4>
                        <ul id="list-immediate" class="todo-list"></ul>
                    </div>
                    <div class="todo-col">
                        <h4>📥 일단 접수</h4>
                        <ul id="list-backlog" class="todo-list"></ul>
                    </div>
                    <div class="todo-col completed">
                        <h4>🎉 완료</h4>
                        <ul id="list-done" class="todo-list"></ul>
                    </div>
                </div>
            </div>
            <div class="chatgpt-section">
                <webview src="https://chatgpt.com"></webview>
            </div>
        </div>
    </div>
    <script src="renderer.js"></script>
</body>
</html>
`;

// 4. style.css 내용
const styleCss = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body, html { height: 100%; overflow: hidden; font-family: 'Segoe UI', sans-serif; }
.container { display: flex; height: 100vh; width: 100vw; }
.left-panel { width: 50%; border-right: 1px solid #ddd; display: flex; flex-direction: column; background: #fff; }
.toolbar-extra { padding: 10px; background: #f4f4f4; border-bottom: 1px solid #ddd; display: flex; gap: 10px; align-items: center; }
#editor { height: calc(100% - 50px); }
.right-panel { width: 50%; display: flex; flex-direction: column; }
.todo-section { height: 40%; padding: 15px; background: #f9f9f9; border-bottom: 2px solid #ccc; display: flex; flex-direction: column; }
.todo-input-area { display: flex; gap: 5px; margin-bottom: 10px; }
.todo-input-area input { flex: 1; padding: 5px; }
.todo-columns { display: flex; gap: 10px; flex: 1; overflow-y: auto; }
.todo-col { flex: 1; background: #fff; border: 1px solid #eee; padding: 5px; border-radius: 5px; display: flex; flex-direction: column; min-height: 150px; }
.todo-list { list-style: none; min-height: 50px; flex: 1; padding: 5px; }
.todo-list li { padding: 8px; background: #fff; border-bottom: 1px solid #eee; cursor: move; display: flex; align-items: center; gap: 5px; margin-bottom: 5px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
.chatgpt-section { height: 60%; background: #fff; border-top: 1px solid #ccc; }
webview { width: 100%; height: 100%; }
h4 { margin-bottom: 10px; font-size: 0.9em; color: #555; text-align: center;}
`;

// 5. renderer.js 내용
const rendererJs = `
const Editor = require('@toast-ui/editor');
const Sortable = require('sortablejs');
const { ipcRenderer } = require('electron');

const editor = new Editor({
    el: document.querySelector('#editor'),
    height: '100%',
    initialEditType: 'markdown',
    previewStyle: 'vertical'
});

editor.on