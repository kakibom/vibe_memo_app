const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const todoPath = path.join(app.getPath("userData"), "todo.json");
let win; // 전역 변수로 선언

function createWindow() {
  win = new BrowserWindow({
    // win 변수에 할당
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true,
    },
  });

  win.loadFile("index.html");

  // 검색 결과가 나오면 렌더러로 개수를 보내줌
  win.webContents.on("found-in-page", (event, result) => {
    win.webContents.send("search-result", result);
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// 파일 입출력 로직들 (기존 유지)
ipcMain.handle("save-file", async (event, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (!canceled && filePath) {
    fs.writeFileSync(filePath, content);
    return filePath;
  }
  return null;
});

ipcMain.handle("open-file", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (!canceled && filePaths.length > 0) {
    return {
      path: filePaths[0],
      content: fs.readFileSync(filePaths[0], "utf-8"),
    };
  }
  return null;
});

// To-Do 저장 로직들 (기존 유지)
ipcMain.handle("save-todo", (event, data) => {
  try {
    fs.writeFileSync(todoPath, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    return false;
  }
});

ipcMain.handle("load-todo", () => {
  try {
    if (fs.existsSync(todoPath))
      return JSON.parse(fs.readFileSync(todoPath, "utf-8"));
  } catch (e) {}
  return null;
});

// 🔥 검색 기능 핸들러 추가
ipcMain.on("find-text", (event, { text, forward = true }) => {
  if (text) {
    win.webContents.findInPage(text, { forward, findNext: true });
  } else {
    win.webContents.stopFindInPage("clearSelection");
  }
});

ipcMain.on("stop-find", () => {
  win.webContents.stopFindInPage("clearSelection"); // 검색 종료 및 하이라이트 제거
});
