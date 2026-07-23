#define MyAppName "YiKe"
#define MyAppDisplayName "忆刻 YiKe"
#define MyAppPublisher "YiKe"
#define MyAppExeName "YiKe.exe"
#define MyAppIconName "icon.ico"
#define MyAppVersion "1.0.1"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppDisplayName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\YiKe
DefaultGroupName={#MyAppDisplayName}
DisableProgramGroupPage=yes
OutputDir=..\output
OutputBaseFilename=YiKeSetup
SetupIconFile=..\assets\icon.ico
UninstallDisplayIcon={app}\{#MyAppIconName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
CloseApplications=force
AppMutex=YiKeDesktopMutex
SetupMutex=YiKeSetupMutex
AllowMultipleInstances=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce

[Files]
Source: "..\output\stage\YiKe\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs restartreplace

[Icons]
Name: "{group}\{#MyAppDisplayName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppIconName}"
Name: "{autodesktop}\{#MyAppDisplayName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppIconName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppDisplayName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{localappdata}\YiKe\logs"

[Code]
procedure WaitSeconds(Seconds: Integer);
var
  ResultCode: Integer;
begin
  { ping -n (N+1) ≈ 等待 N 秒 }
  Exec('cmd.exe', ExpandConstant('/c ping 127.0.0.1 -n ' + IntToStr(Seconds + 1) + ' >nul'), '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure KillYiKeProcesses();
var
  ResultCode: Integer;
begin
  Exec('taskkill', '/IM YiKe.exe /F', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  WaitSeconds(3);
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  if CheckForMutexes('YiKeDesktopMutex') then
  begin
    if MsgBox(
      '检测到忆刻正在运行。' + #13#10 +
      '安装前需要完全退出（系统托盘 → 退出）。' + #13#10#13#10 +
      '是否现在自动关闭忆刻并继续安装？',
      mbConfirmation, MB_YESNO) = IDYES then
    begin
      KillYiKeProcesses();
      if CheckForMutexes('YiKeDesktopMutex') then
      begin
        MsgBox(
          '无法自动关闭忆刻。' + #13#10 +
          '请在任务管理器中结束 YiKe.exe 后，重新运行安装程序。',
          mbError, MB_OK);
        Result := False;
      end;
    end
    else
      Result := False;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  AppDir: String;
begin
  AppDir := ExpandConstant('{app}');
  KillYiKeProcesses();

  if CheckForMutexes('YiKeDesktopMutex') then
  begin
    Result :=
      '忆刻仍在运行，无法写入安装目录下的程序文件。' + #13#10 +
      '请系统托盘 → 退出，或在任务管理器中结束 YiKe.exe，然后点击「重试」。';
    Exit;
  end;

  { 上次安装失败可能留下 _internal；再等几秒，避免杀毒扫描刚写入的 DLL 时 MoveFile 失败 }
  if DirExists(AppDir + '\_internal') then
    WaitSeconds(2);

  Result := '';
end;
