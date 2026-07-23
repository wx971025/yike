#define MyAppName "YiKe"
#define MyAppDisplayName "忆刻 YiKe"
#define MyAppPublisher "YiKe"
#define MyAppExeName "YiKe.exe"
#define MyAppIconName "icon.ico"
#ifndef MyAppVersion
#define MyAppVersion "1.0.0"
#endif

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppDisplayName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppDisplayName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\YiKe
DefaultGroupName={#MyAppDisplayName}
DisableProgramGroupPage=yes
OutputDir=..\output
OutputBaseFilename=YiKeSetup
SetupIconFile=..\assets\icon.ico
UninstallDisplayIcon={app}\{#MyAppIconName}
Compression=lzma2
SolidCompression=no
WizardStyle=modern
MinVersion=10.0
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
CloseApplications=force
AppMutex=YiKeDesktopMutex
SetupMutex=YiKeSetupMutex

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce

[InstallDelete]
Type: filesandordirs; Name: "{app}\_internal"

[Files]
Source: "..\output\stage\YiKe\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs restartreplace uninsrestartdelete

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
  Exec('cmd.exe', ExpandConstant('/c ping 127.0.0.1 -n ' + IntToStr(Seconds + 1) + ' >nul'), '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure KillYiKeProcesses;
var
  ResultCode: Integer;
begin
  Exec('taskkill', '/IM YiKe.exe /F', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  WaitSeconds(3);
end;

procedure RemoveStaleInternal(const AppDir: String);
var
  ResultCode: Integer;
  InternalDir: String;
begin
  InternalDir := AppDir + '\_internal';
  if not DirExists(InternalDir) then
    Exit;
  Exec('cmd.exe', ExpandConstant('/c rd /s /q "' + InternalDir + '"'), '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  WaitSeconds(2);
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
      KillYiKeProcesses;
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
  KillYiKeProcesses;

  if CheckForMutexes('YiKeDesktopMutex') then
  begin
    Result :=
      '忆刻仍在运行，无法写入安装目录下的程序文件。' + #13#10 +
      '请系统托盘 → 退出，或在任务管理器中结束 YiKe.exe，然后点击「重试」。';
    Exit;
  end;

  RemoveStaleInternal(AppDir);
  { 给杀毒/索引释放文件句柄的时间，减轻 MoveFile code 5 }
  WaitSeconds(5);

  Result := '';
end;
