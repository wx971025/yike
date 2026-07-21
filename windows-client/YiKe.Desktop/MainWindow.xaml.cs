using Microsoft.UI.Xaml;
using YiKe.Desktop.ViewModels;
using YiKe.Desktop.Views;

namespace YiKe.Desktop;

public sealed partial class MainWindow : Window
{
    public ShellViewModel ViewModel { get; }

    public MainWindow()
    {
        InitializeComponent();
        Title = "忆刻 YiKe";
        ViewModel = new ShellViewModel();

        if (App.Auth.IsAuthenticated)
        {
            RootFrame.Navigate(typeof(ShellPage), ViewModel);
        }
        else
        {
            RootFrame.Navigate(typeof(LoginPage), ViewModel);
        }

        App.Auth.TokenChanged += (_, _) => NavigateAfterAuth();
        Closed += (_, _) => App.Backend.Dispose();
    }

    private void NavigateAfterAuth()
    {
        if (App.Auth.IsAuthenticated)
        {
            RootFrame.Navigate(typeof(ShellPage), ViewModel);
        }
        else
        {
            RootFrame.Navigate(typeof(LoginPage), ViewModel);
        }
    }
}
