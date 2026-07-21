using System.Text.Json;

namespace YiKe.Desktop.Services;

public sealed class AuthStore
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    private readonly string _authPath;

    public AuthStore()
    {
        var dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "YiKe");
        Directory.CreateDirectory(dir);
        _authPath = Path.Combine(dir, "auth.json");
        Load();
    }

    public string? AccessToken { get; private set; }

    public bool IsAuthenticated => !string.IsNullOrWhiteSpace(AccessToken);

    public event EventHandler? TokenChanged;

    public void SetToken(string token)
    {
        AccessToken = token;
        Save();
        TokenChanged?.Invoke(this, EventArgs.Empty);
    }

    public void Clear()
    {
        AccessToken = null;
        if (File.Exists(_authPath))
        {
            File.Delete(_authPath);
        }

        TokenChanged?.Invoke(this, EventArgs.Empty);
    }

    private void Load()
    {
        if (!File.Exists(_authPath))
        {
            return;
        }

        try
        {
            var json = File.ReadAllText(_authPath);
            var data = JsonSerializer.Deserialize<AuthFile>(json, JsonOptions);
            AccessToken = data?.AccessToken;
        }
        catch
        {
            AccessToken = null;
        }
    }

    private void Save()
    {
        var data = new AuthFile { AccessToken = AccessToken ?? string.Empty };
        File.WriteAllText(_authPath, JsonSerializer.Serialize(data, JsonOptions));
    }

    private sealed class AuthFile
    {
        public string AccessToken { get; set; } = string.Empty;
    }
}
