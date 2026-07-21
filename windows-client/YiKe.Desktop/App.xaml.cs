using Microsoft.UI.Xaml;
using YiKe.Desktop.Services;

namespace YiKe.Desktop;

public partial class App : Application
{
    public static ApiClient Api { get; private set; } = null!;
    public static AuthStore Auth { get; private set; } = null!;
    public static BackendHost Backend { get; private set; } = null!;

    public App()
    {
        InitializeComponent();
        Auth = new AuthStore();
        Api = new ApiClient(Auth);
        Backend = new BackendHost();
    }

    protected override async void OnLaunched(LaunchActivatedEventArgs args)
    {
        await Backend.StartAsync();

        var window = new MainWindow();
        window.Activate();
    }
}
