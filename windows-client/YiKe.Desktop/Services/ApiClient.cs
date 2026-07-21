using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using YiKe.Desktop.Models;

namespace YiKe.Desktop.Services;

public sealed class ApiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly AuthStore _auth;
    private readonly HttpClient _http;

    public ApiClient(AuthStore auth)
    {
        _auth = auth;
        _http = new HttpClient
        {
            BaseAddress = new Uri("http://127.0.0.1:17890/api/"),
            Timeout = TimeSpan.FromSeconds(30),
        };
    }

    public async Task<TokenResponse> RegisterAsync(string username, string password, CancellationToken ct = default)
    {
        var payload = new { username, password };
        using var response = await _http.PostAsJsonAsync("auth/register", payload, ct);
        await EnsureSuccessAsync(response);
        var token = await response.Content.ReadFromJsonAsync<TokenResponse>(JsonOptions, ct)
            ?? throw new InvalidOperationException("注册响应无效");
        _auth.SetToken(token.AccessToken);
        return token;
    }

    public async Task<TokenResponse> LoginAsync(string username, string password, CancellationToken ct = default)
    {
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["username"] = username,
            ["password"] = password,
        });
        using var response = await _http.PostAsync("auth/login", form, ct);
        await EnsureSuccessAsync(response);
        var token = await response.Content.ReadFromJsonAsync<TokenResponse>(JsonOptions, ct)
            ?? throw new InvalidOperationException("登录响应无效");
        _auth.SetToken(token.AccessToken);
        return token;
    }

    public async Task<UserInfo> MeAsync(CancellationToken ct = default)
    {
        using var request = CreateAuthorized(HttpMethod.Get, "auth/me");
        using var response = await _http.SendAsync(request, ct);
        await EnsureSuccessAsync(response);
        return await response.Content.ReadFromJsonAsync<UserInfo>(JsonOptions, ct)
            ?? throw new InvalidOperationException("用户信息响应无效");
    }

    public async Task<IReadOnlyList<ReviewWord>> GetTodayWordsAsync(
        string track,
        IEnumerable<int>? groupIds = null,
        CancellationToken ct = default)
    {
        var parts = new List<string> { $"track={Uri.EscapeDataString(track)}" };
        if (groupIds != null)
        {
            foreach (var id in groupIds)
            {
                parts.Add($"group_ids={id}");
            }
        }

        var url = "reviews/today/words?" + string.Join("&", parts);
        using var request = CreateAuthorized(HttpMethod.Get, url);
        using var response = await _http.SendAsync(request, ct);
        await EnsureSuccessAsync(response);
        return await response.Content.ReadFromJsonAsync<List<ReviewWord>>(JsonOptions, ct) ?? [];
    }

    public async Task ReviewWordAsync(int wordId, string track, CancellationToken ct = default)
    {
        var url = $"words/{wordId}/review?track={Uri.EscapeDataString(track)}";
        using var request = CreateAuthorized(HttpMethod.Post, url);
        using var response = await _http.SendAsync(request, ct);
        await EnsureSuccessAsync(response);
    }

    public async Task SkipWordAsync(int wordId, string track, CancellationToken ct = default)
    {
        var url = $"words/{wordId}/skip?track={Uri.EscapeDataString(track)}";
        using var request = CreateAuthorized(HttpMethod.Post, url);
        using var response = await _http.SendAsync(request, ct);
        await EnsureSuccessAsync(response);
    }

    public async Task<IReadOnlyList<GroupInfo>> GetGroupsAsync(CancellationToken ct = default)
    {
        using var request = CreateAuthorized(HttpMethod.Get, "groups");
        using var response = await _http.SendAsync(request, ct);
        await EnsureSuccessAsync(response);
        return await response.Content.ReadFromJsonAsync<List<GroupInfo>>(JsonOptions, ct) ?? [];
    }

    private HttpRequestMessage CreateAuthorized(HttpMethod method, string relativeUrl)
    {
        var request = new HttpRequestMessage(method, relativeUrl);
        if (!string.IsNullOrWhiteSpace(_auth.AccessToken))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _auth.AccessToken);
        }

        return request;
    }

    private static async Task EnsureSuccessAsync(HttpResponseMessage response)
    {
        if (response.IsSuccessStatusCode)
        {
            return;
        }

        var body = await response.Content.ReadAsStringAsync();
        string message;
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("detail", out var detail))
            {
                message = detail.GetString() ?? body;
            }
            else
            {
                message = body;
            }
        }
        catch
        {
            message = body;
        }

        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            throw new UnauthorizedAccessException(message);
        }

        throw new InvalidOperationException(message);
    }
}
