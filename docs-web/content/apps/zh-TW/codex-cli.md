# OpenAI Codex CLI

> **專案介紹**
>
> Codex CLI 是一個來自 OpenAI 的編碼代理，可在您的計算機上本地執行。
>
>   - 官方主頁：[https://chatgpt.com/codex](https://chatgpt.com/codex)
>   - 專案主頁：[https://github.com/openai/codex](https://github.com/openai/codex)

## 效果演示

![introduce-01.webp](/apps-assets/codex/introduce-01.webp)

### 特性

| **功能分類**   | **特性**                                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 終端式編碼助手 | Codex CLI 是一個基於終端的互動式編碼助理，用於在命令列中編輯程式碼、生成補丁並執行命令。                                       |
| 工具驅動架構   | 提供 `apply_patch`、`shell`、`update_plan`、`multi_tool_use` 等工具，用於對倉庫檔案和操作進行可控修改。                      |
| 原子補丁編輯   | 使用專門的補丁格式透過 `apply_patch` 原子地新增/更新/刪除檔案，便於審計與回滾。                                              |
| 沙箱與審批     | 支援沙箱策略（如 `workspace-write`、`read-only`）和審批模式（`on-request`、`on-failure`、`never`），控制寫入與網路訪問許可權。 |
| 計劃追蹤       | `update_plan` 用於列出步驟並跟蹤狀態，要求始終只有一個 `in_progress` 步驟以保持明確進度。                                    |
| 互動規範       | 在重要操作前傳送簡短前導說明，保持語氣友好、簡潔並提供進度更新。                                                             |
| 安全約束       | 遵循嚴格規則（不隨意更改無關檔案、不新增版權頭、不執行破壞性命令），需要使用者批准敏感操作。                                   |
| 測試與格式化   | 推薦在修改後執行相關測試與格式化工具，但不負責修復與當前任務無關的問題。                                                     |
| 輸出與風格     | 最終輸出遵循 CLI 渲染規範（例如 `**` 標題、反引號表示路徑/命令），保持可掃描的簡潔結構。                                     |
| 並行執行       | 支援透過 `multi_tool_use.parallel` 並行執行多個工具以提升效率。                                                              |

## AI 模型配置方法

### Windows 端圖文指引

#### 1.開啟終端

![windows_open_terminal](/apps-assets/codex/windows_open_terminal.webp)

#### 2.安裝 WSL

為在 Windows 上獲得最佳效能，請安裝並使用 Windows Subsystem for Linux (WSL2)。

> **安裝 WSL2，重啟 Windows 計算機**
>
> ```powershell
>   wsl --install
>   ```
>
>   安裝完成後重啟 Windows 計算機。

> **Windows 注意事項**
>
> - 建議使用 PowerShell 而不是 CMD
>   - 如果遇到許可權問題，嘗試以管理員身份執行
>   - 某些防毒軟體可能會誤報，需要新增白名單

![windows-img-03.webp](/apps-assets/codex/windows-img-03.webp)

> **下載 Node Version Manager (NVM)**
>
> ```bash
>   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
>   ```

![windows-img-04.webp](/apps-assets/codex/windows-img-04.webp)

> **NVM 安裝 Node.js 22**
>
> 標籤欄新開一個 PowerShell 視窗，開啟 WSL：
>
>   ```bash
>   wsl
>   ```
>
>   安裝 Node.js（版本號有時效性，請根據 [OpenAI 官網](https://developers.openai.com/codex/windows) 要求安裝對應版本）：
>
>   ```bash
>   nvm install 22
>   ```

![windows-img-05.webp](/apps-assets/codex/windows-img-05.webp)

#### 3.安裝 Codex CLI

> **安裝 Codex CLI**
>
> ```bash
>   npm i -g @openai/codex
>   ```
>
>   這個命令會從 npm 官方倉庫下載並安裝最新版本的 Codex CLI。

![windows-img-06.webp](/apps-assets/codex/windows-img-06.webp)

#### 4.修改配置檔案

> **一鍵修改 Codex CLI 配置檔案**
>
> ```powershell
>   iex (irm 'https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/codex-cli-setup.ps1')
>   ```

![windows-configure](/apps-assets/codex/windows_configure.webp)

#### 5.開始使用 Codex CLI

現在你可以開始使用 Codex CLI 了！

> **啟動 Codex CLI**
>
> 啟動 WSL2：
>
>   ```bash
>   wsl
>   ```
>
>   直接啟動 Codex CLI：
>
>   ```bash
>   codex
>   ```
>
>   在特定專案中使用：
>
>   ```bash
>   cd mnt/c/path/to/your/project
>   codex
>   ```
>
>   按 Enter 啟動 Codex CLI。

![windows-img-09.webp](/apps-assets/codex/windows-img-09.webp)

![windows-img-10.webp](/apps-assets/codex/windows-img-10.webp)

> 設定 Codex CLI 的許可權：1. 允許 Codex 直接修改檔案；2. Codex 修改檔案需要手動授權

> **選擇模型**
>
> ```bash
>   /model
>   ```

![windows-img-11.webp](/apps-assets/codex/windows-img-11.webp)

![windows-img-12.webp](/apps-assets/codex/windows-img-12.webp)

![windows-img-13.webp](/apps-assets/codex/windows-img-13.webp)

![windows-img-14.webp](/apps-assets/codex/windows-img-14.webp)

> 注意：修改介面地址後，使用所有模型（包括官方預設模型）均呼叫您配置的、合法授權的自有或組織接入點。請使用您自己部署的 優特，或確認服務方具備合法上游授權和合規義務的 優特服務。不要將來源不明的 API 地址或金鑰接入生產環境。

### macOS 端圖文指引

#### 1.安裝 Homebrew (已安裝請跳過)

Homebrew 是 macOS 缺失的軟體包的管理器。

官網：https://brew.sh

![macos-img-01.webp](/apps-assets/codex/macos-img-01.webp)

> **安裝 Homebrew**
>
> ```bash
>   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
>   ```

![macos-img-02.webp](/apps-assets/codex/macos-img-02.webp)

![macos-img-03.webp](/apps-assets/codex/macos-img-03.webp)

![macos-img-04.webp](/apps-assets/codex/macos-img-04.webp)

#### 2.安裝 Node.js 環境

> **Node.js 環境安裝步驟**
>
> 更新 Homebrew：
>
>   ```bash
>   brew update
>   ```
>
>   安裝 Node.js：
>
>   ```bash
>   brew install node
>   ```

> **macOS 注意事項**
>
> - 如果遇到許可權問題，可能需要使用 `sudo`
>   - 首次執行可能需要在系統偏好設定中允許
>   - 建議使用 Terminal 或 iTerm2

![macos-img-05.webp](/apps-assets/codex/macos-img-05.webp)

![macos-img-06.webp](/apps-assets/codex/macos-img-06.webp)

> **驗證安裝是否成功**
>
> 安裝完成後，開啟終端，輸入以下命令：
>
>   ```bash
>   node --version
>   npm --version
>   ```
>
>   如果顯示版本號，說明安裝成功。

#### 3.安裝 Codex CLI

> **安裝 Codex CLI**
>
> 開啟終端，執行以下命令：
>
>   ```bash
>   # 全域性安裝 Codex CLI
>   npm install -g @openai/codex
>   ```
>
>   如果遇到許可權問題，可以使用 sudo：
>
>   ```bash
>   sudo npm install -g @openai/codex
>   ```

![macos-img-07.webp](/apps-assets/codex/macos-img-07.webp)

> **驗證 Codex CLI 安裝**
>
> 安裝完成後，輸入以下命令檢查是否安裝成功：
>
>   ```bash
>   codex --version
>   ```
>
>   如果顯示版本號，恭喜你！Codex CLI 已經成功安裝了。

#### 4.修改配置檔案

> **一鍵修改 Codex CLI 配置檔案**
>
> ```bash
>   curl -fsSL https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/codex-cli-setup.sh | bash
>   ```

![macos-configure](/apps-assets/codex/macos_configure.webp)

#### 5.開始使用 Codex CLI

現在你可以開始使用 Codex CLI 了！

> **啟動 Codex CLI**
>
> 直接啟動 Codex CLI：
>
>   ```bash
>   codex
>   ```
>
>   在特定專案中使用：
>
>   ```bash
>   cd /path/to/your/project
>   codex
>   ```
>
>   按 Enter 啟動 Codex CLI。

![macos-img-09.webp](/apps-assets/codex/macos-img-09.webp)

![macos-img-10.webp](/apps-assets/codex/macos-img-10.webp)

> 設定 Codex CLI 的許可權：1. 允許 Codex 直接修改檔案；2. Codex 修改檔案需要手動授權

![macos-img-11.webp](/apps-assets/codex/macos-img-11.webp)

![macos-img-12.webp](/apps-assets/codex/macos-img-12.webp)

![macos-img-13.webp](/apps-assets/codex/macos-img-13.webp)

![macos-img-14.webp](/apps-assets/codex/macos-img-14.webp)

> 注意：修改介面地址後，使用所有模型（包括官方預設模型）均呼叫您配置的、合法授權的自有或組織接入點。

#### 6.macOS 常見問題解決

> **安裝時提示許可權錯誤**
>
> 嘗試以下解決方法：
>
>   - 使用 `sudo` 安裝：`sudo npm install -g @openai/codex`
>   - 或者配置 `npm` 使用使用者目錄：`npm config set prefix ~/.npm-global`

> **macOS 安全設定阻止執行**
>
> 如果系統阻止執行 Codex CLI：
>
>   - 開啟"系統偏好設定" → "安全性與隱私"
>   - 點選"仍要開啟"或"允許"
>   - 或者在 Terminal 中執行：`sudo spctl --master-disable`

### Linux 端圖文指引

#### 1.安裝 Node.js 環境

Codex CLI 需要 Node.js 環境才能執行。

> **Node.js 環境安裝步驟**
>
> 新增 NodeSource 倉庫：
>
>   ```bash
>   sudo curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
>   ```
>
>   安裝 Node.js：
>
>   ```bash
>   sudo apt-get install -y nodejs
>   ```

> **Linux 注意事項**
>
> - 某些發行版可能需要安裝額外的依賴
>   - 如果遇到許可權問題，使用 sudo
>   - 確保你的使用者在 npm 的全域性目錄有寫許可權

![linux-img-01.webp](/apps-assets/codex/linux-img-01.webp)

![linux-img-02.webp](/apps-assets/codex/linux-img-02.webp)

> **驗證安裝是否成功**
>
> 安裝完成後，開啟終端，輸入以下命令：
>
>   ```bash
>   node --version
>   npm --version
>   ```
>
>   如果顯示版本號，說明安裝成功。

#### 2.安裝 Codex CLI

> **安裝 Codex CLI**
>
> 開啟終端，執行以下命令：
>
>   ```bash
>   # 全域性安裝 Codex CLI
>   npm install -g @openai/codex
>   ```
>
>   如果遇到許可權問題，可以使用 sudo：
>
>   ```bash
>   sudo npm install -g @openai/codex
>   ```

![linux-img-03.webp](/apps-assets/codex/linux-img-03.webp)

> **驗證 Codex CLI 安裝**
>
> 安裝完成後，輸入以下命令檢查是否安裝成功：
>
>   ```bash
>   codex --version
>   ```
>
>   如果顯示版本號，恭喜你！Codex CLI 已經成功安裝了。

#### 3.修改配置檔案

> **一鍵修改 Codex CLI 配置檔案**
>
> ```bash
>   curl -fsSL https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/codex-cli-setup.sh | bash
>   ```

![macos-configure](/apps-assets/codex/macos_configure.webp)

#### 4.開始使用 Codex CLI

現在你可以開始使用 Codex CLI 了！

> **啟動 Codex CLI**
>
> 直接啟動 Codex CLI：
>
>   ```bash
>   codex
>   ```
>
>   在特定專案中使用：
>
>   ```bash
>   # 進入你的專案目錄
>   cd /path/to/your/project
>
>   # 啟動 Codex CLI
>   codex
>   ```
>
>   按 Enter 啟動 Codex CLI。

![linux-img-05.webp](/apps-assets/codex/linux-img-05.webp)

![linux-img-06.webp](/apps-assets/codex/linux-img-06.webp)

> 設定 Codex CLI 的許可權：1. 允許 Codex 直接修改檔案；2. Codex 修改檔案需要手動授權

![linux-img-07.webp](/apps-assets/codex/linux-img-07.webp)

![linux-img-08.webp](/apps-assets/codex/linux-img-08.webp)

![linux-img-09.webp](/apps-assets/codex/linux-img-09.webp)

![linux-img-10.webp](/apps-assets/codex/linux-img-10.webp)

> 注意：修改介面地址後，使用所有模型（包括官方預設模型）均呼叫您配置的、合法授權的自有或組織接入點。

#### 5.Linux 常見問題解決

> **安裝時提示許可權錯誤**
>
> 嘗試以下解決方法：
>
>   - 使用 `sudo` 安裝：`sudo npm install -g @openai/codex`
>   - 或者配置 `npm` 使用使用者目錄：`npm config set prefix ~/.npm-global`
>   - 然後新增到 PATH：`export PATH=~/.npm-global/bin:$PATH`

> **缺少依賴庫**
>
> 某些 Linux 發行版需要安裝額外依賴：
>
>   ```bash
>   # Ubuntu/Debian
>   sudo apt install build-essential
>
>   # CentOS/RHEL
>   sudo dnf groupinstall "Development Tools"
>   ```
