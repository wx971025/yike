using System.Diagnostics;
using System.Net.Http;

namespace YiKe.Desktop.Services;

public sealed class BackendHost : IDisposable
{
    private const string HealthUrl = "http://127.0.0.1:17890/api/health";
    private Process? _process;

    public async Task StartAsync(CancellationToken cancellationToken = default)
    {
        var exeDir = AppContext.BaseDirectory;
        var backendExe = Path.Combine(exeDir, "YiKeBackend.exe");
        if (!File.Exists(backendExe))
        {
            throw new FileNotFoundException("未找到 YiKeBackend.exe，请与 YiKe.exe 放在同一目录。", backendExe);
        }

        if (await IsHealthyAsync())
        {
            return;
        }

        _process = Process.Start(new ProcessStartInfo
        {
            FileName = backendExe,
            WorkingDirectory = exeDir,
            UseShellExecute = false,
            CreateNoWindow = true,
        }) ?? throw new InvalidOperationException("无法启动 YiKeBackend.exe");

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(TimeSpan.FromSeconds(60));

        while (!cts.Token.IsCancellationRequested)
        {
            if (await IsHealthyAsync())
            {
                return;
            }

            if (_process.HasExited)
            {
                throw new InvalidOperationException("YiKeBackend.exe 启动后立即退出。");
            }

            await Task.Delay(500, cts.Token);
        }

        throw new TimeoutException("等待后端 API 就绪超时。");
    }

    private static async Task<bool> IsHealthyAsync()
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
            var response = await client.GetAsync(HealthUrl);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    public void Dispose()
    {
        if (_process is { HasExited: false })
        {
            try
            {
                _process.Kill(entireProcessTree: true);
            }
            catch
            {
                // ignore shutdown errors
            }
        }

        _process?.Dispose();
        _process = null;
    }
}
