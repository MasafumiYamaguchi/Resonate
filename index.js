const path = require("path");
const { app, BrowserWindow, webContents } = require("electron");
const fs = require("fs");
const { ipcMain } = require("electron");
const { Menu, dialog } = require("electron");
const mm = require("music-metadata");

let win;
let isExpanded = false;

// electron-reloadの設定
if (process.env.NODE_ENV === "development") {
  require("electron-reload")(__dirname, {
    electron: require(`${__dirname}/node_modules/electron`),
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 600,
    height: 650,
    maximizable: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: true,
    },
    icon: path.join(__dirname, "assets", "icon.png"),
  });
  if (process.env.NODE_ENV === "development") {
    win.webContents.openDevTools();
  }
  win.loadFile("index.html");
}

function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Open",
          click() {
            openFolder();
          },
        },
        {
          label: "Exit",
          click() {
            app.quit();
          },
        },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createMenu();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// フォルダを開く処理
function openFolder() {
  dialog
    .showOpenDialog({
      properties: ["openDirectory"],
    })
    .then((result) => {
      if (result.canceled) {
        return;
      }
      const folderPath = result.filePaths[0];
      console.log(folderPath);
      fs.readdir(folderPath, (err, files) => {
        if (err) {
          console.log(err);
          return;
        }
        const filesPath = files.map((file) => path.join(folderPath, file));
        console.log(filesPath);
        if (
          win &&
          !win.isDestroyed() &&
          win.webContents &&
          !win.webContents.isDestroyed()
        ) {
          try {
            win.webContents.send("folder-opened", filesPath);
          } catch (err) {
            console.error("Error sending message to renderer:", err);
          }
        }
      });
    });
}

async function loadMetadata(filePath) {
  try {
    const metadata = await mm.parseFile(filePath);
    let imagedata = null;

    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const picture = metadata.common.picture[0];

      // picture.dataがBufferであることを確認
      const imgBuffer = Buffer.isBuffer(picture.data)
        ? picture.data
        : Buffer.from(picture.data);

      // Base64エンコーディングを適切に行う
      const base64Data = imgBuffer.toString("base64");

      // MIMEタイプを含めたdata URL形式で画像データを作成
      imagedata = `data:${picture.format};base64,${base64Data}`;

      console.log(
        "画像データを読み込みました:",
        picture.format,
        imgBuffer.length,
        "bytes"
      );
      console.log(
        "Base64データプレビュー:",
        imagedata.substring(0, 50) + "..."
      );
    } else {
      console.log("画像データがありません:", filePath);
    }

    return {
      title: metadata.common.title || path.basename(filePath),
      artist: metadata.common.artist || "Unknown Artist",
      album: metadata.common.album || "Unknown Album",
      duration: metadata.format.duration || 0,
      image: imagedata,
    };
  } catch (err) {
    console.error("Error reading metadata:", err);
    return {
      title: path.basename(filePath),
      artist: "Unknown Artist",
      album: "Unknown Album",
      duration: 0,
      image: null,
    };
  }
}

ipcMain.handle("load-metadata", async (event, filePath) => {
  return await loadMetadata(filePath);
});

//AppleMusicボタンが押されたときの処理
ipcMain.on("open-spotify", (event) => {
  win = BrowserWindow.getFocusedWindow();
  if (win) {
    isExpanded = !isExpanded;
    
    // リサイズ処理を関数にまとめる
    const resizeWindow = () => {
      win.setResizable(true);
      if (isExpanded) {
        win.setSize(1200, 650);
        win.webContents.send("open-AMtab");
      } else {
        win.setSize(600, 650);
        win.webContents.send("close-AMtab");
      }
      win.setResizable(false);
    };

  }
});

// ウィンドウ移動中のサイズ変更を防ぐ
app.whenReady().then(() => {
  createWindow();
  createMenu();
  
  // ウィンドウのドラッグ操作を監視
  win.on('will-move', () => {
  });
});
