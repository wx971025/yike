using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using YiKe.Desktop.ViewModels;

namespace YiKe.Desktop.Views;

public sealed partial class LoginPage : Page
{
    public LoginViewModel ViewModel { get; } = new();
    public ShellViewModel Shell { get; private set; } = null!;

    public LoginPage()
    {
        InitializeComponent();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        Shell = e.Parameter as ShellViewModel ?? new ShellViewModel();
    }

    private void PasswordBox_PasswordChanged(object sender, RoutedEventArgs e)
    {
        if (sender is PasswordBox box)
        {
            ViewModel.Password = box.Password;
        }
    }

    private void GoRegister_Click(object sender, RoutedEventArgs e)
    {
        Frame?.Navigate(typeof(RegisterPage), Shell);
    }
}
