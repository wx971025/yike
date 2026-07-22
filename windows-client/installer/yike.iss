; 忆刻 YiKe Windows 安装包（Inno Setup 6）
#define MyAppName "忆刻 YiKe"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "YiKe"
#define MyAppExeName "YiKe.exe"
#define StageDir "..\output\stage"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\YiKe
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\output
OutputBaseFilename=YiKeSetup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin

[Languages]
; GitHub Actions 默认 Inno Setup 不含 ChineseSimplified.isl，使用内置英文语言包。
; 应用名、快捷方式等自定义文案仍可写中文。
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
Source: "{#StageDir}\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageDir}\YiKeBackend.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{localappdata}\YiKe\logs"
