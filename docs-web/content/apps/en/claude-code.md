# Claude Code

> **Project Introduction**
>
> Unleash Claude's raw power directly in your terminal. Search million-line codebases instantly. Turn hours-long workflows into a single command. Your tools. Your workflow. Your codebase, evolving at thought speed.
>
>   - Official Homepage: [https://www.anthropic.com/claude-code](https://www.anthropic.com/claude-code)

## Demo

![introduce-01.webp](/apps-assets/claude_code/introduce-01.webp)

![introduce-02.webp](/apps-assets/claude_code/introduce-02.webp)

### Features

| **Category**                       | **Feature**                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Code Understanding**             | Deep codebase analysis, utilizing intelligent agents to search and understand project structure and dependencies |
|                                    | Automatically generates high-level code overviews, quickly helping users understand the codebase                 |
| **Code Editing**                   | Supports multi-file collaborative editing, suitable for complex code modifications                               |
|                                    | Provides practical and usable code suggestions that align with project patterns and architecture                 |
| **Integration Capabilities**       | Supports direct execution in the terminal, eliminating context switching                                         |
|                                    | Seamless integration with VS Code and JetBrains IDEs, no copy-pasting required                                   |
| **Code Generation & Optimization** | Automatically generates code, creates tests, fixes bugs, supporting the complete process from concept to commit  |
|                                    | Optimized for code generation and understanding, combining advanced models like Claude Opus 4                    |
| **Security & Flexibility**         | Changes require explicit user authorization, ensuring safer file and command operations                          |
|                                    | Adapts to user code standards, supports custom configurations                                                    |
| **Toolchain Integration**          | Supports integration with tools like GitHub and GitLab to achieve automated workflows                            |
|                                    | Integrates with test suites and build systems, enhancing existing development tools                              |
| **Cross-Platform & Extensibility** | Supports Windows, macOS, and Linux operating systems                                                             |
|                                    | Configurable to run in SDKs or GitHub Actions, flexibly adapting to different needs                              |
| **Key Application Scenarios**      | Codebase onboarding and understanding, quick ramp-up for new members                                             |
|                                    | Code issue fixing and optimization processes, from problem analysis to PR submission                             |
|                                    | Project code refactoring and new feature implementation                                                          |
| **User Feedback Highlights**       | Improves daily development efficiency, saving time spent on routine tasks                                        |
|                                    | Excellent performance in handling complex multi-step tasks, expanding development possibilities                  |

## AI Model Configuration Method

### Windows Graphical Guide

#### 1. Install Node.js Environment

Claude Code requires a Node.js environment to run.

> **Node.js Environment Installation Steps**
>
> - Open your browser and visit https://nodejs.org/
>   - Click the "LTS" version to download (Long Term Support version recommended)
>   - After downloading, double-click the .msi file
>   - Follow the installation wizard to complete the installation, keeping default settings

> **Windows Notes**
>
> - It is recommended to use PowerShell instead of CMD
>   - If you encounter permission issues, try running as administrator
>   - Some antivirus software may report false positives; you may need to add an exception

![windows-img-01.webp](/apps-assets/claude_code/windows-img-01.webp)

![windows-img-02.webp](/apps-assets/claude_code/windows-img-02.webp)

![windows-img-03.webp](/apps-assets/claude_code/windows-img-03.webp)

![windows-img-04.webp](/apps-assets/claude_code/windows-img-04.webp)

![windows-img-05.webp](/apps-assets/claude_code/windows-img-05.webp)

> **Verify Installation Success**
>
> After installation, open PowerShell or CMD and enter the following commands:
>
>   ```bash
>   node --version
>   npm --version
>   ```
>
>   If version numbers are displayed, the installation was successful.

#### 2. Install Git Bash

> **Windows Notes**
>
> In a Windows environment, Git Bash is required to install Claude Code. After installation, environment variable setup and using Claude Code will still be done in regular PowerShell or CMD.

> **Download and Install Git for Windows**
>
> - Visit https://git-scm.com/downloads/win
>   - Click "Download for Windows" to download the installer
>   - Run the downloaded .exe installation file
>   - Keep default settings during installation, and click "Next" to complete the installation

![windows-img-06.webp](/apps-assets/claude_code/windows-img-06.webp)

![windows-img-07.webp](/apps-assets/claude_code/windows-img-07.webp)

![windows-img-08.webp](/apps-assets/claude_code/windows-img-08.webp)

> **Verify Git Bash Installation**
>
> After installation, open Git Bash and enter the following command to verify:
>
>   ```bash
>   git --version
>   ```
>
>   If a version number is displayed, the installation was successful.

#### 3. Install Claude Code

> **Install Claude Code**
>
> Open PowerShell and run the following command:
>
>   ```bash
>   npm install -g @anthropic-ai/claude-code
>   ```
>
>   This command will download and install the latest version of Claude Code from the official npm repository.

![windows-img-09.webp](/apps-assets/claude_code/windows-img-09.webp)

> **Add ~/.local/bin to PATH (only if prompted)**
>
> ```powershell
>   [Environment]::SetEnvironmentVariable('Path', ([Environment]::GetEnvironmentVariable('Path','User') + ";$HOME\.local\bin"), 'User')
>   ```

> **Verify Claude Code Installation**
>
> After installation, enter the following command to check if it was successfully installed:
>
>   ```bash
>   claude --version
>   ```
>
>   If a version number is displayed, congratulations! Claude Code has been successfully installed.

#### 4. Set Environment Variables

> **One-Click Setup Command (Windows System)**
>
> To allow Claude Code to connect to your relay service, you need to set multiple environment variables:

```powershell
iex (irm 'https://raw.githubusercontent.com/Uter.ai/new-api-docs/refs/heads/main/helper/claude-cli-setup.ps1')
```

![windows-configure](/apps-assets/claude_code/windows_configure.webp)

#### 5. Start Using Claude Code

You can now start using Claude Code!

> **Launch Claude Code**
>
> Open PowerShell and launch Claude Code directly:
>
>   ```bash
>   claude
>   ```
>
>   To use in a specific project:
>
>   ```bash
>   # Navigate to your project directory
>   cd C:\path\to\your\project
>
>   # Launch Claude Code
>   claude
>   ```

![windows-img-11.webp](/apps-assets/claude_code/windows-img-11.webp)

![windows-img-12.webp](/apps-assets/claude_code/windows-img-12.webp)

![windows-img-13.webp](/apps-assets/claude_code/windows-img-13.webp)

![windows-img-14.webp](/apps-assets/claude_code/windows-img-14.webp)

![windows-img-15.webp](/apps-assets/claude_code/windows-img-15.webp)

> **Select Model**
>
> Enter the command:
>
>   ```bash
>   /model
>   ```
>
>   Press Enter to select a model; usually, the default settings are sufficient.

![windows-img-16.webp](/apps-assets/claude_code/windows-img-16.webp)

![windows-img-17.webp](/apps-assets/claude_code/windows-img-17.webp)

> Note: After modifying environment variables, all models (including officially preset models) will call the custom access point instead of using official account quotas.

### macOS Graphical Guide

#### 1. Install Claude Code CLI

Open Terminal

![macos-img-01.webp](/apps-assets/claude_code/macos-img-01.webp)

> **Install Claude Code**
>
> Open Terminal and run the following command:
>
>   ```bash
>   curl -fsSL https://claude.ai/install.sh | bash
>   ```
>
>   Optional: Run the provided command when prompted
>
>   ```bash
>   echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
>   ```

![macos-img-02.webp](/apps-assets/claude_code/macos-img-02.webp)

#### 2. Set Environment Variables

To allow Claude Code to connect to a third-party relay service, you need to set environment variables:

> **One-Click Setup for Claude Code Environment Variables**
>
> Enter the command:
>
>   ```bash
>   curl -fsSL https://raw.githubusercontent.com/Uter.ai/new-api-docs/refs/heads/main/helper/claude-cli-setup.sh | bash
>   ```

![macos-configure](/apps-assets/claude_code/macos_configure.webp)

> **Verify Claude Code Installation**
>
> After installation, enter the following command to check if it was successfully installed:
>
>   ```bash
>   claude --version
>   ```
>
>   If a version number is displayed, congratulations! Claude Code has been successfully installed.

#### 3. Start Using Claude Code

You can now start using Claude Code!

> **Launch Claude Code**
>
> Launch Claude Code directly:
>
>   ```bash
>   claude
>   ```
>
>   To use in a specific project:
>
>   ```bash
>   # Navigate to your project directory
>   cd /path/to/your/project
>
>   # Launch Claude Code
>   claude
>   ```

![macos-img-04.webp](/apps-assets/claude_code/macos-img-04.webp)

![macos-img-05.webp](/apps-assets/claude_code/macos-img-05.webp)

![macos-img-06.webp](/apps-assets/claude_code/macos-img-06.webp)

![macos-img-07.webp](/apps-assets/claude_code/macos-img-07.webp)

![macos-img-08.webp](/apps-assets/claude_code/macos-img-08.webp)

> **Select Model (Optional)**
>
> Enter the command:
>
>   ```bash
>   /model
>   ```
>
>   Press Enter to select an official model; usually, the default model is sufficient.

![macos-img-09.webp](/apps-assets/claude_code/macos-img-09.webp)

![macos-img-10.webp](/apps-assets/claude_code/macos-img-10.webp)

![macos-img-11.webp](/apps-assets/claude_code/macos-img-11.webp)

> Note: After modifying the `ANTHROPIC_BASE_URL` environment variable, all models (including officially preset models) will call the custom access point instead of using official account quotas.

#### 4. macOS Common Issues

> **macOS Security Settings Preventing Execution**
>
> If the system prevents Claude Code from running:
>
>   - Open "System Preferences" → "Security & Privacy"
>   - Click "Open Anyway" or "Allow"
>   - Or run in Terminal: `sudo spctl --master-disable`

### Linux Graphical Guide

#### 1. Install Claude Code

![linux-img-01.webp](/apps-assets/claude_code/linux-img-01.webp)

> **Install Claude Code**
>
> Open Terminal and run the following command:
>
>   ```bash
>   curl -fsSL https://claude.ai/install.sh | bash
>   ```
>
>   If you encounter permission issues, you can use sudo:
>
>   ```bash
>   sudo curl -fsSL https://claude.ai/install.sh | bash
>   ```

![linux-img-03.webp](/apps-assets/claude_code/linux-img-03.webp)

> **Verify Claude Code Installation**
>
> After installation, enter the following command to check if it was successfully installed:
>
>   ```bash
>   claude --version
>   ```
>
>   If a version number is displayed, congratulations! Claude Code has been successfully installed.

#### 2. Set Environment Variables

To allow Claude Code to connect to your relay service, you need to set two environment variables:

> **One-Click Environment Variable Modification**
>
> Enter the command:
>
>   ```bash
>   curl -fsSL https://raw.githubusercontent.com/Uter.ai/new-api-docs/refs/heads/main/helper/claude-cli-setup.sh | bash
>   ```

![macos-configure](/apps-assets/claude_code/macos_configure.webp)

#### 3. Start Using Claude Code

You can now start using Claude Code!

> **Launch Claude Code**
>
> Launch Claude Code directly:
>
>   ```bash
>   claude
>   ```
>
>   To use in a specific project:
>
>   ```bash
>   # Navigate to your project directory
>   cd /path/to/your/project
>
>   # Launch Claude Code
>   claude
>   ```

![linux-img-03.webp](/apps-assets/claude_code/linux-img-03.webp)

![linux-img-04.webp](/apps-assets/claude_code/linux-img-04.webp)

![linux-img-05.webp](/apps-assets/claude_code/linux-img-05.webp)

> **Select Model**
>
> Enter the command:
>
>   ```bash
>   /model
>   ```
>
>   Press Enter to select an official model; usually, the default model is sufficient.

![linux-img-06.webp](/apps-assets/claude_code/linux-img-06.webp)

![linux-img-07.webp](/apps-assets/claude_code/linux-img-07.webp)

![linux-img-08.webp](/apps-assets/claude_code/linux-img-08.webp)

![linux-img-09.webp](/apps-assets/claude_code/linux-img-09.webp)

> Note: After modifying the `ANTHROPIC_BASE_URL` environment variable, all models (including officially preset models) will call the custom access point instead of using official account quotas.

#### 4. Linux Common Issues

> **Missing Dependency Libraries**
>
> Some Linux distributions require additional dependencies to be installed:
>
>   ```bash
>   # Ubuntu/Debian
>   sudo apt install build-essential
>
>   # CentOS/RHEL
>   sudo dnf groupinstall "Development Tools"
>   ```

> **Environment Variables Not Taking Effect**
>
> Check the following points:
>
>   - Confirm that you modified the correct configuration file (`.bashrc` or `.zshrc`)
>   - Restart the terminal or run `source ~/.bashrc`
>   - Verify settings: `echo $ANTHROPIC_BASE_URL`
