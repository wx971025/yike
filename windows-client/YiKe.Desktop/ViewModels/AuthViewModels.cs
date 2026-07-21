using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace YiKe.Desktop.ViewModels;

public partial class ShellViewModel : ObservableObject
{
    [ObservableProperty]
    private string _statusMessage = string.Empty;

    [ObservableProperty]
    private bool _isBusy;

    [ObservableProperty]
    private string _username = string.Empty;

    public DashboardViewModel Dashboard { get; } = new();
}

public partial class LoginViewModel : ObservableObject
{
    [ObservableProperty]
    private string _username = string.Empty;

    [ObservableProperty]
    private string _password = string.Empty;

    [ObservableProperty]
    private string _errorMessage = string.Empty;

    [ObservableProperty]
    private bool _isBusy;

    [RelayCommand]
    private async Task LoginAsync(ShellViewModel shell)
    {
        ErrorMessage = string.Empty;
        if (string.IsNullOrWhiteSpace(Username) || string.IsNullOrWhiteSpace(Password))
        {
            ErrorMessage = "请输入用户名和密码";
            return;
        }

        IsBusy = true;
        try
        {
            await App.Api.LoginAsync(Username.Trim(), Password);
            var me = await App.Api.MeAsync();
            shell.Username = string.IsNullOrWhiteSpace(me.Nickname) ? me.Username : me.Nickname;
            shell.StatusMessage = $"欢迎，{shell.Username}";
        }
        catch (UnauthorizedAccessException)
        {
            ErrorMessage = "用户名或密码错误";
            App.Auth.Clear();
        }
        catch (Exception ex)
        {
            ErrorMessage = ex.Message;
        }
        finally
        {
            IsBusy = false;
        }
    }
}

public partial class RegisterViewModel : ObservableObject
{
    [ObservableProperty]
    private string _username = string.Empty;

    [ObservableProperty]
    private string _password = string.Empty;

    [ObservableProperty]
    private string _confirmPassword = string.Empty;

    [ObservableProperty]
    private string _errorMessage = string.Empty;

    [ObservableProperty]
    private bool _isBusy;

    [RelayCommand]
    private async Task RegisterAsync(ShellViewModel shell)
    {
        ErrorMessage = string.Empty;
        if (string.IsNullOrWhiteSpace(Username) || string.IsNullOrWhiteSpace(Password))
        {
            ErrorMessage = "请输入用户名和密码";
            return;
        }

        if (Password != ConfirmPassword)
        {
            ErrorMessage = "两次输入的密码不一致";
            return;
        }

        IsBusy = true;
        try
        {
            await App.Api.RegisterAsync(Username.Trim(), Password);
            var me = await App.Api.MeAsync();
            shell.Username = string.IsNullOrWhiteSpace(me.Nickname) ? me.Username : me.Nickname;
            shell.StatusMessage = $"注册成功，欢迎 {shell.Username}";
        }
        catch (Exception ex)
        {
            ErrorMessage = ex.Message;
        }
        finally
        {
            IsBusy = false;
        }
    }
}
