document.addEventListener("DOMContentLoaded", () => {
  // Cookieの読み書き関数
  function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(
      value
    )}; expires=${expires}; path=/`;
  }

  function getCookie(name) {
    return document.cookie.split("; ").reduce((r, v) => {
      const parts = v.split("=");
      return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, "");
  }

  // Aceエディタ初期化
  var editor = ace.edit("editor");
  editor.setTheme(getCookie("aceTheme") || "ace/theme/monokai"); // テーマをCookieから取得
  editor.session.setMode("ace/mode/javascript");
  editor.session.setTabSize(Number(getCookie("indentSize")) || 2); // インデント幅をCookieから取得
  editor.session.setUseSoftTabs(true);
  editor.setFontSize(getCookie("fontSize") || "14px");
  const body = document.body;
  // ダークモードの切り替えボタンイベント
  const toggleButton = document.getElementById("toggle-theme");
  toggleButton.addEventListener("click", () => {
    const toggleButton = document.getElementById("toggle-theme");

    // 現在の状態を切り替える
    if (body.classList.contains("dark-mode")) {
      body.classList.remove("dark-mode");
      body.classList.add("light-mode");
      toggleButton.textContent = "🌙";
      setCookie("darkMode", "false", 30); // ダークモードを無効に設定
    } else {
      body.classList.remove("light-mode");
      body.classList.add("dark-mode");
      toggleButton.textContent = "☀️";
      setCookie("darkMode", "true", 30); // ダークモードを有効に設定
    }
  });
  const tabBar = document.getElementById("tabBar");
  let tabs = [];
  const tabsContainer = document.getElementById("tabsContainer");
  const addTabButton = document.getElementById("addTabButton");
  let draggedTabId;
  let currentTabIndex;

  function createTab(fileName = "新しいファイル") {
    const tabId = `tab-${tabs.length}`;
    const tabButton = document.createElement("button");
    tabButton.textContent = fileName;
    tabButton.className = "tab-button";
    tabButton.dataset.tabId = tabId;
    tabButton.draggable = true;
    tabButton.classList.add("tabBarButton");

    // タブ切り替え処理
    tabButton.addEventListener("click", () => switchTab(tabId));

    // ドラッグ＆ドロップイベント
    tabButton.addEventListener("dragstart", (e) => {
      draggedTabId = tabId;
      e.dataTransfer.effectAllowed = "move";
    });
    tabButton.addEventListener("dragover", (e) => e.preventDefault());
    tabButton.addEventListener("drop", (e) => {
      e.preventDefault();
      const targetTabId = e.target.closest("button").dataset.tabId;
      if (draggedTabId && draggedTabId !== targetTabId) {
        reorderTabs(draggedTabId, targetTabId);
      }
      draggedTabId = null;
    });

    // タブ削除ボタン
    const closeButton = document.createElement("span");
    closeButton.textContent = "✕";
    closeButton.style.cursor = "pointer";
    closeButton.style.marginLeft = "5px";
    closeButton.addEventListener("click", (e) => {
      e.stopPropagation();
      removeTab(tabId);
    });

    tabButton.appendChild(closeButton);
    tabsContainer.appendChild(tabButton);

    // タブデータを保存
    tabs.push({
      id: tabId,
      name: fileName,
      content: "",
      mode: "text",
      saved: true,
    });
    editor.setReadOnly(false);
    switchTab(tabId);

    // ファイル名入力フィールドにフォーカス
    const fileNameInput = document.getElementById("fileName");
    if (fileNameInput) {
      fileNameInput.focus();
    }
  }

  function renderTabs() {
    tabsContainer.innerHTML = ""; // タブだけをクリア
    tabs.forEach((tab) => {
      const tabButton = document.createElement("button");
      tabButton.textContent = tab.name;
      tabButton.className = "tab-button";
      tabButton.dataset.tabId = tab.id;
      tabButton.draggable = true;

      // タブ切り替え
      tabButton.addEventListener("click", () => switchTab(tab.id));

      // ドラッグ＆ドロップイベント
      tabButton.addEventListener("dragstart", (e) => {
        draggedTabId = tab.id;
        e.dataTransfer.effectAllowed = "move";
      });
      tabButton.addEventListener("dragover", (e) => e.preventDefault());
      tabButton.addEventListener("drop", (e) => {
        e.preventDefault();
        const targetTabId = e.target.closest("button").dataset.tabId;
        if (draggedTabId && draggedTabId !== targetTabId) {
          reorderTabs(draggedTabId, targetTabId);
        }
        draggedTabId = null;
      });

      // タブ削除ボタン
      const closeButton = document.createElement("span");
      closeButton.textContent = "✕";
      closeButton.style.cursor = "pointer";
      closeButton.style.marginLeft = "5px";
      closeButton.addEventListener("click", (e) => {
        e.stopPropagation();
        removeTab(tab.id);
      });

      tabButton.appendChild(closeButton);
      tabsContainer.appendChild(tabButton);
    });

    // 現在のタブを再ハイライト
    if (tabs[currentTabIndex]) {
      highlightActiveTab(tabs[currentTabIndex].id);
    }
  }
  // タブ切り替え関数
  function switchTab(tabId) {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      currentTabIndex = tabs.indexOf(tab);
      editor.setValue(tab.content || "");
      editor.session.setMode(`ace/mode/${tab.mode}`);
      document.getElementById("fileName").value = tab.name; // ファイル名を入力欄に表示
      updateTabTitles(); // タイトル更新
      highlightActiveTab(tabId); // 現在のタブを目立たせる
    }
  }

  // タブ削除関数（保存されていないタブの削除確認）
  function removeTab(tabId) {
    const index = tabs.findIndex((t) => t.id === tabId);
    if (index !== -1) {
      const tab = tabs[index];
      if (!tab.saved) {
        // 保存されていない場合、警告を表示
        const confirmDelete = confirm(
          `"${tab.name}"は保存されていません。このタブを閉じるとデータが消去されます。よろしいでしょうか？`
        );
        if (!confirmDelete) {
          return; // ユーザーがキャンセルした場合、削除を中止
        }
      }

      // タブを削除
      tabs.splice(index, 1);
      document.querySelector(`[data-tab-id="${tabId}"]`).remove();

      // タブがゼロになった場合、エディタを読み取り専用に
      if (tabs.length === 0) {
        editor.setValue(""); // エディタを空に
        editor.setReadOnly(true); // 読み取り専用モードに切り替え
        document.getElementById("fileName").value = ""; // ファイル名をクリア
      } else {
        // 別のタブをアクティブにする
        switchTab(tabs[0].id); // 最初のタブに切り替え
      }
    }
  }

  // エディターの内容をタブに保存し、保存状態を管理
  editor.session.on("change", () => {
    if (tabs[currentTabIndex]) {
      const tab = tabs[currentTabIndex];
      const currentContent = editor.getValue();
      tab.saved = tab.content === currentContent; // 保存状態を比較
      tab.content = currentContent;
      updateTabTitles(); // タブタイトル更新
    }
  });
  // タブの並び替え
  function reorderTabs(draggedTabId, targetTabId) {
    const draggedTabIndex = tabs.findIndex((tab) => tab.id === draggedTabId);
    const targetTabIndex = tabs.findIndex((tab) => tab.id === targetTabId);

    if (draggedTabIndex !== -1 && targetTabIndex !== -1) {
      const [draggedTab] = tabs.splice(draggedTabIndex, 1); // 引っ張られたタブを取り出す
      tabs.splice(targetTabIndex, 0, draggedTab); // 目標位置に挿入

      // 並び替え後にcurrentTabIndexを更新
      if (currentTabIndex === draggedTabIndex) {
        currentTabIndex = targetTabIndex; // ドラッグしたタブが現在タブなら、targetTabIndexに更新
      } else if (currentTabIndex === targetTabIndex) {
        currentTabIndex = draggedTabIndex; // 目標位置にあったタブが現在タブなら、draggedTabIndexに更新
      }

      renderTabs(); // タブの再描画
    }
  }

  // タブタイトルを更新
  function updateTabTitles() {
    tabs.forEach((tab) => {
      const tabButton = document.querySelector(`[data-tab-id="${tab.id}"]`);
      if (tabButton) {
        tabButton.firstChild.textContent = `${tab.saved ? "" : "*"}${tab.name}`;
      }
    });
  }

  // 現在のタブを目立たせる
  function highlightActiveTab(activeTabId) {
    document.querySelectorAll(".tab-button").forEach((button) => {
      if (button.dataset.tabId === activeTabId) {
        button.style.backgroundColor = "#00CCFF"; // アクティブタブの背景色
        button.style.color = "#000"; // アクティブタブの文字色
      } else {
        button.style.backgroundColor = ""; // 非アクティブタブの背景色
        button.style.color = ""; // 非アクティブタブの文字色
      }
    });
  }

  // ファイル名を変更
  document.getElementById("fileName").addEventListener("input", (e) => {
    if (tabs[currentTabIndex]) {
      const tab = tabs[currentTabIndex];
      tab.name = e.target.value;
      updateTabTitles(); // タイトル更新
    }
  });

  // 新しいタブ追加ボタン
  document
    .getElementById("addTabButton")
    .addEventListener("click", () => createTab());

  // 初期タブ
  createTab("新しいファイル");
  // ページロード時のダークモード初期化
  document.addEventListener("DOMContentLoaded", () => {
    const body = document.body;
    const toggleButton = document.getElementById("toggle-theme");

    if (getCookie("darkMode") === "true") {
      body.classList.add("dark-mode");
      toggleButton.textContent = "☀️";
      editor.setTheme("ace/theme/twilight");
    } else {
      body.classList.add("light-mode");
      toggleButton.textContent = "🌙";
      editor.setTheme(getCookie("aceTheme") || "ace/theme/monokai");
    }
  });

  // 言語と拡張子のマッピング
  const languageMap = {
    text: { mode: "ace/mode/text", extension: ".txt" },
    csv: { mode: "ace/mode/text", extension: ".csv" },
    json: { mode: "ace/mode/json", extension: ".json" },
    bash: { mode: "ace/mode/sh", extension: ".sh" },
    zsh: { mode: "ace/mode/sh", extension: ".zsh" },
    sql: { mode: "ace/mode/sql", extension: ".sql" },
    javascript: { mode: "ace/mode/javascript", extension: ".js" },
    python: { mode: "ace/mode/python", extension: ".py" },
    kotlin: { mode: "ace/mode/kotlin", extension: ".kt" },
    html: { mode: "ace/mode/html", extension: ".html" },
    markdown: { mode: "ace/mode/markdown", extension: ".md" },
    abap: { mode: "ace/mode/abap", extension: ".abap" },
    abc: { mode: "ace/mode/abc", extension: ".abc" },
    actionscript: { mode: "ace/mode/actionscript", extension: ".as" },
    ada: { mode: "ace/mode/ada", extension: ".ada" },
    apache_conf: { mode: "ace/mode/apache_conf", extension: ".conf" },
    apex: { mode: "ace/mode/apex", extension: ".cls" },
    asciidoc: { mode: "ace/mode/asciidoc", extension: ".adoc" },
    assembly_x86: { mode: "ace/mode/assembly_x86", extension: ".asm" },
    autohotkey: { mode: "ace/mode/autohotkey", extension: ".ahk" },
    batchfile: { mode: "ace/mode/batchfile", extension: ".bat" },
    c_cpp: { mode: "ace/mode/c_cpp", extension: ".c" },
    csharp: { mode: "ace/mode/csharp", extension: ".cs" },
    clojure: { mode: "ace/mode/clojure", extension: ".clj" },
    cobol: { mode: "ace/mode/cobol", extension: ".cob" },
    coffeescript: { mode: "ace/mode/coffee", extension: ".coffee" },
    coldfusion: { mode: "ace/mode/coldfusion", extension: ".cfm" },
    crystal: { mode: "ace/mode/crystal", extension: ".cr" },
    css: { mode: "ace/mode/css", extension: ".css" },
    dart: { mode: "ace/mode/dart", extension: ".dart" },
    diff: { mode: "ace/mode/diff", extension: ".diff" },
    django: { mode: "ace/mode/django", extension: ".html" },
    dockerfile: { mode: "ace/mode/dockerfile", extension: ".dockerfile" },
    dot: { mode: "ace/mode/dot", extension: ".dot" },
    elixir: { mode: "ace/mode/elixir", extension: ".ex" },
    elm: { mode: "ace/mode/elm", extension: ".elm" },
    erlang: { mode: "ace/mode/erlang", extension: ".erl" },
    fortran: { mode: "ace/mode/fortran", extension: ".f90" },
    go: { mode: "ace/mode/golang", extension: ".go" },
    graphqlschema: { mode: "ace/mode/graphqlschema", extension: ".graphql" },
    groovy: { mode: "ace/mode/groovy", extension: ".groovy" },
    haskell: { mode: "ace/mode/haskell", extension: ".hs" },
    handlebars: { mode: "ace/mode/handlebars", extension: ".hbs" },
    haxe: { mode: "ace/mode/haxe", extension: ".hx" },
    ini: { mode: "ace/mode/ini", extension: ".ini" },
    java: { mode: "ace/mode/java", extension: ".java" },
    jsp: { mode: "ace/mode/jsp", extension: ".jsp" },
    jsx: { mode: "ace/mode/jsx", extension: ".jsx" },
    latex: { mode: "ace/mode/latex", extension: ".tex" },
    less: { mode: "ace/mode/less", extension: ".less" },
    lua: { mode: "ace/mode/lua", extension: ".lua" },
    makefile: { mode: "ace/mode/makefile", extension: ".mk" },
    matlab: { mode: "ace/mode/matlab", extension: ".m" },
    objectivec: { mode: "ace/mode/objectivec", extension: ".m" },
    perl: { mode: "ace/mode/perl", extension: ".pl" },
    php: { mode: "ace/mode/php", extension: ".php" },
    ruby: { mode: "ace/mode/ruby", extension: ".rb" },
    rust: { mode: "ace/mode/rust", extension: ".rs" },
    sass: { mode: "ace/mode/sass", extension: ".sass" },
    scala: { mode: "ace/mode/scala", extension: ".scala" },
    scss: { mode: "ace/mode/scss", extension: ".scss" },
    shell: { mode: "ace/mode/sh", extension: ".sh" },
    sql: { mode: "ace/mode/sql", extension: ".sql" },
    swift: { mode: "ace/mode/swift", extension: ".swift" },
    typescript: { mode: "ace/mode/typescript", extension: ".ts" },
    xml: { mode: "ace/mode/xml", extension: ".xml" },
    yaml: { mode: "ace/mode/yaml", extension: ".yaml" },
  };
  // 言語選択リストの変更イベント
  document
    .getElementById("languageSelector")
    .addEventListener("change", function () {
      const selectedLanguage = this.value;
      const { mode, extension } = languageMap[selectedLanguage] || {};
      if (mode) {
        editor.session.setMode(mode);
        document.getElementById("fileExtension").textContent = extension;
      }
    });

  // 保存ボタンのクリックイベント
  document.getElementById("saveButton").addEventListener("click", function () {
    const content = editor.getValue();
    const selectedLanguage = document.getElementById("languageSelector").value;
    const filename = document.getElementById("fileName").value;
    const { extension } = languageMap[selectedLanguage] || {
      extension: ".txt",
    };

    const blob = new Blob([content], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename + extension;
    link.click();
  });

  // 設定パネル初期化
  document.getElementById("themeSelector").value =
    getCookie("aceTheme") || "ace/theme/monokai"; // テーマセレクタ初期値
  document.getElementById("indentSize").value = getCookie("indentSize") || 2; // インデント幅初期値
  document.getElementById("fontSizeInput").value =
    getCookie("fontSize") || "14"; // フォントサイズ初期値

  if (getCookie("darkMode") === "true") {
    body.classList.add("dark-mode");
    toggleButton.textContent = "☀️";
    editor.setTheme(getCookie("aceTheme") || "ace/theme/twilight");
  } else {
    body.classList.add("light-mode");
    toggleButton.textContent = "🌙";
  }
  // 設定パネルの変更イベント
  document
    .getElementById("themeSelector")
    .addEventListener("change", function () {
      const selectedTheme = this.value;
      editor.setTheme(selectedTheme);
      setCookie("aceTheme", selectedTheme, 30);
    });

  document.getElementById("indentSize").addEventListener("input", function () {
    const indentSize = this.value;
    editor.session.setTabSize(Number(indentSize));
    editor.session.setUseSoftTabs(true);
    setCookie("indentSize", indentSize, 30);
  });

  document
    .getElementById("fontSizeInput")
    .addEventListener("input", function () {
      const selectedFontSize = this.value;
      editor.setFontSize(`${selectedFontSize}px`);
      setCookie("fontSize", selectedFontSize, 30);
    });
  // 設定パネルの表示・非表示ボタン
  document
    .getElementById("settings-button")
    .addEventListener("click", function () {
      const settingsPanel = document.getElementById("settings-panel");
      if (
        settingsPanel.style.display === "none" ||
        !settingsPanel.style.display
      ) {
        settingsPanel.style.display = "block"; // 表示
      } else {
        settingsPanel.style.display = "none"; // 非表示
      }
    });
  document
    .getElementById("close-settings")
    .addEventListener("click", function () {
      const settingsPanel = document.getElementById("settings-panel");
      settingsPanel.style.display = "none"; // 非表示
    });
  // 設定パネルのドラッグ機能
  const settingsHeader = document.getElementById("settings-header");
  const settingsPanel = document.getElementById("settings-panel");
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  settingsHeader.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - settingsPanel.offsetLeft;
    offsetY = e.clientY - settingsPanel.offsetTop;
    settingsPanel.style.transition = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      settingsPanel.style.left = `${e.clientX - offsetX}px`;
      settingsPanel.style.top = `${e.clientY - offsetY}px`;
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    settingsPanel.style.transition = "left 0.3s, top 0.3s";
  });

  // 📂ボタンを押したときにファイル選択ダイアログを表示
  document.getElementById("openFileButton").addEventListener("click", () => {
    document.getElementById("fileInput").click(); // ファイル選択ダイアログを表示
  });

  document.getElementById("fileInput").addEventListener("change", (event) => {
    const file = event.target.files[0]; // 選択されたファイル
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        // 新しいタブを作成して、そのタブにファイル内容をセット
        createTab(file.name.split(".").slice(0, -1).join(".")); // 新しいタブにファイル名を設定
        const newTab = tabs[tabs.length - 1]; // 作成したばかりのタブを取得
        newTab.content = e.target.result; // ファイル内容を新しいタブに保存
        editor.setValue(newTab.content, -1); // エディタに内容をセット

        // ファイル名と拡張子をUIに反映
        document.getElementById("fileName").value = newTab.name; // ファイル名を入力欄に設定
        const fileExtension = file.name.split(".").pop().toLowerCase();
        document.getElementById(
          "fileExtension"
        ).textContent = `.${fileExtension}`;

        // 言語に対応する拡張子を取得
        const language = Object.keys(languageMap).find(
          (key) => languageMap[key].extension === `.${fileExtension}`
        );

        // 言語に応じたモードを設定
        if (language) {
          document.getElementById("languageSelector").value = language;
          editor.session.setMode(languageMap[language].mode);
        }
      };
      reader.readAsText(file); // ファイル内容をテキストとして読み込む
    }
  });
  // ボタンとコンテンツを取得
  const toggleBtn = document.getElementById("toggle-btn");
  const content = document.getElementById("header");

  // ボタンクリック時の処理を定義
  toggleBtn.addEventListener("click", function () {
    if (content.style.display == "none") {
      content.style.display = "inline"; // コンテンツ表示
      toggleBtn.textContent = "◀︎"; // ボタンのテキスト変更
    } else {
      content.style.display = "none"; // コンテンツ非表示
      toggleBtn.textContent = "▶︎"; // ボタンのテキスト変更
    }
  }); // ページ離脱時の警告メッセージ
  window.addEventListener("beforeunload", (event) => {
    const unsavedChanges = tabs.some((tab) => !tab.saved); // 未保存のタブがあるか確認
    if (unsavedChanges) {
      event.preventDefault();
      event.returnValue = ""; // 必須（ブラウザが警告を表示するトリガー）
    }
  });
});
