const { ipcRenderer, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const mm = require("music-metadata");

console.log("renderer.js loaded");

// グローバルで使用する変数
const fileList = document.getElementById("file-list");
const back = document.getElementById("back");
let audioPlayer;
let playlist = [];
let currentTrack = 0;
let musicMetadata = null;

// DOM要素への参照をグローバルに定義
let playButton, pauseButton, prevButton, nextButton;
let progressBar, currentTimeElement, totalTimeElement;
let titleElement, artistElement, albumCoverElement;

// パスの履歴を保持する配列
const pathHistory = [];
// 現在のパスを保持する変数
let currentPath = "";

// プレイヤーの初期化
function initializePlayer() {
  console.log("プレイヤーの初期化を開始します");

  // DOM要素を取得
  playButton = document.getElementById("play");
  pauseButton = document.getElementById("pause");
  prevButton = document.getElementById("prev");
  nextButton = document.getElementById("next");
  progressBar = document.querySelector(".progressbar");
  currentTimeElement = document.querySelector(".current-time");
  totalTimeElement = document.querySelector(".total-time");
  titleElement = document.querySelector(".title");
  artistElement = document.querySelector(".artist");
  albumCoverElement = document.querySelector(".album-cover");
  applemusic = document.querySelector(".applemusic");
  AMtab = document.querySelector(".AMtab");

  // デバッグ情報を表示
  console.log("DOM要素の取得状況:");
  console.log("progressBar:", progressBar);
  console.log("currentTimeElement:", currentTimeElement);
  console.log("totalTimeElement:", totalTimeElement);

  // 要素が見つからない場合は作成する
  if (!currentTimeElement) {
    console.log("current-time要素が見つかりません。作成します。");
    currentTimeElement = document.createElement("span");
    currentTimeElement.className = "current-time";
    currentTimeElement.textContent = "00:00";

    // プレイヤー情報エリアに追加
    const playerInfo = document.querySelector(".player-info") || document.body;
    playerInfo.appendChild(currentTimeElement);
  }

  if (!totalTimeElement) {
    console.log("total-time要素が見つかりません。作成します。");
    totalTimeElement = document.createElement("span");
    totalTimeElement.className = "total-time";
    totalTimeElement.textContent = "00:00";

    // スラッシュを追加
    const slash = document.createTextNode(" / ");

    // プレイヤー情報エリアに追加
    const playerInfo = document.querySelector(".player-info") || document.body;
    playerInfo.appendChild(slash);
    playerInfo.appendChild(totalTimeElement);
  }

  // 要素が存在するか確認してからイベントリスナーを追加
  if (playButton)
    playButton.addEventListener("click", () => {
      if (audioPlayer) {
        audioPlayer.play();
        playButton.style.display = "none";
        pauseButton.style.display = "inline";
      }
    });

  if (pauseButton)
    pauseButton.addEventListener("click", () => {
      if (audioPlayer) {
        audioPlayer.pause();
        playButton.style.display = "inline";
        pauseButton.style.display = "none";
      }
    });

  if (prevButton)
    prevButton.addEventListener("click", () => {
      if (currentTrack > 0) {
        currentTrack--;
        playCurrentTrack();
      }
    });

  if (nextButton)
    nextButton.addEventListener("click", () => {
      if (currentTrack < playlist.length - 1) {
        currentTrack++;
        playCurrentTrack();
      }
    });

  // オーディオ要素の初期化部分を修正
  audioPlayer = new Audio();
  if (audioPlayer) {
    // イベントリスナーを一度クリアして再設定
    audioPlayer.removeEventListener("timeupdate", updateProgress);
    audioPlayer.addEventListener("timeupdate", function (e) {
      console.log("timeupdate イベント発火"); // デバッグ用
      updateProgress();
    });

    audioPlayer.addEventListener("loadedmetadata", () => {
      console.log("オーディオメタデータ読み込み完了:", audioPlayer.duration);
      // メタデータが読み込まれたら即座に表示を更新
      updateProgress();
    });

    audioPlayer.addEventListener("ended", () => {
      // 再生終了時の処理
      console.log("再生終了");
      // 次の曲を再生するなどの処理を追加可能
    });
  }
  // ボリュームコントロールの初期化
  const volumeControl = document.getElementById("volume");
  const volumeElement = document.getElementById("volumelabel");
  if (volumeControl) {
    audioPlayer.volume = volumeControl.value;

    volumeControl.addEventListener("input", (event) => {
      if (audioPlayer) {
        audioPlayer.volume = event.target.value;
        volumeElement.textContent = Math.round(event.target.value * 100);
        console.log(
          `音量を${Math.round(event.target.value * 100)}%に設定しました`
        );
      }
    });
  } else {
    console.log("ボリュームコントロールが見つかりません");
  }
}

// 時間の表示形式を変換
function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min.toString().padStart(2, "0")}:${sec
    .toString()
    .padStart(2, "0")}`;
}

//　時間の更新
function updateProgress() {
  console.log("updateProgress関数が呼び出されました");

  if (!audioPlayer) {
    console.log("audioPlayerが未定義です");
    return;
  }

  if (!progressBar) {
    console.log("progressBarが未定義です");
    return;
  }

  if (!currentTimeElement) {
    console.log("currentTimeElementが未定義です");
    return;
  }

  if (!totalTimeElement) {
    console.log("totalTimeElementが未定義です");
    return;
  }

  const currentTime = audioPlayer.currentTime || 0;
  const duration = audioPlayer.duration || 0;

  console.log(`再生時間: ${currentTime} / ${duration}`);

  // NaNや0の場合の処理
  if (isNaN(duration) || duration === 0) {
    progressBar.value = 0;
    currentTimeElement.textContent = "00:00";
    totalTimeElement.textContent = "00:00";
    return;
  }

  const percent = (currentTime / duration) * 100;

  // プログレスバーの更新
  progressBar.value = percent;

  // グラデーションフィルの幅を変更
  const progressFill = document.querySelector(".progress-fill");
  if (progressFill) {
    progressFill.style.width = `${percent}%`;
  }

  // 現在の時間とトータルの時間の更新
  currentTimeElement.textContent = formatTime(currentTime);
  totalTimeElement.textContent = formatTime(duration);
}

// DOMが読み込まれたらすぐに実行
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Content Loaded");
  try {
    initializePlayer();
  } catch (err) {
    console.error("Error during player initialization:", err);
  }

  // progressBar要素の再取得と確認 ここないと動かない！！！
  const progressBarElement = document.querySelector(".progressbar");

  if (!progressBarElement) {
    console.error("プログレスバーの要素が見つかりません！");
    return;
  }

  console.log("プログレスバー要素を発見しました:", progressBarElement);

  // クリックイベントを再設定
  progressBarElement.addEventListener("click", function (event) {
    console.log("プログレスバークリックを検出しました");

    if (!audioPlayer) {
      console.error("audioPlayerが初期化されていません");
      return;
    }

    if (isNaN(audioPlayer.duration) || audioPlayer.duration <= 0) {
      console.log("有効な再生時間がありません");
      return;
    }

    try {
      // クリック位置からパーセンテージを計算（改善版）
      const rect = this.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const position = Math.max(0, Math.min(1, clickX / rect.width));
      const newTime = position * audioPlayer.duration;

      console.log(
        `クリックによる位置変更: ${formatTime(newTime)} (位置: ${Math.round(
          position * 100
        )}%)`
      );

      // スライダー値を更新
      this.value = position * 100;

      // 再生位置を更新（待機状態を考慮）
      if (audioPlayer.readyState >= 2) {
        // 現在の再生状態を保存
        const wasPlaying = !audioPlayer.paused;
        if (wasPlaying) {
          audioPlayer.pause(); // 一時的に停止
        }

        // 再生位置を変更
        audioPlayer.currentTime = newTime;

        // 表示を更新
        currentTimeElement.textContent = formatTime(newTime);

        // 再生中だった場合は再開
        if (wasPlaying) {
          audioPlayer
            .play()
            .then(() => console.log("再生再開成功"))
            .catch((err) => console.error("再生再開エラー:", err));
        }

        // 強制的に表示を更新
        setTimeout(updateProgress, 50);
      } else {
        console.log("オーディオデータがまだ準備できていません");
      }
    } catch (err) {
      console.error("クリック位置変更エラー:", err);
    }
  });

  // 既存のイベントリスナーを置き換え、重複を避ける
  console.log("プログレスバーのイベントリスナーを設定しました");
});

// フォルダが開かれたときの処理
ipcRenderer.on("folder-opened", (event, filesPath) => {
  fileList.innerHTML = ""; // 既存のリストをクリア

  // 最初のフォルダをパス履歴と現在のパスに設定
  if (filesPath.length > 0) {
    // ファイルのパスが渡された場合はそのディレクトリを取得
    const directoryPath = path.dirname(filesPath[0]);
    currentPath = directoryPath;
    pathHistory.push(directoryPath);

    // ディレクトリの内容を表示
    const files = fs.readdirSync(directoryPath);
    files.forEach((file) => {
      const li = document.createElement("li");
      li.textContent = file;
      fileList.appendChild(li);
    });
  }
});

// ファイルをクリックしたときの処理を修正
fileList.addEventListener("click", async (event) => {
  const target = event.target;
  if (target.tagName === "LI") {
    const filePath = path.join(currentPath, target.textContent);
    try {
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        // フォルダの場合
        const files = fs.readdirSync(filePath);
        fileList.innerHTML = "";
        files.forEach((file) => {
          const li = document.createElement("li");
          li.textContent = file;
          fileList.appendChild(li);
        });
        currentPath = filePath;
        pathHistory.push(filePath);

        // 現在のパスを表示（オプション）
        console.log("現在のパス:", currentPath);
      } else {
        // ファイルの場合（音楽ファイルの処理）
        const ext = path.extname(filePath).toLowerCase();
        if ([".mp3", ".wav", ".ogg", ".flac", ".m4a"].includes(ext)) {
          console.log("音楽ファイルを再生:", filePath);

          // メインプロセスからメタデータを取得
          try {
            const metadata = await ipcRenderer.invoke(
              "load-metadata",
              filePath
            );
            console.log("Metadata from main process:", metadata);

            // UIを更新
            if (metadata) {
              titleElement.textContent = metadata.title;
              artistElement.textContent = metadata.artist;

              // 画像データがある場合のみ表示
              if (metadata.image) {
                console.log("Received image data type:", typeof metadata.image);
                console.log(
                  "Image data starts with:",
                  metadata.image.substring(0, 30)
                );

                // albumCoverElementの存在を確認
                if (!albumCoverElement) {
                  console.error("Album cover element not found!");
                  albumCoverElement = document.createElement("img");
                  albumCoverElement.className = "album-cover";
                  document
                    .querySelector(".player-info")
                    .appendChild(albumCoverElement);
                }

                // 画像のロードイベントを監視
                albumCoverElement.onload = () => {
                  console.log("Image loaded successfully!");
                  albumCoverElement.style.display = "block";
                };

                albumCoverElement.onerror = (err) => {
                  console.error("Failed to load image:", err);
                  // ローカルのデフォルト画像を試行
                  setDefaultCover();
                };

                // 画像URLを設定
                albumCoverElement.src = metadata.image;
              } else {
                setDefaultCover();
              }

              // 音楽ファイルを再生プレイリストに追加
              addToPlaylist(filePath, metadata, true);
            }
          } catch (error) {
            console.error("メタデータ取得エラー:", error);
          }
        } else {
          console.log("非対応のファイル形式です:", ext);
        }
      }
    } catch (err) {
      console.error("ファイルアクセスエラー:", err);
    }
  }
});

// 戻るボタンの実装
back.addEventListener("click", () => {
  if (pathHistory.length > 1) {
    // 現在のパスを履歴から削除
    pathHistory.pop();
    // 一つ前のパスを取得
    const previousPath = pathHistory[pathHistory.length - 1];
    currentPath = previousPath;

    // 前のディレクトリの内容を表示
    try {
      const files = fs.readdirSync(previousPath);
      fileList.innerHTML = "";
      files.forEach((file) => {
        const li = document.createElement("li");
        li.textContent = file;
        fileList.appendChild(li);
      });
    } catch (err) {
      console.error("戻る処理エラー:", err);
    }
  }
});

// プレイリストに追加する関数
function addToPlaylist(filePath, metadata, playNow = false) {
  // プレイリストに追加
  const newIndex =
    playlist.push({
      path: filePath,
      title: metadata.title,
      artist: metadata.artist,
      duration: metadata.duration,
    }) - 1;

  console.log("プレイリストに追加:", playlist[newIndex]);

  // 最初の曲なら自動再生（オプション）
  if (playNow || playlist.length === 1) {
    currentTrack = newIndex;
    playCurrentTrack();
  }

  console.log("プレイリスト更新:", playlist);
}

// 現在のトラックを再生する関数
function playCurrentTrack() {
  if (playlist.length === 0 || currentTrack >= playlist.length) {
    return;
  }

  const track = playlist[currentTrack];
  if (audioPlayer) {
    //いったん停止
    audioPlayer.pause();

    // イベントリスナーをクリアして再設定
    audioPlayer.removeEventListener("timeupdate", updateProgress);
    audioPlayer.addEventListener("timeupdate", function () {
      console.log("再生中: timeupdate イベント");
      updateProgress();
    });

    // オーディオ要素のソースを設定
    audioPlayer.src = track.path;

    // メタデータが読み込まれたら時間を更新
    audioPlayer.addEventListener(
      "loadedmetadata",
      () => {
        console.log(
          "トラックのメタデータが読み込まれました:",
          audioPlayer.duration
        );
        updateProgress();

        // 再生ボタン/一時停止ボタンの表示を更新
        playButton.style.display = "none";
        pauseButton.style.display = "inline";
      },
      { once: true }
    );

    // 再生
    audioPlayer.play();

    // UIを更新
    titleElement.textContent = track.title || "Unknown Title";
    artistElement.textContent = track.artist || "Unknown Artist";

    // プレイリストからメタデータをを取得して表示
    updateAlbumCover(track.path);
  }
}

// アルバムカバーを更新する関数
async function updateAlbumCover(filePath) {
  try {
    const metadata = await ipcRenderer.invoke("load-metadata", filePath);
    console.log("Updating album cover with metadata:", metadata);

    // 画像データの検証
    if (metadata && metadata.image) {
      console.log("画像データを受信しました");

      // まず、要素がimg要素であることを確認
      if (albumCoverElement.tagName !== "IMG") {
        // 既存の要素を削除して新しいimg要素を作成
        const parent = albumCoverElement.parentNode;
        albumCoverElement = document.createElement("img");
        albumCoverElement.className = "album-cover";
        parent.replaceChild(
          albumCoverElement,
          parent.querySelector(".album-cover")
        );
      }

      // テキストコンテンツをクリア
      albumCoverElement.textContent = "";

      // Base64データのチェックと処理
      try {
        if (typeof metadata.image === "string") {
          if (metadata.image.startsWith("data:image")) {
            // すでに完全なdata URLの場合はそのまま使用
            albumCoverElement.src = metadata.image;
          } else {
            // Base64文字列のみの場合は、適切なプレフィックスを追加
            albumCoverElement.src = `data:image/jpeg;base64,${metadata.image}`;
          }
        } else if (
          metadata.image instanceof Buffer ||
          Array.isArray(metadata.image)
        ) {
          // バッファや配列の場合は変換
          const base64Image = Buffer.from(metadata.image).toString("base64");
          albumCoverElement.src = `data:image/jpeg;base64,${base64Image}`;
        }

        // 画像スタイルを設定
        albumCoverElement.style.display = "block";
        albumCoverElement.style.backgroundColor = "transparent";
        albumCoverElement.ondragstart = (e) => e.preventDefault();

        console.log(
          "画像URLを設定しました:",
          albumCoverElement.src.substring(0, 50) + "..."
        );
      } catch (imgErr) {
        console.error("画像データ処理エラー:", imgErr);
        setDefaultCover();
      }

      // 画像の読み込みイベントを監視
      albumCoverElement.onload = () => {
        console.log("画像を正常に読み込みました");
      };
      albumCoverElement.onerror = (e) => {
        console.error("画像読み込みエラー:", e);
        setDefaultCover();
      };
    } else {
      console.log("画像データがありません");
      setDefaultCover();
    }
  } catch (error) {
    console.error("アルバムカバー更新エラー:", error);
    setDefaultCover();
  }
}

// デフォルト画像を表示する補助関数
function setDefaultCover() {
  try {
    if (!albumCoverElement) {
      albumCoverElement = document.createElement("img");
      albumCoverElement.className = "album-cover";
      document.querySelector(".player-info").appendChild(albumCoverElement);
    }

    // 内蔵デフォルト画像を直接Base64で指定
    albumCoverElement.src = "./assets/sample.png";
    albumCoverElement.style.display = "block";

    console.log("デフォルト画像（Base64形式）を設定しました");
  } catch (err) {
    console.error("デフォルト画像設定エラー:", err);
    // 最後の手段としてプレースホルダー表示
    if (albumCoverElement) {
      albumCoverElement.style.backgroundColor = "#444";
      albumCoverElement.textContent = "No Image";
      albumCoverElement.style.display = "flex";
      albumCoverElement.style.justifyContent = "center";
      albumCoverElement.style.alignItems = "center";
    }
  }
}

// イコライザー機能の実装 - グローバルスコープに公開
window.audioContext = null;
window.sourceNode = null;
window.filters = [];

// オーディオコンテキストの初期化関数
function initAudioContext() {
  if (!window.audioContext) {
    console.log("オーディオコンテキストの初期化を開始");
    window.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();

    // 各周波数帯域のフィルター作成
    const frequencies = [60, 150, 400, 1000, 2400, 6000, 15000];

    frequencies.forEach((frequency) => {
      const filter = window.audioContext.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = frequency;
      filter.Q.value = 1;
      filter.gain.value = 0;
      window.filters.push(filter);
      console.log(`フィルター作成: ${frequency}Hz`);
    });

    // フィルターを直列に接続
    for (let i = 0; i < window.filters.length - 1; i++) {
      window.filters[i].connect(window.filters[i + 1]);
    }

    // グローバル変数のaudioPlayerを使用（修正）
    if (!audioPlayer) {
      console.error("audioPlayer変数が見つかりません");
      return false;
    }

    // オーディオ要素をWeb Audio APIに接続
    window.sourceNode =
      window.audioContext.createMediaElementSource(audioPlayer);
    window.sourceNode.connect(window.filters[0]);
    window.filters[window.filters.length - 1].connect(
      window.audioContext.destination
    );

    console.log(`イコライザー初期化完了: ${window.filters.length}バンド`);
    return true;
  }
  return false;
}

// 再生開始時に一度だけ初期化
if (audioPlayer) {
  audioPlayer.addEventListener(
    "play",
    function () {
      const initialized = initAudioContext();
      if (initialized) {
        console.log("オーディオ処理チェーンを構築しました");
      }
    },
    { once: true }
  );
} else {
  console.error("audioPlayer変数が初期化されていません");
}

//スライドメニューの表示制御やEQメニューの表示制御
document.addEventListener("DOMContentLoaded", function () {
  // スライドメニューの表示（既存コード）
  const slideMenu = document.querySelector(".slideMenu");
  const shelf = document.querySelector(".shelf");
  const player = document.querySelector(".player");
  const applemusic = document.querySelector(".applemusic");
  const AMtab = document.querySelector(".AMtab");

  slideMenu.addEventListener("click", function () {
    const isVisible = shelf.classList.contains("visible");

    if (!isVisible) {
      // メニューを表示する場合
      shelf.classList.add("visible");
      player.classList.add("player-blur");
    } else {
      // メニューを非表示にする場合
      shelf.classList.remove("visible");
      player.classList.remove("player-blur");
    }
  });

  // 外側をクリックしたらメニューを閉じる（既存コード）
  document.addEventListener("click", function (e) {
    if (!shelf.contains(e.target) && !slideMenu.contains(e.target)) {
      shelf.classList.remove("visible");
      player.classList.remove("player-blur");
    }
  });

  // EQメニューの表示制御（新規追加）
  const eqButton = document.querySelector(".EQMenu");
  const eqPanel = document.querySelector(".eq-panel");

  eqButton.addEventListener("click", function (e) {
    e.stopPropagation(); // イベント伝播を停止
    const isVisible = eqPanel.classList.contains("visible");

    if (!isVisible) {
      eqPanel.classList.add("visible");
      player.classList.add("player-blur");
    } else {
      eqPanel.classList.remove("visible");
      player.classList.remove("player-blur");
    }
  });

  // EQパネルをクリックしても閉じないようにする
  eqPanel.addEventListener("click", function (e) {
    e.stopPropagation(); // イベント伝播を停止
  });

  // 外側クリックでEQパネルを閉じる
  document.addEventListener("click", function (e) {
    if (!eqPanel.contains(e.target) && !eqButton.contains(e.target)) {
      eqPanel.classList.remove("visible");
      // シェルフが表示されていなければブラーを解除
      if (!shelf.classList.contains("visible")) {
        player.classList.remove("player-blur");
      }
    }
  });

  // イコライザースライダーの値表示を更新
  const eqSliders = document.querySelectorAll(".eq-slider");
  eqSliders.forEach((slider) => {
    slider.addEventListener("input", function () {
      const valueDisplay = this.nextElementSibling;
      valueDisplay.textContent = `${this.value} dB`;
    });
  });

  // プリセット処理（基本実装）
  const presets = document.querySelectorAll(".eq-preset");
  presets.forEach((preset) => {
    preset.addEventListener("click", function () {
      const presetType = this.dataset.preset;

      // プリセット値の設定
      switch (presetType) {
        case "flat":
          setEqValues([0, 0, 0, 0, 0, 0, 0]);
          break;
        case "bass":
          setEqValues([8, 5, 2, 0, 0, 0, 0]);
          break;
        case "vocal":
          setEqValues([0, 0, 2, 5, 4, 2, 0]);
          break;
      }
    });
  });

  // プリセット適用関数
  function setEqValues(values) {
    eqSliders.forEach((slider, index) => {
      if (index < values.length) {
        // スライダーの値を更新
        slider.value = values[index];
        slider.nextElementSibling.textContent = `${values[index]} dB`;

        // 実際のイコライザーに値を適用（renderer.jsのフィルターを参照）
        if (window.filters && window.filters[index]) {
          window.filters[index].gain.value = values[index];
          console.log(`Preset: Band ${index} gain set to ${values[index]}`);
        }
      }
    });
  }

  // イコライザースライダーの値表示と音響効果を更新
  eqSliders.forEach((slider, index) => {
    slider.addEventListener("input", function () {
      // 表示値を更新
      const valueDisplay = this.nextElementSibling;
      valueDisplay.textContent = `${this.value} dB`;

      // フィルター値も更新
      if (window.filters && window.filters.length > 0) {
        // フィルター存在確認の診断表示を追加
        console.log(`使用可能なフィルター数: ${window.filters.length}`);

        if (index < window.filters.length) {
          // 周波数の参照を追加
          const frequencies = [60, 150, 400, 1000, 2400, 6000, 15000];
          window.filters[index].gain.value = parseFloat(this.value);
          console.log(
            `Band ${index}: ${frequencies[index]}Hz を ${this.value} dB に設定`
          );
        } else {
          console.log(`警告: フィルターインデックス ${index} が範囲外です`);
        }
      } else {
        console.log(
          `フィルター配列が未初期化か空です。長さ: ${
            window.filters ? window.filters.length : "undefined"
          }`
        );

        // 初期化を試みる
        if (audioPlayer && audioPlayer.src) {
          console.log("フィルターの自動初期化を試みます");
          const result = initAudioContext();
          console.log(`初期化結果: ${result ? "成功" : "失敗または既存"}`);
        }

        console.log("音声再生をして再試行してください");
      }
    });
  });

  //applemusicボタンを押したときの処理
  applemusic.addEventListener("click", function () {
    ipcRenderer.send("open-applemusic");
  });

  const progressContainer = document.querySelector(".progress-container");
  if (progressContainer) {
    progressContainer.addEventListener("click", function (event) {
      if (!audioPlayer) return;

      const rect = this.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const position = Math.max(0, Math.min(1, clickX / rect.width));

      if (!isNaN(audioPlayer.duration) && audioPlayer.duration > 0) {
        // クリック位置から再生位置を計算
        audioPlayer.currentTime = position * audioPlayer.duration;

        // フィルの幅を更新
        const progressFill = document.querySelector(".progress-fill");
        if (progressFill) {
          progressFill.style.width = `${position * 100}%`;
        }
      }
    });
  }
});

// プログレスバーのクリック直接処理（改善版）
progressBar.addEventListener("click", function (event) {
  if (!audioPlayer) {
    console.error("audioPlayerが初期化されていません");
    return;
  }

  if (isNaN(audioPlayer.duration) || audioPlayer.duration <= 0) {
    console.log("有効な再生時間がありません");
    return;
  }

  try {
    // クリック位置からパーセンテージを計算（改善版）
    const rect = this.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const position = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = position * audioPlayer.duration;

    console.log(
      `クリックによる位置変更: ${formatTime(newTime)} (位置: ${Math.round(
        position * 100
      )}%)`
    );

    // スライダー値を更新
    this.value = position * 100;

    // 再生位置を更新（待機状態を考慮）
    if (audioPlayer.readyState >= 2) {
      // HAVE_CURRENT_DATA以上
      audioPlayer.currentTime = newTime;

      // 表示を更新
      currentTimeElement.textContent = formatTime(newTime);

      // 強制的に表示を更新
      setTimeout(updateProgress, 50);
    } else {
      console.log(
        "オーディオデータがまだ準備できていません。再度お試しください"
      );
    }
  } catch (err) {
    console.error("クリック位置変更エラー:", err);
  }
});

// change イベントも同様に改善（オプション）
progressBar.addEventListener("change", function () {
  if (
    !audioPlayer ||
    isNaN(audioPlayer.duration) ||
    audioPlayer.duration <= 0
  ) {
    console.log("有効な再生時間がありません");
    return;
  }

  try {
    const position = this.value / 100;
    const newTime = position * audioPlayer.duration;
    console.log(
      `再生位置変更試行: ${formatTime(newTime)} (位置: ${Math.round(
        position * 100
      )}%)`
    );

    // 再生位置を更新（待機状態を考慮）
    if (audioPlayer.readyState >= 2) {
      audioPlayer.currentTime = newTime;

      // 再生状態を復元
      if (audioPlayer.dataset.wasPlaying === "true") {
        delete audioPlayer.dataset.wasPlaying;
        audioPlayer
          .play()
          .then(() => console.log("再生再開成功"))
          .catch((err) => console.error("再生再開エラー:", err));
      }

      // 表示を強制的に更新
      setTimeout(updateProgress, 50);
    } else {
      console.log("オーディオデータがまだ準備できていません");
    }
  } catch (err) {
    console.error("再生位置変更エラー:", err);
  }
});

//main側でのウィンドウサイズ変更を受け取る
ipcRenderer.on("open-AMtab", (event) => {
  const appContainer = document.querySelector(".body");
  const player = document.querySelector(".player");

  const containerWidth = appContainer.clientWidth;
  const halfWidth = containerWidth / 2;

  player.style.width = `${halfWidth}px`;
  player.style.height = "100%";

  AMtab.style.width = `${halfWidth}px`;
  AMtab.style.height = "100%";
  AMtab.style.zIndex = "100"; // 他の要素より前面に表示
});
